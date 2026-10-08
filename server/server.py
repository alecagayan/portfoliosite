#!/usr/bin/env python3
"""Edit-mode API for the portfolio site.

A small, dependency-free service (Python 3.8+ standard library only) that lets
the site owner sign in with a password and manage project screenshots:
upload, reorder, recaption, replace and delete. Apache serves the site itself
and forwards /api/ here.

Everything it writes lives under <site>/uploads/, which git ignores, so a
`git pull` of the site never conflicts with uploaded content:

    uploads/screenshots.json         {"project-id": [{"src": ..., "alt": ...}]}
    uploads/screenshots/<random>.webp

Usage:
    python3 server/server.py hash-password      # prints a hash for EDIT_PASSWORD_HASH
    python3 server/server.py                    # run the API on 127.0.0.1:8787
    python3 server/server.py --dev              # also serve the site, for local preview

Configuration (environment variables):
    EDIT_PASSWORD_HASH   required; output of `hash-password`
    SITE_ROOT            defaults to the folder above this file
"""

import argparse
import getpass
import hashlib
import hmac
import http.server
import json
import os
import re
import secrets
import sys
import threading
import time
import urllib.parse
from http import HTTPStatus
from pathlib import Path

SITE_ROOT = Path(os.environ.get("SITE_ROOT", Path(__file__).resolve().parent.parent)).resolve()
UPLOADS = SITE_ROOT / "uploads"
SHOT_DIR = UPLOADS / "screenshots"
INDEX_FILE = UPLOADS / "screenshots.json"
PROJECTS_FILE = SITE_ROOT / "data" / "projects.json"

MAX_UPLOAD_BYTES = 15 * 1024 * 1024
MAX_JSON_BYTES = 256 * 1024
MAX_SHOTS_PER_PROJECT = 30
MAX_ALT_LENGTH = 300
SESSION_SECONDS = 12 * 60 * 60
ORPHAN_GRACE_SECONDS = 10 * 60
LOGIN_WINDOW_SECONDS = 15 * 60
LOGIN_MAX_FAILURES = 5
PBKDF2_ITERATIONS = 310_000

# Browsers can't send a custom header cross-site without a CORS preflight,
# which this server never approves, so requiring it blocks CSRF.
CSRF_HEADER = "X-Portfolio-Editor"
COOKIE_NAME = "portfolio_edit"

SRC_PATTERN = re.compile(r"^uploads/screenshots/[0-9a-f]{32}\.(png|jpg|webp|gif)$")

write_lock = threading.Lock()
sessions = {}  # token -> expiry timestamp
login_failures = {}  # client ip -> [failure timestamps]
DEV_MODE = False


# ---------------------------------------------------------------- passwords

def hash_password(password):
    salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, PBKDF2_ITERATIONS)
    return "pbkdf2_sha256${}${}${}".format(PBKDF2_ITERATIONS, salt.hex(), digest.hex())


def check_password(password, stored):
    try:
        scheme, iterations, salt_hex, digest_hex = stored.split("$")
        if scheme != "pbkdf2_sha256":
            return False
        digest = hashlib.pbkdf2_hmac("sha256", password.encode(), bytes.fromhex(salt_hex), int(iterations))
        return hmac.compare_digest(digest.hex(), digest_hex)
    except (ValueError, AttributeError):
        return False


# ---------------------------------------------------------------- data

def project_ids():
    with open(PROJECTS_FILE, encoding="utf-8") as f:
        return {p["id"] for p in json.load(f) if "id" in p}


def read_index():
    try:
        with open(INDEX_FILE, encoding="utf-8") as f:
            data = json.load(f)
        return data if isinstance(data, dict) else {}
    except (FileNotFoundError, json.JSONDecodeError):
        return {}


def write_index(index):
    UPLOADS.mkdir(parents=True, exist_ok=True)
    tmp = UPLOADS / ".screenshots.json.tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(index, f, indent=2, ensure_ascii=False)
    os.replace(tmp, INDEX_FILE)


def remove_orphans(index):
    """Delete uploaded files nothing references, once they're old enough that
    they can't belong to an upload whose save is still in flight."""
    referenced = {item["src"].rsplit("/", 1)[-1] for items in index.values() for item in items}
    now = time.time()
    for path in SHOT_DIR.glob("*"):
        if path.name not in referenced and now - path.stat().st_mtime > ORPHAN_GRACE_SECONDS:
            try:
                path.unlink()
            except OSError:
                pass


