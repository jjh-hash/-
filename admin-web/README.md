# 校园外卖 · Web 管理端

```bash
npm install
npm run dev      # 本地 http://localhost:5174/dist/
npm run build    # 产物在 dist/，上传 dist 内文件到静态托管
```

**History 路由刷新 404**：必须在托管侧配置 SPA 回退，见 [docs/静态托管-SPA回退.md](./docs/静态托管-SPA回退.md)。

云环境 ID 与小程序一致：`src/config.js` 中 `CLOUDBASE_ENV`。
