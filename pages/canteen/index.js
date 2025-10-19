Page({
  data: {
    statusBarHeight: wx.getWindowInfo().statusBarHeight || 20,
    searchValue: '',
    activeCategory: 0,
    categories: ['全部', '饺子馄饨', '汉堡薯条', '意面披萨', '包子粥店', '烧烤炸串', '甜品饮品', '快餐便当'],
    activeSort: 0,
    sortOptions: ['综合排序', '速度', '全部筛选'],
    filters: [
      { text: '神券商家', active: false },
      { text: '美团专送', active: false },
      { text: '首单立减', active: false },
      { text: '点评高分', active: false }
    ],
    restaurants: [
      {
        id: 1,
        name: '东北老式烤串拌饭!鲜…',
        image: 'https://picsum.photos/seed/restaurant1/200/150',
        rating: 5.0,
        monthlySales: 1000,
        deliveryType: '商家自配',
        minOrder: 32,
        deliveryFee: 0,
        deliveryTime: 52,
        distance: 3.8,
        tags: ['人气新店'],
        activities: ['最近30分钟42人看过', '刚刚有用户下单'],
        coupons: ['神券 满20减14', '收藏领1折券', '首单减1']
      },
      {
        id: 2,
        name: '烙馍村',
        image: 'https://picsum.photos/seed/restaurant2/200/150',
        rating: 5.0,
        monthlySales: 21,
        avgPrice: 34,
        deliveryType: '商家自配',
        minOrder: 20,
        deliveryFee: 5,
        deliveryTime: 48,
        distance: 3.7,
        tags: ['精选好店', '点评收录6年'],
        coupons: ['神券 满20减14', '首单减3']
      },
      {
        id: 3,
        name: '德克士(豫兴家苑店·汉…',
        image: 'https://picsum.photos/seed/restaurant3/200/150',
        rating: 4.7,
        monthlySales: 3000,
        deliveryType: '商家自配',
        minOrder: 40,
        deliveryFee: 4,
        deliveryTime: 30,
        distance: 1.3,
        activities: ['刚刚有用户看过', '门店上新'],
        coupons: ['神券 满28减16', '首单减2']
      },
      {
        id: 4,
        name: '熊家无二·韩式炸鸡',
        image: 'https://picsum.photos/seed/restaurant4/200/150',
        rating: 4.6,
        monthlySales: 1000,
        deliveryType: '美团专送',
        minOrder: 20,
        deliveryFee: 1,
        deliveryTime: 39,
        distance: 3.4,
        activities: ['最近30分钟29人看过', '刚刚有用户下单'],
        coupons: ['神券 满20减15']
      },
      {
        id: 5,
        name: '徐州烧烤坊·龙虾・虾尾',
        image: 'https://picsum.photos/seed/restaurant5/200/150',
        rating: 4.8,
        monthlySales: 500,
        deliveryType: '商家自配',
        minOrder: 25,
        deliveryFee: 3,
        deliveryTime: 45,
        distance: 2.1,
        tags: ['特色烧烤'],
        coupons: ['神券 满30减18', '首单减5']
      }
    ]
  },

  onLoad() {
    // 页面加载时的逻辑
  },

  // 搜索输入
  onSearchInput(e) {
    this.setData({
      searchValue: e.detail.value
    });
  },

  // 搜索提交
  onSearchSubmit() {
    // 搜索逻辑
    console.log('搜索:', this.data.searchValue);
  },

  // 分类切换
  onCategoryTap(e) {
    const index = e.currentTarget.dataset.index;
    this.setData({
      activeCategory: index
    });
  },

  // 排序切换
  onSortTap(e) {
    const index = e.currentTarget.dataset.index;
    this.setData({
      activeSort: index
    });
  },

  // 筛选切换
  onFilterTap(e) {
    const index = e.currentTarget.dataset.index;
    const filters = this.data.filters;
    filters[index].active = !filters[index].active;
    this.setData({
      filters: filters
    });
  },

  // 餐厅点击
  onRestaurantTap(e) {
    const id = e.currentTarget.dataset.id;
    console.log('点击餐厅:', id);
    // 跳转到餐厅详情页
  },

  // 返回
  onBackTap() {
    wx.navigateBack();
  }
});
