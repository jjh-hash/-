# 管理端静态托管：单页应用（SPA）回退配置

`admin-web` 使用 **Vue Router History 模式** 且 **`base: '/dist/'`**。打包后只有 `index.html` 与 `assets/*`，不存在 `merchants`、`orders` 等真实文件。直接访问或刷新 `https://域名/dist/merchants` 时，若存储按「路径 = 对象 Key」查找，会 **404 / NoSuchKey**。

**解决思路**：对「找不到的静态路径」仍返回 **`index.html`**（若在云端带 `dist/` 前缀，则返回 **`dist/index.html`**），由浏览器内 Vue 路由接管。

---

## 一、微信云开发 / 腾讯云 CloudBase 静态网站托管

1. 打开 [云开发控制台](https://console.cloud.tencent.com/tcb) → 你的环境 → **静态网站托管**。
2. 进入 **设置** / **基础配置**（不同控制台文案可能为「错误文档」「默认 404 页面」等）。
3. 将 **404 页面 / 错误页面** 设为：
   - 若上传后访问地址为 `https://xxx/dist/index.html`，对象 Key 带前缀 `dist/`：**错误页面填 `dist/index.html`**。
   - 若把 `dist` **里的文件**上传到托管**根目录**（访问为 `https://xxx/index.html`）：**填 `index.html`**。
4. 保存后如仍缓存旧 404，可在控制台 **刷新 CDN 缓存** 后再试。

官方说明见：[静态网站托管 - SPA 应用配置](https://docs.cloudbase.net/cli-v1/hosting)（文档内「Vue History 模式」小节）。

---

## 二、阿里云 OSS（报错含 `NoSuchKey` 时常见）

1. 进入 **Bucket** → **数据管理** / **基础设置** → **静态页面**。
2. 开启 **静态页面**，设置：
   - **默认首页**：与实际上传一致，例如 `dist/index.html` 或 `index.html`。
   - **默认 404 页**：与首页同一路径（**同样填 `dist/index.html` 或 `index.html`**），使任意子路径回退到入口 HTML。
3. 通过 **静态网站域名** 访问（不要只用 OSS 默认下载域名，否则可能不按静态网站规则回退）。

---

## 三、腾讯云 COS（独立对象存储）

1. Bucket → **基础配置** → **静态网站**。
2. **索引文档**：`index.html` 或 `dist/index.html`（与上传目录一致）。
3. **错误文档**：与索引文档相同，或显式指定同一 `index.html` / `dist/index.html`，以实现 SPA 回退（以当前 COS 控制台说明为准）。

---

## 四、自有 Nginx

```nginx
location /dist/ {
  alias /var/www/admin-web-dist/;   # 指向本机 dist 目录内容
  try_files $uri $uri/ /dist/index.html;
}
```

若站点根就是 dist 内容且 URL 无 `/dist` 前缀：

```nginx
location / {
  try_files $uri $uri/ /index.html;
}
```

---

## 五、Netlify / Cloudflare Pages

构建产物 `dist` 部署后，确保 **`public/_redirects`** 已打进包内（Vite 会把 `public/` 下文件复制到 `dist/` 根目录）。本仓库已包含：

```txt
/dist/*  /dist/index.html  200
```

部署根目录需与线上 URL 中 `/dist/` 一致；若你改为根路径部署，请同步改 `vite.config.js` 的 `base` 与 `_redirects` 规则。

---

## 上传目录与错误页对照（易错点）

| 上传方式 | 典型对象 Key | 404 应指向 |
|----------|----------------|------------|
| 只上传 `dist` **内**文件到托管根 | `index.html`、`assets/...` | `index.html` |
| 整包上传到前缀 `dist/` | `dist/index.html`、`dist/assets/...` | **`dist/index.html`** |

你之前的报错 **`Key: dist/merchants`** 说明当前是第二种结构，错误页应配置为 **`dist/index.html`**，而不是根目录的 `index.html`（除非控制台要求写相对「网站根」的路径，以控制台说明为准）。
