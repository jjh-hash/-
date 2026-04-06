# 校园外卖 - 交互逻辑 / UI·UX / 性能优化 全面彻查报告

> 对照《交互逻辑设计评审》《UI与体验重设计计划》《微信小程序性能优化计划》及《问题修改总结文档》，对全项目进行逐项核查。  
> 彻查日期：2026-02-17

---

## 一、交互逻辑设计 — 核查结果

### 1.1 已落实项（与《问题修改总结文档》一致）

| 项 | 状态 | 说明 |
|----|------|------|
| 订单/历史订单统一 | ✅ | 个人中心「历史订单」→ 分包订单页；my-orders onLoad 重定向至分包订单页 |
| 主包订单/接单重定向 | ✅ | pages/order、pages/receive-order 的 onLoad 均 redirectTo 至分包对应页 |
| 我的信息入口 | ✅ | 个人中心、app.js fallback 均指向 `/subpackages/common/pages/user-info-setting/index` |
| 消息页/结算页/checkout 订单跳转 | ✅ | 均跳分包订单页；支付成功带 `from=pay&orderId` 高亮 |
| 分包代拿/游戏/悬赏发布成功 | ✅ | Toast「发布成功，已为您打开任务大厅」+ reLaunch 至 receive-order |
| 订单详情统一 | ✅ | 订单列表 onOrderTap 仅跳分包 order-detail；my-orders 亦用分包 order-detail |
| 任务大厅 vs 接单端文案 | ✅ | profile 中「任务大厅」副文案「接代拿、陪玩、悬赏任务」，「切换到接单端」副文案「接配送单、送餐」 |
| 联系客服复制 | ✅ | profile 弹窗「复制微信号」+ `wx.setClipboardData`，Toast「已复制到剪贴板」 |
| 用户端底部栏组件化 | ✅ | user-tab-bar 已接入首页、个人中心、订单页、任务大厅 |
| 商家端登录后进工作台 | ✅ | merchant-login 成功后 reLaunch 至 merchant-workbench |
| 商家修改密码成功后 | ✅ | Toast「密码已修改，请重新登录」+ reLaunch 至 merchant-login |
| 骑手端个人中心「设置」 | ✅ | rider-profile 的 onSetting 已 navigateTo 至 rider-settings |
| 个人中心「管理端」入口 | ✅ | profile 中已有「管理端」菜单项（menu-desc「管理员登录与后台」） |

### 1.2 未落实 / 待统一项

| 优先级 | 问题 | 位置 | 建议 |
|--------|------|------|------|
| ~~中~~ | ~~主包代拿/游戏/悬赏发布成功后仍跳「订单页」~~ | ~~pages/express、gaming、reward~~ | **已修复**：已改为 Toast「发布成功，已为您打开任务大厅」+ reLaunch 至 receive-order |
| ~~低~~ | ~~主包订单页失败降级时仍含完整 Watch/轮询~~ | ~~pages/order/index.js~~ | **已修复**：主包页仅重定向；失败时仅 loadOrders 一次并 Toast「请从底部「订单」进入完整订单页」，已移除 Watch/轮询及所有定时器 |

---

## 二、UI/UX 设计 — 核查结果

### 2.1 已使用设计系统（ds-* / var(--color-*) / --radius-* / --space-*）的页面

以下页面 wxss 中已出现设计变量或 ds- 类（来自 grep 与《问题修改总结文档》）：

- **用户端**：首页、个人中心、订单、任务大厅、店铺详情、结算、代拿、我的信息、店铺列表、分类、地址/新增地址、关于、评价三页、聊天、消息、**二手列表、二手详情、二手发布** — 已全覆盖
- **商家端**：登录、工作台、设置、修改密码、订单、商品、退款详情、注册、类目、店铺信息、销量统计、公告、相册、评价、新增商品、mine、info — 已全覆盖
- **骑手端**：首页、个人中心、设置、登录、收入、反馈、注册、统计、订单 — 已全覆盖
- **管理员端**：数据概况、商家列表、订单列表、订单详情、用户列表、设置、商家详情、公告、财务、日志、批量审核、换密、骑手列表、banner 编辑、用户详情、退款详情、统计、仪表盘、**个人资料、管理首页** — 管理端已全覆盖设计变量
- **组件**：user-tab-bar

