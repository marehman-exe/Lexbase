// defineConfig gives TypeScript-aware auto-complete for Vite options.
import { defineConfig } from 'vite'
// React plugin enables JSX transform and Fast Refresh in development.
import react from '@vitejs/plugin-react'
// Tailwind v4 Vite plugin processes utility classes at build time.
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    // Enables React JSX support and hot module replacement.
    react(),
    // Scans source files and emits only the CSS classes actually used.
    tailwindcss(),
  ],
})