def sniff_image(data):
    """Return a file extension from the file's magic bytes, or None."""
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return "png"
    if data.startswith(b"\xff\xd8\xff"):
        return "jpg"
    if data[:6] in (b"GIF87a", b"GIF89a"):
        return "gif"
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "webp"
    return None


def validate_items(items):
    if not isinstance(items, list) or len(items) > MAX_SHOTS_PER_PROJECT:
        raise ValueError("Expected a list of at most {} screenshots".format(MAX_SHOTS_PER_PROJECT))
    clean = []
    for item in items:
        if not isinstance(item, dict):
            raise ValueError("Each screenshot must be an object")
        src = item.get("src")
        alt = item.get("alt", "")
        if not isinstance(src, str) or not SRC_PATTERN.match(src):
            raise ValueError("Invalid image path")
        if not (SITE_ROOT / src).is_file():
            raise ValueError("Image not found: " + src)
        if not isinstance(alt, str) or len(alt) > MAX_ALT_LENGTH:
            raise ValueError("Captions must be text under {} characters".format(MAX_ALT_LENGTH))
        clean.append({"src": src, "alt": alt.strip()})
    return clean


# ---------------------------------------------------------------- http

class Handler(http.server.SimpleHTTPRequestHandler):
    server_version = "PortfolioEditor/1.0"

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(SITE_ROOT), **kwargs)

    # -- helpers

    def client_ip(self):
        ip = self.client_address[0]
        # Only trust the forwarded address when the request came through the local proxy
        if ip in ("127.0.0.1", "::1"):
            forwarded = self.headers.get("X-Forwarded-For", "")
            if forwarded:
                return forwarded.split(",")[-1].strip()
        return ip

    def send_json(self, status, payload, extra_headers=()):
        body = json.dumps(payload).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        for name, value in extra_headers:
            self.send_header(name, value)
        self.end_headers()
        self.wfile.write(body)

    def error(self, status, message):
        self.send_json(status, {"error": message})

    def session_token(self):
        for part in self.headers.get("Cookie", "").split(";"):
            name, _, value = part.strip().partition("=")
            if name == COOKIE_NAME:
                return value
        return None

    def is_authed(self):
        token = self.session_token()
        expiry = sessions.get(token) if token else None
        if expiry and expiry > time.time():
            return True
        if token:
            sessions.pop(token, None)
        return False

    def cookie(self, value, max_age):
        parts = [
            "{}={}".format(COOKIE_NAME, value),
            "Path=/api",
            "HttpOnly",
            "SameSite=Strict",
            "Max-Age={}".format(max_age),
        ]
        if not DEV_MODE:
            parts.append("Secure")
        return ("Set-Cookie", "; ".join(parts))

    def read_body(self, limit):
        try:
            length = int(self.headers.get("Content-Length", ""))
        except ValueError:
            self.error(HTTPStatus.LENGTH_REQUIRED, "Content-Length required")
            return None
        if length > limit:
            self.close_connection = True
            self.error(HTTPStatus.REQUEST_ENTITY_TOO_LARGE, "Too large (max {} MB)".format(limit // (1024 * 1024) or 1))
            return None
        return self.rfile.read(length)

    def read_json(self):
        body = self.read_body(MAX_JSON_BYTES)
        if body is None:
            return None
        try:
            return json.loads(body or b"null")
        except json.JSONDecodeError:
            self.error(HTTPStatus.BAD_REQUEST, "Invalid JSON")
            return None

    def require_write_access(self):
        if self.headers.get(CSRF_HEADER) != "1":
            self.error(HTTPStatus.FORBIDDEN, "Missing editor header")
            return False
        if not self.is_authed():
            self.error(HTTPStatus.UNAUTHORIZED, "Sign in first")
            return False
        return True

    # -- routing

    def do_GET(self):
        path = urllib.parse.urlsplit(self.path).path
        if path == "/api/session":
            return self.send_json(HTTPStatus.OK, {"authed": self.is_authed()})
        if path == "/api/screenshots":
            return self.send_json(HTTPStatus.OK, read_index())
        if path.startswith("/api/"):
            return self.error(HTTPStatus.NOT_FOUND, "Not found")
        if not DEV_MODE:
            return self.error(HTTPStatus.NOT_FOUND, "Not found")
        # Dev preview only: serve the site, but never the server code or git data
        if path.startswith(("/server", "/.git")) or "/." in path:
            return self.error(HTTPStatus.NOT_FOUND, "Not found")
        return super().do_GET()

    def do_HEAD(self):
        if DEV_MODE and not self.path.startswith("/api/"):
            return super().do_HEAD()
        self.send_response(HTTPStatus.METHOD_NOT_ALLOWED)
        self.end_headers()

    def do_POST(self):
        path = urllib.parse.urlsplit(self.path).path
        if path == "/api/login":
            return self.login()
        if path == "/api/logout":
            token = self.session_token()
            sessions.pop(token, None)
            return self.send_json(HTTPStatus.OK, {"ok": True}, [self.cookie("", 0)])
        if path == "/api/upload":
            return self.upload()
        return self.error(HTTPStatus.NOT_FOUND, "Not found")

    def do_PUT(self):
        path = urllib.parse.urlsplit(self.path).path
        match = re.match(r"^/api/screenshots/([a-z0-9-]{1,80})$", path)
        if not match:
            return self.error(HTTPStatus.NOT_FOUND, "Not found")
        return self.save_project(match.group(1))

    # -- actions

    def login(self):
        if self.headers.get(CSRF_HEADER) != "1":
            return self.error(HTTPStatus.FORBIDDEN, "Missing editor header")
        stored = os.environ.get("EDIT_PASSWORD_HASH", "")
        if not stored:
            return self.error(HTTPStatus.SERVICE_UNAVAILABLE, "Editing is not configured on this server")

        ip = self.client_ip()
        now = time.time()
        recent = [t for t in login_failures.get(ip, []) if now - t < LOGIN_WINDOW_SECONDS]
        login_failures[ip] = recent
        if len(recent) >= LOGIN_MAX_FAILURES:
            return self.error(HTTPStatus.TOO_MANY_REQUESTS, "Too many attempts. Try again in a few minutes.")

        payload = self.read_json()
        if payload is None:
            return
        password = payload.get("password") if isinstance(payload, dict) else None
        if not isinstance(password, str) or not check_password(password, stored):
            recent.append(now)
            time.sleep(0.5)  # slow down guessing
            return self.error(HTTPStatus.UNAUTHORIZED, "Wrong password")

        login_failures.pop(ip, None)
        for token, expiry in list(sessions.items()):
            if expiry < now:
                sessions.pop(token, None)
        token = secrets.token_urlsafe(32)
        sessions[token] = now + SESSION_SECONDS
        return self.send_json(HTTPStatus.OK, {"authed": True}, [self.cookie(token, SESSION_SECONDS)])

    def upload(self):
        if not self.require_write_access():
            return
        data = self.read_body(MAX_UPLOAD_BYTES)
        if data is None:
            return
        ext = sniff_image(data)
        if not ext:
            return self.error(HTTPStatus.UNSUPPORTED_MEDIA_TYPE, "Only PNG, JPEG, WebP or GIF images")
        SHOT_DIR.mkdir(parents=True, exist_ok=True)
        name = "{}.{}".format(secrets.token_hex(16), ext)
        with open(SHOT_DIR / name, "wb") as f:
            f.write(data)
        # Added to a project by the PUT that follows; unreferenced files get cleaned up
        return self.send_json(HTTPStatus.CREATED, {"src": "uploads/screenshots/" + name})

    def save_project(self, project_id):
        if not self.require_write_access():
            return
        if project_id not in project_ids():
            return self.error(HTTPStatus.NOT_FOUND, "Unknown project")
        items = self.read_json()
        if items is None:
            return
        try:
            clean = validate_items(items)
        except ValueError as exc:
            return self.error(HTTPStatus.BAD_REQUEST, str(exc))
        with write_lock:
            index = read_index()
            if clean:
                index[project_id] = clean
            else:
                index.pop(project_id, None)
            write_index(index)
            remove_orphans(index)
        return self.send_json(HTTPStatus.OK, index)


def main():
    global DEV_MODE
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("command", nargs="?", choices=["serve", "hash-password"], default="serve")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8787)
    parser.add_argument("--dev", action="store_true", help="also serve the site's files (local preview only)")
    args = parser.parse_args()

    if args.command == "hash-password":
        password = getpass.getpass("New edit-mode password: ")
        if len(password) < 10:
            sys.exit("Use at least 10 characters.")
        if getpass.getpass("Again: ") != password:
            sys.exit("Passwords didn't match.")
        print(hash_password(password))
        return

    DEV_MODE = args.dev
    if not os.environ.get("EDIT_PASSWORD_HASH"):
        print("Warning: EDIT_PASSWORD_HASH is not set, so nobody can sign in.", file=sys.stderr)
    server = http.server.ThreadingHTTPServer((args.host, args.port), Handler)
    print("Serving {} on http://{}:{}{}".format(SITE_ROOT, args.host, args.port, " (dev)" if DEV_MODE else ""), file=sys.stderr)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
