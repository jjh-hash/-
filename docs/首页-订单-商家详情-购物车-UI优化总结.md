# 首页、订单页、商家详情页、购物车 UI 优化总结

本文档总结基于 **《配色设计文档》**（`docs/配色设计文档.md`）对以下四个核心页面的 UI 优化方式，便于后续维护与扩展时保持一致的设计语言。

---

## 一、设计依据与全局变量

- **设计原则**：主色（橙/暖黄 `#FFB800`）控制品牌感；副色蓝用于次要操作；次色灰用于背景、边框与文字层级；强调色用于状态（成功绿、警告橙、危险红）。
- **全局变量**：所有页面统一使用 `app.wxss` 中的 CSS 变量，包括：
  - **主色**：`--color-primary`、`--color-primary-light`
  - **副色**：`--color-secondary`、`--color-secondary-light`
  - **次色**：`--color-text`、`--color-text-secondary`、`--color-text-placeholder`、`--color-bg-page`、`--color-bg-card`、`--color-border`
  - **强调色**：`--color-success`、`--color-warning`、`--color-danger`
  - **通用**：`--radius-card`、`--radius-btn`、`--radius-tag`、`--shadow-card`、`--space-page`、`--transition-fast` 等

---

## 二、首页（`pages/home/`）

### 2.1 整体与背景

- **页面背景**：使用 `var(--color-bg-page)`（暖黄/杏色底），与主色橙黄统一。
- **顶部区域**：轮播区高度 220px，底部圆角 24px，营造沉浸感；占位图使用设计文档中的「金与蓝」渐变（`#FFC870` → `#87BDFF` → `#DBEAFF`）。

### 2.2 顶部元素

- **悬浮问候语**：白色文字 + 阴影，适配各种轮播图背景。
- **悬浮搜索栏**：白底、圆角 22px、阴影，聚焦时阴影加深；图标与占位符使用 `--color-text-placeholder`，输入文字使用 `--color-text`。

### 2.3 分区与标题

- **分区标题**：左侧 4px 竖条使用 `--color-primary`（主色），标题文字 `--color-text`；「限时特惠」等强调分区可用 `--color-danger` 竖条（`.section-dot-red`）。

### 2.4 常用服务卡片

- **大卡片**：白底或深色渐变（如外卖/食堂），圆角 `--radius-card`，阴影统一；深色卡内文字用白色并带轻微阴影。
- **代拿快递**：背景 `var(--color-secondary-light)`（副色浅蓝），与设计文档一致。
- **跳蚤市场**：背景 `#FFEEE2`（主色 50 浅底），与主色系呼应。
- **游戏陪玩**：底部横条使用 `var(--color-secondary-light)`，与代拿统一蓝系。
- **链接与箭头**：使用 `--color-primary`，保持主色点击反馈。

### 2.5 筛选与分类

- **今日推荐 + 排序**：筛选区白底卡片、圆角、阴影；「推荐/销量/低价优先」斜切胶囊，选中态 `background: var(--color-primary)`、白字。
- **分类栏**：斜切连排样式，选中项主色背景 + 白字，与排序 tab 风格一致。

### 2.6 店铺列表

- **店铺卡片**：`--color-bg-card`、`--radius-card`、`--shadow-card`；封面与信息区间分割线 `--color-border`。
- **角标/标签**：商家角标使用 `--color-primary` 背景；「进店」等入口文字 `--color-primary`。
- **骨架屏**：覆盖在列表上方，背景与卡片统一使用设计变量。

---

## 三、订单页（`pages/order/` 与子包订单页）

### 3.1 顶栏与 Tab

- **顶栏**：白底 `--color-bg-card`，标题 `--color-text`，底部分割线 `--color-border`。
- **分类 Tab**（全部订单 / 代拿快递 / 游戏陪玩）：未选中为 `--color-bg-page` + `--color-text-secondary`；选中为 `--color-primary` 背景 + 白字，圆角 `--radius-tag`。

### 3.2 订单卡片

- **卡片容器**：`--color-bg-card`、`--radius-card`、`--shadow-card`、边框 `--color-border`。
- **店铺名/日期**：主标题 `--color-text`，副文 `--color-text-secondary`。
- **订单状态**：待支付 `--color-warning`，已取消 `--color-danger`，普通状态 `--color-text`。
- **商品列表区**：背景 `--color-bg-page`，圆角 `--radius-btn`，内边距统一。
- **退款状态条**：背景 `--color-primary-light`，左边框 `--color-primary`；退款中/成功/拒绝分别用 `--color-warning`、`--color-success`、`--color-danger`。
- **超时/预计送达**：背景 `--color-primary-light`，左边框 `--color-warning`；超时文案 `--color-danger`，送达文案 `--color-success`。

### 3.3 订单底部操作

- **总价**：`--color-text`，字重加粗。
- **按钮**：取消/再来一单为白底 + `--color-border` 边框；去支付/联系商家为主色 `--color-primary`；申请退款为 `--color-danger`。

### 3.4 底部 Tab 栏

