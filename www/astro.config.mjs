import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://example.com', // TODO: alan adı belli olunca güncelle
  integrations: [sitemap()],
  trailingSlash: 'never',
});
