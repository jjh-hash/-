import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// 静态网站托管在子目录 /dist/ 时（方案 B），资源路径需带此前缀，否则根路径 /assets/* 会 404
export default defineConfig({
  base: '/dist/',
  plugins: [vue()],
  server: {
    port: 5174
  }
})
