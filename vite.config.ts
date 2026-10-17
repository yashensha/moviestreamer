import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import { viteDevApiPlugin } from './viteDevApi.ts'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  // Default to deployed Cloudflare D1 database so localhost and production share the exact same DB.
  // Set VITE_USE_LOCAL_DB=true in .env if you want offline-only local JSON mock.
  const useLocalDb = env.VITE_USE_LOCAL_DB === 'true'

  return {
    plugins: [
      react(),
      tailwindcss(),
      ...(useLocalDb ? [viteDevApiPlugin()] : []),
    ],
    server: {
      proxy: useLocalDb
        ? undefined
        : {
            '/api': {
              target: 'https://moviewatcher.pages.dev',
              changeOrigin: true,
              secure: true,
            },
          },
    },
  }
})


