import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  site: 'https://example.com', // TODO: alan adı belli olunca güncelle
  integrations: [react(), sitemap()],
  trailingSlash: 'never',
  vite: { plugins: [tailwindcss()] },
});
