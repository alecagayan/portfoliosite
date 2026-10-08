# Edit mode

Visiting `https://alecagayan.com/?edit` asks for a password, then lets you add,
reorder, caption, replace and delete each project's screenshots. Changes save
as you make them.

`server.py` handles the saving. It uses only Python's standard library, runs
on `127.0.0.1:8787`, and Apache forwards `/api/` to it. Everything it writes
goes in `uploads/`, which git ignores, so `git pull` never conflicts with your
screenshots. **Back up `uploads/`**: it's the only copy of what you upload.

## One-time server setup (Ubuntu + Apache)

```bash
cd /var/www/alecagayan.com && sudo git pull

# 1. A folder the service can write to
sudo mkdir -p uploads/screenshots
sudo chown -R www-data:www-data uploads

# 2. Choose the edit-mode password (at least 10 characters); only a hash is stored
echo "EDIT_PASSWORD_HASH='$(python3 server/server.py hash-password)'" | sudo tee /etc/alecagayan-edit.env > /dev/null
sudo chmod 600 /etc/alecagayan-edit.env

# 3. Run the service, and start it on boot
sudo cp server/alecagayan-edit.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now alecagayan-edit
systemctl status alecagayan-edit --no-pager | head -5    # look for "active (running)"

# 4. Point Apache's /api/ at it (adds one Include line to each alecagayan.com site file)
sudo a2enmod proxy proxy_http
for f in /etc/apache2/sites-available/alecagayan.com*.conf; do
  grep -q apache-edit.conf "$f" || sudo sed -i 's|</VirtualHost>|    Include /var/www/alecagayan.com/server/apache-edit.conf\n</VirtualHost>|' "$f"
done
sudo apache2ctl configtest && sudo systemctl reload apache2

# 5. Check: should print {"authed": false}
curl -s https://alecagayan.com/api/session
```

To change the password later, repeat step 2 and run
`sudo systemctl restart alecagayan-edit`.

After a `git pull` that changes `server.py`, restart the service the same way.

## Trying it on your own computer

```bash
export EDIT_PASSWORD_HASH="$(python3 server/server.py hash-password)"
python3 server/server.py --dev
```

Then open http://localhost:8787/?edit. In `--dev` mode the service also serves
the site itself, so you don't need Apache.

## How it's protected

- The password is checked against a salted PBKDF2 hash. Five wrong attempts
  lock that IP address out for 15 minutes.
- A successful sign-in sets an HttpOnly, Secure, SameSite=Strict cookie that
  lasts 12 hours.
- Every change also needs a custom request header, which other websites can't
  send, so they can't make changes using your session.
- Uploads must really be PNG, JPEG, WebP or GIF files (checked from the file
  contents, not the name), up to 15 MB. They get random file names.
- Saved lists may only point at files inside `uploads/screenshots/`. Files
  that nothing uses any more are deleted automatically.
