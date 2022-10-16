import { resolve } from 'path'
import { defineConfig, loadEnv } from 'vite'
import Vue from '@vitejs/plugin-vue'
import VueJsx from '@vitejs/plugin-vue-jsx'
import AutoImport from 'unplugin-auto-import/vite'

export default defineConfig(({ mode }) => {
  const ENV = loadEnv(mode, '.') as ImportMetaEnv
  console.log('[ENV]', ENV)

  return {
    server: {
      host: '0.0.0.0',
      port: 4090,
      proxy: {
        [ENV.VITE_API_BASE]: {
          target: ENV.VITE_API_PROXY_TARGET,
          changeOrigin: true,
          rewrite: path =>
            path.replace(new RegExp(`${ENV.VITE_API_BASE}`), ''),
        },
      },
    },

    resolve: {
      alias: [
        {
          find: /^@\//,
          replacement: `${resolve(__dirname, 'src')}/`,
        },
      ],
    },

    plugins: [
      Vue(),
      VueJsx(),
      AutoImport({
        imports: ['vue', '@vueuse/core'],
      }),
    ],
  }
})