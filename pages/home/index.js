Page({
  data: {
    statusBarHeight: wx.getWindowInfo().statusBarHeight || 20,
    activeFilter: 0,
    filters: ["综合排序", "销量", "星级"],
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
    banners: [],
    shops: [
      { id: 1, img: "https://picsum.photos/seed/a/200/120", name: "麻辣酸菜鱼嘎嘎香的那种", score: 4.9, rating: 4.9, month: 401, start: 17, delivery: 3, stars: ['full', 'full', 'full', 'full', 'half'] },
      { id: 2, img: "https://picsum.photos/seed/b/200/120", name: "小杨麻辣羊肉串", score: 4.0, rating: 4.0, month: 391, start: 15, delivery: 1.5, stars: ['full', 'full', 'full', 'full', 'empty'] },
      { id: 3, img: "https://picsum.photos/seed/c/200/120", name: "古法秘制酱香猪蹄", score: 4.9, rating: 4.9, month: 391, start: 17, delivery: 3, stars: ['full', 'full', 'full', 'full', 'half'] }
    ],
    originalShops: [], // 保存原始数据，用于排序
    announcement: null,
    showAnnouncement: false,
    userLocation: null, // 用户位置信息
    searchKeyword: '' // 搜索关键词
  },

  onLoad() {
    this.loadBanners();
    this.loadStores();
  },

  onShow() {
    // 避免重复加载，只在数据为空或超过1分钟时刷新
    const lastLoadTime = this.lastLoadTime || 0;
    const now = Date.now();
    if (this.data.shops.length === 0 || (now - lastLoadTime) > 60000) {
      this.loadBanners();
      this.loadStores();
    }
  },

  // 加载轮播图（优化版本：添加请求去重和默认数据）
  async loadBanners() {
    // 防止重复请求
    if (this.loadingBanners) {
      return;
    }
    
    this.loadingBanners = true;
    
    try {
      const res = await wx.cloud.callFunction({
        name: 'bannerManage',
        data: {
          action: 'getList',
          data: {
            isActive: true // 只获取启用的轮播图
          }
        }
      });
      
      if (res.result && res.result.code === 200) {
        this.setData({
          banners: res.result.data.list || []
        });
      }
    } catch (err) {
      console.error('加载轮播图失败:', err);
      // 使用默认轮播图（只在首次加载失败时设置）
      if (this.data.banners.length === 0) {
        this.setData({
          banners: [
            { id: 1, title: "秋口食物流", subtitle: "大牌西餐6折起", bg: "linear-gradient(90deg,#eaf3ff,#fff)" },
            { id: 2, title: "校园美食节", subtitle: "全场8折优惠", bg: "linear-gradient(90deg,#fef3c7,#fff)" },
            { id: 3, title: "新品上市", subtitle: "限时特价", bg: "linear-gradient(90deg,#e0f2fe,#fff)" }
          ]
        });
      }
    } finally {
      this.loadingBanners = false;
    }
  },

  onTabTap(e) {
    const tab = e.currentTarget.dataset.tab;
    if (tab === 'order') {
      wx.reLaunch({
        url: '/subpackages/order/pages/order/index'
      });
    } else if (tab === 'receive') {
      // 接单功能正在开发中
      wx.showToast({
        title: '正在开发中',
        icon: 'none',
        duration: 2000
      });
      // wx.reLaunch({
      //   url: '/pages/receive-order/index'
      // });
    } else if (tab === 'message') {
      // 消息功能正在开发中
      wx.showToast({
        title: '正在开发中',
        icon: 'none',
        duration: 2000
      });
      // wx.reLaunch({
      //   url: '/pages/message/index'
      // });
    } else if (tab === 'profile') {
      wx.reLaunch({
        url: '/pages/profile/index'
      });
    }
  },

  // 点击商家跳转到店铺详情页
  onShopTap(e) {
    const shopId = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/subpackages/store/pages/store-detail/index?storeId=${shopId}`
    });
  },

  onQuickCatTap(e) {
    const index = e.currentTarget.dataset.index;
    const cat = this.data.quickCats[index];
    
    if (cat.text === '学校食堂') {
      wx.navigateTo({
        url: '/subpackages/category/pages/canteen/index'
      });
    } else if (cat.text === '生鲜水果') {
      wx.navigateTo({
        url: '/subpackages/category/pages/fruits/index'
      });
    } else if (cat.text === '奶茶果汁') {
      wx.navigateTo({
        url: '/subpackages/category/pages/drinks/index'
      });
    } else if (cat.text === '校园超市') {
      wx.navigateTo({
        url: '/subpackages/store/pages/store/index'
      });
    } else if (cat.text === '悬赏') {
      // 悬赏功能正在开发中
      wx.showToast({
        title: '正在开发中',
        icon: 'none',
        duration: 2000
      });
      // wx.navigateTo({
      //   url: '/pages/reward/index'
      // });
    } else if (cat.text === '游戏陪玩') {
      // 游戏陪玩功能正在开发中
      wx.showToast({
        title: '正在开发中',
        icon: 'none',
        duration: 2000
      });
      // wx.navigateTo({
      //   url: '/pages/gaming/index'
      // });
    } else if (cat.text === '代拿快递') {
      // 代拿快递功能正在开发中
      wx.showToast({
        title: '正在开发中',
        icon: 'none',
        duration: 2000
      });
      // wx.navigateTo({
      //   url: '/pages/express/index'
      // });
    } else if (cat.text === '闲置出售') {
      // 闲置出售功能正在开发中
      wx.showToast({
        title: '正在开发中',
        icon: 'none',
        duration: 2000
      });
      // wx.navigateTo({
      //   url: '/pages/secondhand/index'
      // });
    }
  },

  // 点击轮播图
  onBannerTap(e) {
    const linkUrl = e.currentTarget.dataset.link;
    
    if (linkUrl) {
      // 如果配置了跳转链接，可以根据链接类型进行跳转
      // 这里可以扩展支持更多类型的链接
      if (linkUrl.startsWith('/pages/')) {
        wx.navigateTo({
          url: linkUrl
        });
      } else if (linkUrl.startsWith('http')) {
        // 外部链接，可以在webview中打开
        wx.showToast({
          title: '外部链接暂不支持',
          icon: 'none'
        });
      }
    }
  },

  // 关闭公告弹窗
  onCloseAnnouncement() {
    this.setData({
      showAnnouncement: false
    });
  },

  // 加载商家列表（优化版本：添加请求去重）
  // 注意：首页不传storeCategory参数，显示所有商家（包括"其他"分类）
  async loadStores(keyword) {
    // 防止重复请求
    if (this.loadingStores) {
      return;
    }
    
    this.loadingStores = true;
    
    try {
      wx.showLoading({ title: keyword ? '搜索中...' : '加载中...' });
      
      const res = await wx.cloud.callFunction({
        name: 'getStoreList',
        data: {
          page: 1,
          pageSize: 20,
          keyword: keyword || undefined
          // 不传storeCategory参数，返回所有商家（包括"其他"分类）
        }
      });
      
      console.log('【首页】加载商家列表:', res.result);
      
      if (res.result && res.result.code === 200) {
        // 处理商家列表，确保图片URL正确
        const shops = (res.result.data.list || []).map(shop => {
          // 计算距离（如果有店铺位置信息）
          let distance = shop.distance || this.calculateDistance(shop);
          
          // 获取评分
          const rating = parseFloat(shop.ratingAvg || shop.score || shop.rating || 0);
          
          // 计算星星数组（5颗星）
          const stars = [];
          const fullStars = Math.floor(rating); // 完整星星数
          const hasHalfStar = (rating - fullStars) >= 0.5; // 是否有半星
          
          for (let i = 0; i < 5; i++) {
            if (i < fullStars) {
              stars.push('full'); // 完整星星
            } else if (i === fullStars && hasHalfStar) {
              stars.push('half'); // 半星
            } else {
              stars.push('empty'); // 空星
            }
          }
          
          console.log('【首页】店铺评分处理:', shop.name, '评分:', rating, '星星数组:', stars);
          
          return {
            ...shop,
            logoUrl: this.formatImageUrl(shop.logoUrl || shop.img || ''),
            img: this.formatImageUrl(shop.logoUrl || shop.img || ''),
            month: shop.monthlySales || shop.month || shop.sales || 0,
            sales: shop.monthlySales || shop.sales || 0,
            distance: distance, // 距离（米）
            distanceText: distance < 1000 ? `${Math.round(distance)}m` : `${(distance / 1000).toFixed(1)}km`,
            rating: rating, // 评分
            stars: stars // 星星数组
          };
        });
        
        // 保存原始数据
        this.setData({
          originalShops: shops,
          shops: shops
        });
        
        // 应用当前排序
        this.applySort(this.data.activeFilter);
        
        this.lastLoadTime = Date.now(); // 记录加载时间
      } else {
        console.error('【首页】加载商家列表失败:', res.result);
        // 保持原有的模拟数据
      }
    } catch (err) {
      console.error('【首页】加载商家列表异常:', err);
      // 保持原有的模拟数据
    } finally {
      wx.hideLoading();
      this.loadingStores = false;
    }
  },

  // 格式化图片URL（处理云存储fileID）
  formatImageUrl(url) {
    if (!url || url.trim() === '' || url === 'undefined' || url === 'null') {
      return '/pages/小标/商家.png'; // 默认商家头像
    }
    
    // 如果已经是HTTP URL，直接返回
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }
    
    // 如果是云存储fileID，直接返回（小程序会自动处理）
    // cloud://格式或普通fileID都可以直接使用
    return url;
  },

  // 图片加载错误处理
  onImageError(e) {
    const { dataset } = e.currentTarget || {};
    const index = dataset.index;
    const shops = this.data.shops;
    
    if (index !== undefined && shops[index]) {
      // 使用默认头像
      shops[index].logoUrl = '/pages/小标/商家.png';
      shops[index].img = '/pages/小标/商家.png';
      this.setData({ shops });
    }
  },
  
  // 筛选栏点击事件
  onFilterTap(e) {
    const index = parseInt(e.currentTarget.dataset.index);
    
    if (index === this.data.activeFilter) {
      return; // 如果点击的是当前选中的，不处理
    }
    
    this.setData({
      activeFilter: index
    });
    
    // 应用排序
    this.applySort(index);
  },
  
  // 应用排序
  applySort(sortType) {
    // 深拷贝原始数据，确保stars数组也被复制
    const shops = this.data.originalShops.map(shop => ({
      ...shop,
      stars: shop.stars ? [...shop.stars] : []
    }));
    
    switch (sortType) {
      case 0: // 综合排序
        // 综合排序：综合考虑销量、评分、距离等因素
        shops.sort((a, b) => {
          // 归一化销量（假设最大销量为10000）
          const maxSales = Math.max(...shops.map(s => s.sales || s.monthlySales || 0), 10000);
          const normalizedSalesA = ((a.sales || a.monthlySales || 0) / maxSales) * 100;
          const normalizedSalesB = ((b.sales || b.monthlySales || 0) / maxSales) * 100;
          
          // 归一化评分（5分制）
          const normalizedRatingA = ((a.rating || a.ratingAvg || a.score || 0) / 5) * 100;
          const normalizedRatingB = ((b.rating || b.ratingAvg || b.score || 0) / 5) * 100;
          
          // 归一化距离（假设最大距离为2000米）
          const maxDistance = 2000;
          const normalizedDistanceA = Math.max(0, 100 - ((a.distance || maxDistance) / maxDistance) * 100);
          const normalizedDistanceB = Math.max(0, 100 - ((b.distance || maxDistance) / maxDistance) * 100);
          
          // 综合评分 = 销量权重(0.5) + 评分权重(0.3) + 距离权重(0.2)
          const scoreA = normalizedSalesA * 0.5 + normalizedRatingA * 0.3 + normalizedDistanceA * 0.2;
          const scoreB = normalizedSalesB * 0.5 + normalizedRatingB * 0.3 + normalizedDistanceB * 0.2;
          
          return scoreB - scoreA;
        });
        break;
        
      case 1: // 销量排序
        shops.sort((a, b) => {
          const salesA = a.sales || a.monthlySales || 0;
          const salesB = b.sales || b.monthlySales || 0;
          return salesB - salesA; // 降序
        });
        break;
        
      case 2: // 星级排序
        shops.sort((a, b) => {
          const ratingA = a.rating || a.ratingAvg || a.score || 0;
          const ratingB = b.rating || b.ratingAvg || b.score || 0;
          if (ratingB !== ratingA) {
            return ratingB - ratingA; // 降序
          }
          // 如果评分相同，按销量排序
          const salesA = a.sales || a.monthlySales || 0;
          const salesB = b.sales || b.monthlySales || 0;
          return salesB - salesA;
        });
        break;
        
      case 3: // 距离排序
        shops.sort((a, b) => {
          const distanceA = a.distance || 9999;
          const distanceB = b.distance || 9999;
          return distanceA - distanceB; // 升序
        });
        break;
        
      default:
        break;
    }
    
    this.setData({
      shops: shops
    });
    
    console.log('【首页】排序完成，排序类型:', this.data.filters[sortType], '店铺数量:', shops.length);
  },
  
  // 计算距离（使用模拟数据或真实位置）
  calculateDistance(shop) {
    // 如果店铺有位置信息，使用真实计算
    if (shop.latitude && shop.longitude && this.data.userLocation) {
      return this.getDistance(
        this.data.userLocation.latitude,
        this.data.userLocation.longitude,
        shop.latitude,
        shop.longitude
      );
    }
    
    // 否则使用模拟距离（200-2000米之间）
    if (!shop._distance) {
      shop._distance = 200 + Math.random() * 1800;
    }
    return shop._distance;
  },
  
  // 计算两点之间的距离（米）
  getDistance(lat1, lon1, lat2, lon2) {
    const R = 6371000; // 地球半径（米）
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;
    return Math.round(distance);
  },
  
  // 角度转弧度
  toRad(degrees) {
    return degrees * (Math.PI / 180);
  },
  
  // 搜索输入事件
  onSearchInput(e) {
    const keyword = e.detail.value.trim();
    this.setData({
      searchKeyword: keyword
    });
  },
  
  // 搜索提交事件
  onSearchSubmit(e) {
    const keyword = e.detail.value ? e.detail.value.trim() : this.data.searchKeyword.trim();
    
    if (!keyword) {
      // 如果关键词为空，重新加载所有店铺
      this.setData({
        searchKeyword: ''
      });
      this.loadStores();
      return;
    }
    
    console.log('【首页】搜索关键词:', keyword);
    
    // 执行搜索
    this.setData({
      searchKeyword: keyword,
      activeFilter: 0 // 重置为综合排序
    });
    
    this.loadStores(keyword);
  },
  
  // 清空搜索
  onClearSearch() {
    this.setData({
      searchKeyword: ''
    });
    this.loadStores();
  },
  
  // 搜索框聚焦事件（跳转到搜索页面或显示搜索历史）
  onSearchFocus() {
    // 可以在这里添加搜索历史或热门搜索的显示逻辑
    // 目前直接允许输入搜索
  }
});

