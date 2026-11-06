// Canlıya çıkmadan önce yer tutucu ayarların unutulmadığını doğrular.
import { readFileSync } from 'node:fs';
const errors = [];
if (!process.env.PUBLIC_APP_URL || /localhost|127\.0\.0\.1/.test(process.env.PUBLIC_APP_URL))
  errors.push('PUBLIC_APP_URL canlı uygulama adresi olmalı (örn. https://app.alanadiniz.com). "Ücretsiz dene" butonu buraya gider.');
if (readFileSync(new URL('../astro.config.mjs', import.meta.url), 'utf8').includes("https://example.com"))
  errors.push('astro.config.mjs içindeki site adresi hâlâ example.com.');
if (readFileSync(new URL('../public/robots.txt', import.meta.url), 'utf8').includes('example.com'))
  errors.push('public/robots.txt içindeki Sitemap adresi hâlâ example.com.');
if (errors.length) { console.error('Deploy durduruldu:\n- ' + errors.join('\n- ')); process.exit(1); }
