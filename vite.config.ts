import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'

export default defineConfig({
    plugins: [vue(), tailwindcss()],
    root: 'src/webui/frontend',
    base: '/',
    build: {
        outDir: '../../../dist/webui',
        emptyOutDir: true,
    },
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src/webui/frontend')
        }
    },
    server: {
        proxy: {
            '/api': {
                target: 'http://localhost:3456',
                changeOrigin: true
            }
        }
    }
})
