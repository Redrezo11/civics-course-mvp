import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'

export default defineConfig({
  plugins: [svelte()],
  base: './', // relative paths — required for GitHub Pages, and for a future cmi5 package
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
  },
})
