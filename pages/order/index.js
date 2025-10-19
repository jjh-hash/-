Page({
  data: {
    orders: [
      {
        id: 1,
        storeName: "红烧牛肉面馆",
        date: "2021.05.01",
        status: "待支付",
        statusClass: "pending",
        img: "https://picsum.photos/seed/noodle/200/120",
        total: 35,
        items: [
          { name: "重庆小面(微辣) x1" },
          { name: "麻辣咸汤红烧金针菇朝鲜面(大份..." }
        ]
      },
      {
        id: 2,
        storeName: "杨师傅的红烧家常菜",
        date: "2021.05.01",
        status: "商家待接单",
        statusClass: "normal",
        img: "https://picsum.photos/seed/stirfry/200/120",
        total: 35,
        items: [
          { name: "干锅豆腐 x1" },
          { name: "红烧扣肉(大份) x1" }
        ]
      },
      {
        id: 3,
        storeName: "小龙虾吸手指",
        date: "2021.05.01",
        status: "骑手已接单",
        statusClass: "normal",
        img: "https://picsum.photos/seed/crayfish/200/120",
        total: 35,
        items: [
          { name: "无敌小龙虾(微辣) x1" },
          { name: "香辣小龙虾 x1" }
        ]
      },
      {
        id: 4,
        storeName: "小店",
        date: "2021.05.01",
        status: "骑手配送中",
        statusClass: "normal",
        img: "https://picsum.photos/seed/shop/200/120",
        total: 35,
        items: [
          { name: "重庆小面(微辣) x1" },
          { name: "咸汤朝鲜面(大份) x1" }
        ]
      }
    ]
  },

  onTabTap(e) {
    const tab = e.currentTarget.dataset.tab;
    if (tab === 'home') {
      wx.navigateTo({
        url: '/pages/home/index'
      });
    } else if (tab === 'profile') {
      wx.navigateTo({
        url: '/pages/profile/index'
      });
    }
  }
});
