// @ts-check
import { defineConfig } from 'astro/config';
import node from '@astrojs/node';
import tailwindcss from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';
import { fileURLToPath } from 'url';
import path from 'path';

// https://astro.build/config
export default defineConfig({
  output: 'server',
  adapter: node({
    mode: 'middleware'
  }),
  vite: {
    plugins: [tailwindcss()],
    resolve: {
      alias: {
        'file-type': path.resolve(fileURLToPath(import.meta.url), '../node_modules/file-type/index.js')
      }
    },
    ssr: {
      external: ['payload', 'path', 'fs', 'file-type']
    },
    build: {
      rollupOptions: {
        external: [/payload\.config\.ts/]
      }
    }
  },
  i18n: {
    defaultLocale: 'es',
    locales: ['es', 'ca', 'en', 'fr', 'de'],
    routing: {
      prefixDefaultLocale: true
    }
  },
  integrations: [sitemap()],
  site: 'https://warynessy.com'
});
