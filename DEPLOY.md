# Deploy omnifix.pro to VPS/nginx

This guide describes a manual static deployment for `omnifix.pro`.

## 1. Build Locally

From the project root:

```bash
npm install
npm run build
```

The production files will be generated in:

```text
dist
```

## 2. Upload `dist` Contents to the Server

Create the web root on the VPS:

```bash
sudo mkdir -p /var/www/omnifix.pro
sudo chown -R "$USER":"$USER" /var/www/omnifix.pro
```

Upload the contents of `dist` to the server web root:

```bash
rsync -avz --delete dist/ user@server:/var/www/omnifix.pro/
```

Replace `user@server` with the SSH user and host for the VPS.

## 3. nginx Config Example

Create an nginx server block:

```bash
sudo nano /etc/nginx/sites-available/omnifix.pro
```

Example config:

```nginx
server {
    listen 80;
    listen [::]:80;

    server_name omnifix.pro www.omnifix.pro;

    root /var/www/omnifix.pro;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /assets/ {
        try_files $uri =404;
        add_header Cache-Control "public, max-age=31536000, immutable";
    }
}
```

Enable the site and test nginx:

```bash
sudo ln -s /etc/nginx/sites-available/omnifix.pro /etc/nginx/sites-enabled/omnifix.pro
sudo nginx -t
sudo systemctl reload nginx
```

## 4. certbot SSL Example

Install certbot if it is not already available:

```bash
sudo apt update
sudo apt install certbot python3-certbot-nginx
```

Issue and install the certificate:

```bash
sudo certbot --nginx -d omnifix.pro -d www.omnifix.pro
```

## 5. Reload nginx

After future uploads or config changes:

```bash
sudo nginx -t
sudo systemctl reload nginx
```
