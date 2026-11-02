# QR Arıza ve Bakım Takip (mini CMMS)

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
