# omnifix.pro

Single-page website for [omnifix.pro](https://omnifix.pro), built with Vite and React.

## Local Development

Install dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

## Production Build

Create a production build:

```bash
npm run build
```

## Deploy Output

The static build output is written to:

```text
dist
```

The `dist` directory contains `index.html`, compiled assets, and public files ready to be served by a static web server.

## Hosting Target

This project is intended to be hosted as a static site on nginx.

See [DEPLOY.md](./DEPLOY.md) for a manual VPS/nginx deployment guide.