### 2.2 未或仅部分使用设计系统的页面

| 端 | 说明 |
|----|------|
| 用户端 / 商家端 / 骑手端 / 管理员端 | **已全覆盖**：设计变量（var(--color-*)、--radius-*、--shadow-card）已接入全项目主要页面，含二手三页、admin-profile、admin-management |

### 2.3 体验增强 — 已落实

| 项 | 状态 | 说明 |
|----|------|------|
| 骨架屏 | ✅ 已提供 + 三列表已接入 | `app.wxss` 中 ds-skeleton* 类；**首页店铺列表、订单列表、任务大厅** 首屏加载时已展示骨架，其余列表页可按需接入 |
| 错误与空状态 | ✅ 已统一 | `ds-empty`（已有）、`ds-error`（新增：图标+标题+描述+重试按钮），网络错误/无权限等可复用 |
| 加载态统一 | ✅ 已提供 | `ds-loading`、`ds-loading-spinner`、`ds-loading-btn`，列表底部与按钮 loading 可统一使用 |

---

## 三、性能优化 — 核查结果

### 3.1 已落实项

| 项 | 状态 | 说明 |
|----|------|------|
| preloadRule | ✅ | app.json 已配置：首页预下载 order/store，个人中心预下载 common，订单页预下载 store |
| 生产环境 console 收敛 | ✅ | utils/logger.js 已建；订单页、首页、任务大厅、**店铺详情、结算、商家订单、管理端订单/用户/商家列表、admin-profile** 已改用 logger |
| 订单页（分包）Watch/轮询与清理 | ✅ | 定时器改为实例变量并在 onHide/onUnload 中 _clearTimers；轮询间隔 10s；stopPolling/stopOrderWatch 正确 |
| 订单页 setData 合并 | ✅ | loadOrders 一次 setData orders/allOrders/filteredOrders/loading，_filterByCategory 复用 |
| 订单页 onShow 防重 | ✅ | 无数据或距上次 >60s 才 loadOrders，_ordersLastLoadTime 记录 |
| 首页请求顺序与防重 | ✅ | onLoad 先 loadStores 再 loadBanners；已有 loadingStores/loadingBanners 防重与 1 分钟刷新 |
| 任务大厅 onShow 防重 | ✅ | 30s 或无数据才 loadOrders，_ordersLastLoadTime |
| 商家评价 onShow 防重 | ✅ | 60s 内不重复请求，_reviewsLastLoadTime |
| 图片懒加载 | ✅ | 首页/订单/任务大厅/校园超市等已加；**店铺详情、评价列表、商家订单** 列表内 image 已补 lazy-load |
| 长列表分页 | ✅ | **用户订单页、任务大厅、首页店铺列表** 已分页（page/pageSize、onReachBottom 加载更多、单次 setData 当前页或增量） |

### 3.2 未落实 / 待做项

| 优先级 | 项 | 建议 |
|--------|-----|------|
| ~~高~~ | ~~其余页面与云函数仍大量使用 console~~ | **已做**：关键页已改用 logger；云函数可后续逐步改 |
| ~~高~~ | ~~长列表未分页~~ | **已做**：用户订单页、任务大厅、首页店铺列表已分页（page/pageSize、onReachBottom 加载更多、单次 setData 当前页或增量）；评价列表等可后续按需加分页 |
| ~~中~~ | ~~店铺详情、评价列表、商家订单等列表图片~~ | **已做**：上述列表内 image 已加 lazy-load |
| ~~中~~ | ~~云函数内 console~~ | **已做**：getStoreList、loginUser 已改为条件输出（NODE_ENV !== 'production' 才 log/warn）；其余云函数可后续按需改 |
| ~~中~~ | ~~骨架屏与统一加载态~~ | **已推进**：类已在 app.wxss；**首页、订单列表、任务大厅** 已接入骨架屏；其余列表页可按需接入 |
| ~~中~~ | ~~商家订单页定时器存 data~~ | **已做**：merchant-orders 定时器已改为实例变量，onHide/onUnload 中 _clearTimers |
| ~~低~~ | ~~云函数聚合与索引~~ | **已推进**：已新增《云开发数据库索引建议.md》，列出各集合建议索引；首页聚合接口可后续按需做 |
| ~~低~~ | ~~globalData 与内存~~ | **已做**：已排查，globalData 仅存 userInfo/openid/token/标志等小对象，无大列表 |

