# Deploy omnifix.pro

This guide describes the current static deployment model for `omnifix.pro`.

## Primary Hosting: Cloudflare Pages

The primary hosting target is Cloudflare Pages.

Project settings:

```text
GitHub repository: vetrovk/omnifix.pro
Production branch: main
Build command: npm run build
Build output directory: dist
Node.js version: 24
```

The site is intentionally static and no-JS:

- `npm run build` generates the Live Engineering Feed at build time.
- The deploy output is `dist/`.
- The browser should not load a client-side JavaScript bundle.
- Cloudflare Pages deploys automatically after changes are pushed to `main`.

## GitHub Actions Feed Refresh

The workflow in `.github/workflows/refresh-feed-and-deploy.yml` refreshes the build-time GitHub feed every 6 hours and can also be run manually with `workflow_dispatch`.

The workflow:

- checks out the repository;
- uses Node.js 24;
- runs `npm ci`;
- runs `npm run build`;
- verifies that `dist/` contains no client-side JavaScript bundle;
- commits `data/live-feed.json`, `index.html`, and `dist/` only when generated output changed;
- pushes the commit to `main`.

Cloudflare Pages handles deployment after that push. The workflow does not deploy over SSH and does not call any Cloudflare API.

The feed generator receives the built-in GitHub Actions token through `GITHUB_TOKEN`. No token value is stored in the repository.

## Create The Cloudflare Pages Project

In Cloudflare dashboard:

1. Open **Workers & Pages**.
2. Choose **Create application**.
3. Choose **Pages**.
4. Connect the GitHub repository `vetrovk/omnifix.pro`.
5. Select production branch `main`.
6. Set build command to `npm run build`.
7. Set build output directory to `dist`.
8. Set Node.js version to `24`.
9. Save and deploy.

## DNS Cutover

After the Pages project is created and the first deploy is successful:

1. Add the custom domain `omnifix.pro` to the Cloudflare Pages project.
2. Add `www.omnifix.pro` too, if the `www` host should resolve.
3. Let Cloudflare create or suggest the Pages DNS records.
4. Remove or replace old DNS records that point the public site to the legacy VPS origin.
5. Keep unrelated DNS records unchanged.

Do not add Cloudflare API tokens to this repository for this setup.

## Local Build

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

## No-JS Checks

Before considering a build deployable, verify that no JavaScript bundle is present:

```bash
find dist -type f
find dist -type f -name "*.js"
grep -n "<script" dist/index.html
grep -n "type=\"module\"" dist/index.html
grep -n "assets/index" dist/index.html
```

Expected:

- `find dist -type f` lists only static HTML and image assets.
- `find dist -type f -name "*.js"` prints nothing.
- All `grep` checks print nothing.

## Production Checks

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

## Legacy VPS Deploy Deprecated

The previous VPS/nginx deployment path is deprecated and should not be the primary deployment route.

Keep any existing SSH secrets only if they are still needed for rollback or maintenance. They are no longer required for the primary Cloudflare Pages deployment.

If a temporary rollback to a static server is ever needed, upload only the contents of `dist/` to the server web root:

```bash
rsync -avz --delete dist/ user@server:/path/to/web-root/
```

Do not deploy `node_modules`, source files, feed data files outside `dist/`, documentation, or local/private files.
