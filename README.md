# omnifix.pro

Static single-page website for [omnifix.pro](https://omnifix.pro): a personal engineering hub for AI systems, automation, open source work, and production experiments.

## Architecture

The production site is intentionally static and no-JS:

- `index.html` is the main standalone page.
- CSS and SVG visuals are inline.
- The right orbit/neural animation is CSS/SVG-only.
- There is no React runtime in production.
- There is no client-side JavaScript bundle.
- The production output is expected to contain only `dist/index.html` and `dist/omnifix-github-avatar-round-o.png`.

The Vite build is kept as a simple static build step, not as a React app runtime.

## Live Engineering Feed

The Live Engineering Feed is generated at build time by `scripts/generate-live-feed.mjs`.

The generator reads public GitHub activity for `vetrovk` and writes:

```text
data/live-feed.json
```

It then updates the managed feed block in `index.html` between:

```html
<!-- live-feed:start -->
<!-- live-feed:end -->
```

The generated HTML is static. The browser does not fetch GitHub and does not run client-side JavaScript.

### GitHub Token

`GITHUB_TOKEN` is optional.

If present, the generator uses it for GitHub API requests:

```bash
GITHUB_TOKEN=... npm run generate:feed
```

If the token is missing, public GitHub API access is used.

If GitHub API access fails, rate limits, or returns no usable activity, the generator falls back to:

```text
data/live-feed-fallback.json
```

The build should continue to pass when GitHub is unavailable.

## Local Commands

Install dependencies:

```bash
npm install
```

Generate the feed only:

```bash
npm run generate:feed
```

Build the static output:

```bash
npm run build
```

`npm run build` runs feed generation first, then builds `dist`.

Start the local Vite preview/dev server:

```bash
npm run dev
```

## Production Output

The deployable static output is:

```text
dist
```

Expected no-JS checks:

```bash
find dist -type f
find dist -type f -name "*.js"
grep -n "<script" dist/index.html
grep -n "type=\"module\"" dist/index.html
grep -n "assets/index" dist/index.html
```

The `find ... "*.js"` and `grep` commands should return no matches.

## Deployment

Production hosting is a static nginx site. See [DEPLOY.md](./DEPLOY.md) for the manual VPS/nginx deployment guide.
