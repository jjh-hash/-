Page({
  data: {
    statusBarHeight: wx.getWindowInfo().statusBarHeight || 20,
    activeFilter: 0,
    filters: ["综合排序", "销量", "星级", "距离"],
    quickCats: [
      { text: "代拿快递", emoji: "📦", bg: "#ffebee" },
      { text: "学校食堂", emoji: "🍜", bg: "#e3f2fd" },
      { text: "生鲜水果", emoji: "🍓", bg: "#fff3e0" },
      { text: "校园超市", emoji: "🛒", bg: "#e8f5e9" },
      { text: "奶茶果汁", emoji: "🥤", bg: "#ede7f6" },
      { text: "游戏陪玩", emoji: "🎮", bg: "#e0f2fe" },
      { text: "闲置出售", emoji: "🛍️", bg: "#fef3c7" },
      { text: "悬赏", emoji: "🏷️", bg: "#e9d5ff" }
    ],
    banners: [
      { id: 1, title: "秋口食物流", subtitle: "大牌西餐6折起", bg: "linear-gradient(90deg,#eaf3ff,#fff)" },
      { id: 2, title: "校园美食节", subtitle: "全场8折优惠", bg: "linear-gradient(90deg,#fef3c7,#fff)" },
      { id: 3, title: "新品上市", subtitle: "限时特价", bg: "linear-gradient(90deg,#e0f2fe,#fff)" }
    ],
    shops: [
      { id: 1, img: "https://picsum.photos/seed/a/200/120", name: "麻辣酸菜鱼嘎嘎香的那种", score: 4.9, month: 401, start: 17, delivery: 3 },
      { id: 2, img: "https://picsum.photos/seed/b/200/120", name: "小杨麻辣羊肉串", score: 4.0, month: 391, start: 15, delivery: 1.5 },
      { id: 3, img: "https://picsum.photos/seed/c/200/120", name: "古法秘制酱香猪蹄", score: 4.9, month: 391, start: 17, delivery: 3 }
    ]
  },

  onTabTap(e) {
    const tab = e.currentTarget.dataset.tab;
    if (tab === 'order') {
      wx.navigateTo({
        url: '/pages/order/index'
      });
    } else if (tab === 'profile') {
      wx.navigateTo({
        url: '/pages/profile/index'
      });
    }
  },

  onQuickCatTap(e) {
    const index = e.currentTarget.dataset.index;
    const cat = this.data.quickCats[index];
    
    if (cat.text === '学校食堂') {
      wx.navigateTo({
        url: '/pages/canteen/index'
      });
    } else if (cat.text === '生鲜水果') {
      wx.navigateTo({
        url: '/pages/fruits/index'
      });
    } else if (cat.text === '悬赏') {
      wx.navigateTo({
        url: '/pages/reward/index'
      });
    } else if (cat.text === '游戏陪玩') {
      wx.navigateTo({
        url: '/pages/gaming/index'
      });
    } else if (cat.text === '代拿快递') {
      wx.navigateTo({
        url: '/pages/express/index'
      });
    } else if (cat.text === '奶茶果汁') {
      wx.navigateTo({
        url: '/pages/drinks/index'
      });
    } else if (cat.text === '闲置出售') {
      wx.navigateTo({
        url: '/pages/secondhand/index'
      });
    } else if (cat.text === '校园超市') {
      wx.navigateTo({
        url: '/pages/store/index'
      });
    }
    // 可以在这里添加其他分类的跳转逻辑
  }
});

