Page({
  data: {
    statusBarHeight: wx.getWindowInfo().statusBarHeight || 20,
    activeTab: 1, // 默认选中评价标签
    tabs: ['点餐', '评价', '商家'],
    storeInfo: {
      name: '意大利特火小面条馆',
      overallRating: 4.8,
      deliveryRating: 4.8,
      totalReviews: 24
    },
    activeFilter: 'all',
    filters: [
      { id: 'all', name: '全部', count: 24, active: true },
      { id: 'good', name: '好评', count: 23, active: false },
      { id: 'neutral', name: '中评', count: 0, active: false },
      { id: 'bad', name: '差评', count: 1, active: false }
    ],
    subFilters: [
      { id: 'withImage', name: '有图', count: 23, active: false },
      { id: 'taste', name: '味道赞', count: 1, active: false },
      { id: 'portion', name: '分量足', count: 2, active: false },
      { id: 'price', name: '价格实惠', count: 2, active: false }
    ],
    reviews: [
      {
        id: 1,
        userAvatar: 'https://picsum.photos/seed/user1/40/40',
        userName: '主体昵称',
        rating: 5,
        date: '2021.07.08',
        content: '要求不是很完美啊?',
        images: [
          'https://picsum.photos/seed/food1/80/80',
          'https://picsum.photos/seed/food2/80/80',
          'https://picsum.photos/seed/food3/80/80'
        ],
        merchantReply: '商家回复:感谢小哥的评价,下次安徽还会继续努力,怎么搞不死你'
      },
      {
        id: 2,
        userAvatar: 'https://picsum.photos/seed/user2/40/40',
        userName: '主体昵称',
        rating: 4,
        date: '2021.07.08',
        content: '要求不是很完美啊?',
        images: [
          'https://picsum.photos/seed/food4/80/80',
          'https://picsum.photos/seed/food5/80/80',
          'https://picsum.photos/seed/food6/80/80'
        ],
        merchantReply: '商家回复:感谢小哥的评价,下次安徽还会继续努力,怎么搞不死你'
      }
    ]
  },

  onLoad(options) {
    // 如果有传入的店铺ID，可以在这里获取店铺详情
    if (options.storeId) {
      this.loadStoreDetail(options.storeId);
    }
  },

  // 加载店铺详情
  loadStoreDetail(storeId) {
    console.log('加载店铺详情:', storeId);
  },

  // 切换标签
  onTabTap(e) {
    const index = e.currentTarget.dataset.index;
    this.setData({
      activeTab: index
    });
    
    // 根据标签跳转
    if (index === 0) {
      wx.navigateTo({
        url: '/pages/store-detail/index'
      });
    } else if (index === 2) {
      wx.navigateTo({
        url: '/pages/store-detail/index?tab=merchant'
      });
    }
  },

  // 选择筛选条件
  onFilterTap(e) {
    const filterId = e.currentTarget.dataset.id;
    const filters = this.data.filters.map(filter => ({
      ...filter,
      active: filter.id === filterId
    }));
    
    this.setData({
      activeFilter: filterId,
      filters: filters
    });
  },

  // 选择子筛选条件
  onSubFilterTap(e) {
    const filterId = e.currentTarget.dataset.id;
    const subFilters = this.data.subFilters.map(filter => ({
      ...filter,
      active: filter.id === filterId ? !filter.active : filter.active
    }));
    
    this.setData({
      subFilters: subFilters
    });
  },

  // 预览图片
  onImageTap(e) {
    const { images, index } = e.currentTarget.dataset;
    wx.previewImage({
      current: images[index],
      urls: images
    });
  },

  // 返回
  onBack() {
    wx.navigateBack();
  }
});
