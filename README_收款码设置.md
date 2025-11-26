# 收款码设置说明

## 如何添加微信支付收款码图片

1. **准备收款码图片**
   - 将你的微信支付收款码图片保存为 `wechat-pay-qrcode.png`
   - 图片格式支持：PNG、JPG

2. **放置图片文件**
   - 将图片文件放到项目的 `images` 目录下
   - 完整路径：`images/wechat-pay-qrcode.png`

3. **使用网络图片（可选）**
   - 如果你有网络图片URL，可以修改代码中的图片路径
   - 在 `subpackages/store/pages/checkout/index.wxml` 中修改 `qrcode-url` 属性
   - 在 `subpackages/merchant/pages/merchant-orders/index.wxml` 中修改 `qrcode-url` 属性

## 功能说明

- ✅ 支持长按识别二维码（需要本地图片路径）
- ✅ 显示订单信息和金额
- ✅ 支持保存收款码到相册
- ✅ 确认支付功能

## 注意事项

1. **长按识别功能**：
   - 需要在真机上测试（模拟器可能不支持）
   - 图片必须是本地路径才能支持长按识别
   - 如果使用网络图片，系统会自动下载到本地

2. **图片路径**：
   - 本地图片：`/images/wechat-pay-qrcode.png`
   - 网络图片：完整的 HTTP/HTTPS URL

3. **图片大小建议**：
   - 推荐尺寸：300x300 像素或更大
   - 确保二维码清晰可见

## 修改图片路径

如果需要使用其他图片路径，请修改以下文件：

1. `subpackages/store/pages/checkout/index.wxml`（结算页面）
2. `subpackages/merchant/pages/merchant-orders/index.wxml`（商家订单页面）

将 `qrcode-url="/images/wechat-pay-qrcode.png"` 修改为你想要的路径。