### 3.3 定时器/轮询清理核查

| 页面 | 定时器/轮询 | onHide/onUnload 清理 | 备注 |
|------|-------------|----------------------|------|
| 分包 order/index | Watch、轮询、_refreshTimer/_reconnectTimer/_scrollTimer | ✅ _clearTimers + stopOrderWatch + stopPolling | 已优化 |
| 主包 order/index | 失败降级时有 Watch/轮询 | 有 stopOrderWatch/stopPolling | 建议主包仅重定向，不做完整逻辑 |
| receive-order | timeTimer (setInterval) | ✅ onHide/onUnload 中 clearInterval | 已做 |
| merchant-orders | _pollingTimer、_refreshTimer、_reconnectTimer、_scrollTimer | ✅ onHide/onUnload 中 stopPolling/stopOrderWatch + _clearTimers | 已改为实例变量 |
| admin-profile | uptimeTimer | ✅ onUnload 中 clearInterval | 已做 |
| rider-login | setInterval 倒计时、reLaunch setTimeout | ✅ onHide/onUnload 中 clearTimer；onUnload 中 clearTimeout(loginTimeout) | 已做 |

---

## 四、汇总：建议优先补齐项

### 交互逻辑（2 项）— 均已落实

1. **主包 express/gaming/reward 发布成功**：已改为 Toast「发布成功，已为您打开任务大厅」+ `reLaunch` 至 `receive-order`。
2. **主包 order 失败降级**：已简化；redirectTo 失败时仅 loadOrders 一次并提示，已移除 Watch/轮询及定时器。

### UI/UX（按阶段推进）

1. **设计变量覆盖**：✅ **已全部完成**。用户端（含二手列表/详情/发布）、商家端、骑手端、管理端（含 admin-profile、admin-management）均已接入 app.wxss 设计变量与 ds- 类。
2. **体验**：骨架屏（ds-skeleton*）、错误/空状态（ds-empty、ds-error）、加载态（ds-loading*）已在 app.wxss 提供；**首页店铺列表、订单列表、任务大厅** 已接入骨架屏，其余页可按需接入。

### 性能（按优先级）

1. **高**：~~更多页面改用 logger~~、~~长列表分页与 setData 瘦身~~、~~云函数 console~~ 已做（getStoreList、loginUser 已条件输出）；其余云函数可后续改。
2. **中**：~~店铺详情/评价/商家订单列表图片 lazy-load~~、~~商家订单页定时器改为实例变量~~、~~骨架屏~~ 已做（首页、订单列表、任务大厅已接入）；加载态类已提供，可按需接入。
3. **低**：~~云函数聚合与索引~~（已出索引建议文档）、~~globalData 排查~~（已排查，无大对象）已做。

---

## 五、文档与后续

- 本报告基于当前代码与三份计划逐项核对，**设计变量覆盖项已全部完成**。用户端（含二手）、商家端、骑手端、管理端主要页面均已接入 app.wxss 设计系统。
- 每完成一批修改，已在《问题修改总结文档》中新增条目，注明涉及文件，便于回溯。
- 若需对某一类（仅交互 / 仅 UI / 仅性能）做单线整改，可参考本报告中对应章节的「未落实项」与「汇总」建议。当前可后续按需推进的项：评价列表分页、更多云函数条件 console、首页聚合接口等。
