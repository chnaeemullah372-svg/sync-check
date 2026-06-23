# VPS deployment

This app runs as two Node/Nitro processes behind Nginx:

- public site: `APP_SURFACE=public`, `127.0.0.1:3100`
- admin panel: `APP_SURFACE=admin`, `127.0.0.1:3101`

Nginx maps:

- `punjab-case-management.live` and `www.punjab-case-management.live` -> public process
- `admin.punjab-case-management.live` -> admin process

The server entry also enforces host/surface separation:

- public surface returns 404 for `/admin/*` and `/card/admin`
- admin surface returns 404 for `/user/*`
- admin surface redirects `/` to `/card/admin`

## Required server-only files

Create these on the VPS; do not commit real values:

- `/etc/punjab-case-management/public.env`
- `/etc/punjab-case-management/admin.env`

Use `deploy/env/production.env.example` as the template. Both files need the same Supabase values. Set `APP_SURFACE=public` in `public.env` and `APP_SURFACE=admin` in `admin.env`.

## Build and start

```bash
npm install --no-package-lock
npm run build:node
sudo systemctl enable --now punjab-case-management-public
sudo systemctl enable --now punjab-case-management-admin
```

## SSL

After DNS A records point to the VPS, run Certbot for all three names:

```bash
sudo certbot --nginx \
  -d punjab-case-management.live \
  -d www.punjab-case-management.live \
  -d admin.punjab-case-management.live
```
