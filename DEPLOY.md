# Deploy omnifix.pro to VPS/nginx

This guide describes a manual static deployment for `omnifix.pro`.

Hosting assumptions:

- Static no-JS site.
- Build output: `dist`.
- nginx, or another static web server, serves the files directly.
- Deployment is manual via `rsync`.
- Any DNS, CDN, or proxy layer is managed outside this repository.

Do not deploy from this repository unless you intentionally want to update production.

## 1. Build Locally

From the project root:

```bash
npm install
npm run build
```

`npm run build` first runs:

```bash
npm run generate:feed
```

That updates the build-time GitHub activity feed. `GITHUB_TOKEN` is optional; without it, public GitHub API access is used. If the API is unavailable or rate-limited, the fallback feed is used and the build should still pass.

Expected output:

```text
dist/index.html
dist/omnifix-github-avatar-round-o.png
```

## 2. No-JS Checks

Before uploading, verify that no JavaScript bundle is present:

```bash
find dist -type f
find dist -type f -name "*.js"
grep -n "<script" dist/index.html
grep -n "type=\"module\"" dist/index.html
grep -n "assets/index" dist/index.html
```

Expected:

- `find dist -type f` lists only the static HTML and image assets.
- `find dist -type f -name "*.js"` prints nothing.
- All `grep` checks print nothing.

## 3. Upload With rsync

Upload the contents of `dist` to the server web root:

```bash
rsync -avz --delete dist/ user@server:/path/to/web-root/
```

This copies the contents of `dist`, not the `dist` directory itself.

## 4. Server Permissions

On the server, ensure the web server can read the files:

```bash
ssh user@server
sudo chown -R www-data:www-data /path/to/web-root
sudo find /path/to/web-root -type d -exec chmod 755 {} \;
sudo find /path/to/web-root -type f -exec chmod 644 {} \;
```

If deployment is done by a non-root user and ownership needs to remain with that user, keep group/read permissions compatible with nginx.

## 5. nginx Config

Example nginx server block:

```nginx
server {
    listen 80;
    listen [::]:80;

    server_name omnifix.pro www.omnifix.pro;

    root /path/to/web-root;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location = /omnifix-github-avatar-round-o.png {
        try_files $uri =404;
        add_header Cache-Control "public, max-age=86400";
    }
}
```

Test and reload nginx:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

If a CDN or proxy is used, keep those settings managed separately from this repository.

## 6. Production Checks

Check the server or origin directly, if you have access to it:

```bash
curl -I http://127.0.0.1/
curl -s http://127.0.0.1/ | grep -n "<script"
curl -s http://127.0.0.1/ | grep -n "type=\"module\""
curl -s http://127.0.0.1/ | grep -n "assets/index"
```

Check the public site:

```bash
curl -I https://omnifix.pro/
curl -s https://omnifix.pro/ | grep -n "<script"
curl -s https://omnifix.pro/ | grep -n "type=\"module\""
curl -s https://omnifix.pro/ | grep -n "assets/index"
```

Expected:

- HTTP status is successful.
- Script/module/assets-index checks print nothing.
- The page source contains real feed rows from GitHub activity.

## 7. Rollback

If the new static files are bad, re-upload the previous known-good `dist` snapshot:

```bash
rsync -avz --delete path/to/previous-dist/ user@server:/path/to/web-root/
sudo nginx -t
sudo systemctl reload nginx
```
