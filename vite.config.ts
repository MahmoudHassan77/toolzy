import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteStaticCopy } from 'vite-plugin-static-copy'
import { fileURLToPath } from 'url'
import { resolve } from 'path'
import tailwindcss from 'tailwindcss'
import autoprefixer from 'autoprefixer'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

export default defineConfig({
  plugins: [
    react(),
    viteStaticCopy({
      targets: [
        {
          src: resolve(
            __dirname,
            'node_modules/pdfjs-dist/build/pdf.worker.min.mjs'
          ).replace(/\\/g, '/'),
          dest: '',
          rename: 'pdf.worker.min.js',
        },
      ],
    }),
  ],
  css: {
    postcss: {
      plugins: [
        tailwindcss({ config: './tailwind.config.js' }),
        autoprefixer(),
      ],
    },
  },
  optimizeDeps: {
    exclude: ['pdfjs-dist'],
  },
  define: {
    'process.env.NODE_ENV': '"production"',
  },
})
