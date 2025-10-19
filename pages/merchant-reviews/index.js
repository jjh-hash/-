Page({
  data: {
    statusBarHeight: wx.getWindowInfo().statusBarHeight || 20,
    activeTab: 1, // 默认选中"全部评价"
    reviews: [
      {
        id: 1,
        username: '萝卜特·汤尼',
        avatar: 'https://picsum.photos/seed/user1/80/80',
        date: '2022.10.1',
        rating: 5,
        content: '色香味俱全,太好吃了,已经好久没有吃过这么好吃的东西了,必须给老板点赞!',
        images: [
          'https://picsum.photos/seed/food1/160/160',
          'https://picsum.photos/seed/food2/160/160',
          'https://picsum.photos/seed/food3/160/160'
        ],
        reply: '感谢亲的光临,亲的光顾和满意,就是对小店最好的支持,最大的赞美,我们会保持本心,最好美食,欢迎亲的下次光临。'
      },
      {
        id: 2,
        username: '美食达人小王',
        avatar: 'https://picsum.photos/seed/user2/80/80',
        date: '2022.9.28',
        rating: 4,
        content: '味道不错，分量很足，就是配送时间稍微长了一点。',
        images: [],
        reply: ''
      },
      {
        id: 3,
        username: '吃货小李',
        avatar: 'https://picsum.photos/seed/user3/80/80',
        date: '2022.9.25',
        rating: 5,
        content: '超级好吃！强烈推荐！',
        images: [
          'https://picsum.photos/seed/food4/160/160'
        ],
        reply: '谢谢亲的推荐！我们会继续努力的！'
      }
    ]
  },

  onBack() {
    wx.navigateBack();
  },

  onTabTap(e) {
    const index = e.currentTarget.dataset.index;
    this.setData({ activeTab: index });
    
    if (index === 0) {
      // 未回复的评价
      wx.showToast({ title: '显示未回复评价', icon: 'none' });
    } else {
      // 全部评价
      wx.showToast({ title: '显示全部评价', icon: 'none' });
    }
  }
});