- **容器**：白底、顶部分割线 `--color-border`，安全区 `env(safe-area-inset-bottom)`。
- **选中态**：图标与文字使用 `--color-primary`；未选中 `--color-text-placeholder`。

---

## 四、商家详情页（`subpackages/store/pages/store-detail/`）

### 4.1 顶栏与店铺信息

- **状态栏与顶栏**：背景 `--color-primary`，白字，与主色统一。
- **店铺信息卡片**：`--color-bg-card`、`--radius-card`、`--shadow-card`；店名 `--color-text`，统计与描述 `--color-text-secondary`，公告标签 `--color-primary` 文字 + `--color-primary-light` 背景。

### 4.2 标签页（商品 / 评价）

- **Tab 导航**：白底、底部分割线 `--color-border`；未选中 `--color-text-secondary`，选中 `--color-primary` 加粗 + 底部主色指示条（`::after`）。
- **温馨提示**：小号字、`--color-text-placeholder`。

### 4.3 商品区（左侧分类 + 右侧列表）

- **左侧分类**：背景 `--color-bg-card`，分割线 `--color-border`；选中项 `--color-primary-light` 背景 + 左侧主色竖条，分类名 `--color-text-secondary`；角标数字用 `--color-primary` 圆形背景。
- **右侧商品**：卡片白底、分割线 `--color-border`；商品名 `--color-text`，副文 `--color-text-placeholder`，价格 `--color-primary`。
- **加减与规格**：减号按钮白底 + `--color-border`；加号/规格按钮主色 `--color-primary`，数量数字主色。

### 4.4 评价区

- **评分与星级**：主色 `--color-primary`（替代原蓝色），与文档「主色用于选中、强调」一致。
- **商家回复、评论内容**：正文 `--color-text`，副文 `--color-text-placeholder`；「写评论」等按钮主色背景。

### 4.5 底部购物车与结算栏

- **购物车栏**：主色 `--color-primary` 强调，数量角标主色。
- **去结算按钮**：主色背景、白字，与全局主按钮风格一致。

### 4.6 骨架屏与弹层

- **骨架屏**：卡片、Tab、分类、商品列表均使用 `--color-bg-card`、`--color-border`，动画灰度在色板内。
- **弹层**：标题与分割线使用设计变量；主操作按钮主色，取消类边框与文字使用次色。

---

## 五、购物车页（`pages/cart/`）

### 5.1 页面与列表

- **页面**：背景 `--color-bg-page`，整页 flex 布局，内容区可滚动。
- **按店分组**：每个店铺块为白底卡片 `--color-bg-card`、`--radius-card`、`--shadow-card`、边框 `--color-border`；店铺头与商品区间分割线 `--color-border`。
- **店铺名**：`--color-text`，箭头 `--color-text-placeholder`。

### 5.2 商品行

- **商品信息**：名称 `--color-text`，规格等副文 `--color-text-placeholder`；价格 `--color-primary` 加粗。
- **数量控件**：边框 `--color-border`，背景 `--color-bg-card`；点击态 `--color-primary-light`。
- **删除**：右上角独立删除按钮，文字 `--color-danger`，点击态浅红底，强化「危险操作」识别。

### 5.3 店铺底部与去结算

- **配送费/小计**：提示 `--color-text-placeholder`，小计 `--color-text`。
- **去结算按钮**：未选满为灰 `--color-border` + `--color-text-placeholder`；选满为 `--color-primary` 背景 + 白字，带主色阴影。

### 5.4 底部统一付款栏

- **容器**：白底、圆角、`--shadow-card`、`--color-border`。
- **总价**：`--color-text`，字重 700。
- **结算按钮**：`--color-primary` 背景、白字、主色阴影，与首页/商家详情结算栏一致。

### 5.5 空状态

- **图标与文案**：主文案 `--color-text`，说明 `--color-text-placeholder`。
- **去逛逛**：主色按钮 `--color-primary`，与全局主按钮一致。

---

## 六、优化方式归纳

| 维度       | 做法说明 |
|------------|----------|
| **去硬编码** | 所有页面将原先的固定色值（如 `#333`、蓝色、灰色）替换为 `app.wxss` 中的设计变量。 |
| **主色统一** | 顶栏、Tab 选中、主按钮、结算栏、链接、评分与星级等统一使用 `--color-primary`（暖黄）。 |
| **状态语义化** | 待支付/警告用 `--color-warning`，成功用 `--color-success`，取消/删除用 `--color-danger`。 |
| **层次与背景** | 页面底用 `--color-bg-page`，卡片用 `--color-bg-card`，分割与边框用 `--color-border`。 |
| **文字层级**   | 标题/正文 `--color-text`，副文 `--color-text-secondary`，占位/提示 `--color-text-placeholder`。 |
| **圆角与阴影** | 卡片/按钮/标签统一使用 `--radius-card`、`--radius-btn`、`--radius-tag` 与 `--shadow-card`。 |
| **副色用法**   | 代拿快递、游戏陪玩等次要模块使用 `--color-secondary-light` 或主色浅底，不抢主色。 |

后续新增页面或组件时，可参照本文档与《配色设计文档》直接使用同一套变量，保持整站视觉一致。
