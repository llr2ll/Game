import { defineConfig } from 'vite'

export default defineConfig({
  server: { host: true, allowedHosts: true },
  build: {
    rollupOptions: { input: { main: 'index.html', controller: 'controller.html' } },
  },
})
