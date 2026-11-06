# Canlıya alma (ücretsiz katman)

Hiçbir adım ücret gerektirmez. **Workers Paid ($5/ay) ve ücretli e-posta/alan adı planları gerekmez**;
ücretli bir şeye geçmeden önce karar sizindir. Aşağıdakilerin hepsi ücretsiz katmanda çalışır:
Cloudflare Workers + D1 + Turnstile, Resend (günlük 100 e-posta). Alan adı opsiyoneldir: `*.workers.dev`
adresi ücretsizdir (kendi alan adınız için yıllık ücret ödemeniz gerekir).

Sınırlar: Workers 100 bin istek/gün ve 10 ms CPU/istek (bkz. `KARARLAR.md`). Limit dolarsa servis
ücretlendirilmez, istekler hata verir.

## 1. Cloudflare girişi
```
cd app && npx wrangler login
```

## 2. Veritabanı (D1, ücretsiz)
```
npx wrangler d1 create qr-ariza
```
Çıkan `database_id` değerini `app/wrangler.jsonc` içindeki `TODO` yerine yazın, sonra:
```
npx wrangler d1 migrations apply qr-ariza --remote
```

## 3. Sırlar
```
npx wrangler secret put AUTH_PEPPER          # uzun rastgele bir metin; boş bırakmayın
npx wrangler secret put RESEND_API_KEY       # resend.com ücretsiz hesap; yoksa e-postalar gönderilmez
npx wrangler secret put MAIL_FROM            # "ArızaQR <giris@alanadiniz.com>" (Resend'de doğrulanmış alan adı)
npx wrangler secret put TURNSTILE_SECRET     # Cloudflare paneli > Turnstile (ücretsiz)
```
`TURNSTILE_SITE_KEY` gizli değildir; `app/wrangler.jsonc` içine `"vars": { "TURNSTILE_SITE_KEY": "..." }` olarak ekleyin.
Giriş kodu e-postayla gideceği için Resend olmadan canlıda kimse giriş yapamaz.

## 4. Uygulamayı yayınlayın
```
cd app && npm run build && npm run deploy
```

## 5. Pazarlama sitesi
`www/astro.config.mjs` ve `www/public/robots.txt` içindeki `example.com` değerini gerçek adresle değiştirin,
sonra uygulamanın adresiyle:
```
cd www && PUBLIC_APP_URL=https://qr-ariza-app.<hesap>.workers.dev npm run deploy
```
`npm run deploy` yer tutucu ayar kalmışsa durur (`scripts/check-deploy.mjs`).

## 6. Yayın sonrası kontrol
```
BASE=https://<uygulama-adresi>/api node app/scripts/smoke.mjs   # yalnızca yerelde: giriş kodunu log'dan okur
```
Canlıda smoke betiği kullanılamaz (kod e-postayla gider); elle giriş yapıp şunlara bakın: makine ekle, QR'ı telefonla
okut, arıza bildir, e-posta geldi mi, `/api/export/tickets.csv` iniyor mu.
