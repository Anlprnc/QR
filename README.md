# ArızaQR (mini CMMS)

Küçük imalatçılar için QR kodlu makine arıza bildirimi ve bakım takip SaaS'ı.

## Yapı
- `www/`  → Astro statik pazarlama/SEO sitesi (Cloudflare Workers static assets)
- `app/`  → Hono API + React/Vite SPA (Cloudflare Workers + D1), noindex
- `docs/` → Kararlar ve plan notları

## Kararlar
Bkz. `docs/KARARLAR.md`. Tam plan: Claude Docs "QR Arıza ve Bakım Takip SaaS – Proje Planı".

## Geliştirme
```
cd www && npm install && npm run dev
cd app && npm install && npm run dev
```

## Yerel API testi
```
cd app && npx wrangler d1 migrations apply qr-ariza --local
npx wrangler d1 execute qr-ariza --local --file seeds/dev.sql
npx wrangler dev --local
curl localhost:8787/api/q/demo-token-1
```
