import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // 🟢 FIX: Agrega BOM (Byte Order Mark) UTF-8 al HTML para que Chromium/Electron
    // detecte correctamente la codificación incluso cargando desde file://
    {
      name: 'add-utf8-bom',
      enforce: 'post',
      transformIndexHtml(html) {
        return '\uFEFF' + html;
      }
    }
  ],
  base: './',
})
