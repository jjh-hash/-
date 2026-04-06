const log = console;
const cloudImages = require('../../config/cloudImages.js');
const CACHE_KEY_PRODUCTS = 'home_products_cache';
const CACHE_KEY_BANNERS = 'home_banners_cache';

// 带超时的云函数调用
function callFunctionWithTimeout(options, timeout = 10000) {
  return Promise.race([
    wx.cloud.callFunction(options),
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error('请求超时')), timeout);
    })
  ]);
}

Page({
  data: {
    /** 使用 windowHeight，避免 100vh 在带 tabBar 页与可视区不一致导致 scroll-view 裁切、首屏似空白 */
    scrollViewHeight: 600,
    statusBarHeight: 20,
    cloudImages: {
      expressIcon: cloudImages.expressIcon,
      gamingIcon: cloudImages.gamingIcon,
      secondhandIcon: cloudImages.secondhandIcon,
      serviceFlashBg: cloudImages.serviceFlashBg
    },
    greeting: '你好',
    greetingColor: '#ffffff',
    greetingSloganColor: '#ffffff',
    activeFilter: 0,
    filters: ["推荐", "销量", "低价优先"],
    categoryOptions: [
      { key: 'all', label: '全部' },
      { key: '盖饭套餐', label: '盖饭套餐' },
      { key: '面食', label: '面食' },
      { key: '饮品', label: '饮品' },
      { key: '小食', label: '小食' }
    ],
    activeCategoryKey: 'all',
    quickCats: [
      { text: "代拿快递", icon: "取", bg: "#ffebee" },
      { text: "游戏陪玩", icon: "玩", bg: "#e0f2fe" },
      { text: "闲置出售", icon: "卖", bg: "#fef3c7" },
      { text: "跑腿", icon: "腿", bg: "#e9d5ff" }
    ],
    banners: [],
    originalProducts: [],
    displayProductsLeft: [],
    displayProductsRight: [],
    productPage: 1,
    productPageSize: 20,
    hasMoreProducts: true,
    productListLoading: false,
    announcement: null,
    showAnnouncement: false,
    userLocation: null, // 用户位置信息
    searchKeyword: '' // 搜索关键词
  },

  onLoad() {
    try {
      const sys = wx.getSystemInfoSync();
      const win = wx.getWindowInfo ? wx.getWindowInfo() : null;
      const bar = (win && win.statusBarHeight) || sys.statusBarHeight || 20;
      const h = sys.windowHeight > 0 ? sys.windowHeight : 600;
      this.setData({
        statusBarHeight: bar,
        scrollViewHeight: h
      });
    } catch (e) {
      log.error('【首页】系统信息', e);
    }
    this.setGreeting();
    // 优先从缓存渲染，减少首屏白屏
    wx.getStorage({
      key: CACHE_KEY_PRODUCTS,
      success: (res) => {
        const c = res.data;
        if (c && c.left && c.right && Array.isArray(c.left) && Array.isArray(c.right)) {
          this.setData({
            displayProductsLeft: c.left,
            displayProductsRight: c.right,
            originalProducts: c.original || [],
            productPage: c.page || 1,
            hasMoreProducts: c.hasMore !== false,
            productListLoading: false
          });
        }
      }
    });
    wx.getStorage({
      key: CACHE_KEY_BANNERS,
      success: (res) => {
        const list = res.data;
        if (list && Array.isArray(list) && list.length > 0) {
          this.setData({ banners: list });
        }
      }
    });
    this.loadProducts();
    this.loadBanners();
  },

  // 根据时段设置问候语文案（颜色固定白色，适配各种轮播图）
  setGreeting() {
    const h = new Date().getHours();
    let greeting = '你好';
    if (h >= 0 && h < 5) greeting = '凌晨好';
    else if (h >= 5 && h < 9) greeting = '早上好';
    else if (h >= 9 && h < 12) greeting = '上午好';
    else if (h >= 12 && h < 14) greeting = '中午好';
    else if (h >= 14 && h < 18) greeting = '下午好';
    else if (h >= 18 && h < 22) greeting = '晚上好';
    else greeting = '午夜好';
    this.setData({ greeting });
  },

  onShow() {
    const lastLoadTime = this.lastLoadTime || 0;
    const now = Date.now();
    if ((this.data.originalProducts || []).length === 0 || (now - lastLoadTime) > 60000) {
      this.loadBanners();
      this.loadProducts(undefined, false, this.data.activeCategoryKey);
    }
  },

  async onPullDownRefresh() {
    this.loadingBanners = false;
    try {
      await Promise.all([
        this.loadBanners(),
        this.loadProducts(this.data.searchKeyword || undefined, false, this.data.activeCategoryKey)
      ]);
    } finally {
      wx.stopPullDownRefresh();
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
      const res = await callFunctionWithTimeout({
        name: 'bannerManage',
        data: { action: 'getList', data: { isActive: true } }
      }, 12000);
      
      if (res.result && res.result.code === 200) {
        const list = res.result.data.list || [];
        this.setData({ banners: list });
        if (list.length > 0) {
          wx.setStorage({ key: CACHE_KEY_BANNERS, data: list });
        }
      }
    } catch (err) {
      log.error('加载轮播图失败:', err);
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
    const tab = (e.detail && e.detail.tab) ? e.detail.tab : (e.currentTarget && e.currentTarget.dataset.tab);
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

  onQuickCatTap(e) {
    const index = e.currentTarget.dataset.index;
    const cat = this.data.quickCats[index];
    this.navigateToService(cat.text === '跑腿' ? 'reward' : cat.text === '游戏陪玩' ? 'gaming' : cat.text === '代拿快递' ? 'express' : 'secondhand');
  },

  onServiceTap(e) {
    const key = e.currentTarget.dataset.key;
    this.navigateToService(key);
  },

  navigateToService(key) {
    const urls = {
      reward: '/subpackages/category/pages/reward/index',
      gaming: '/subpackages/category/pages/gaming/index',
      express: '/subpackages/category/pages/express/index',
      secondhand: '/subpackages/secondhand/pages/secondhand/index'
    };
    const url = urls[key];
    if (url) wx.navigateTo({ url });
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
        log.error('【首页】加载菜品流失败:', res.result);
      }
    } catch (err) {
      log.error('【首页】加载菜品流异常:', err);
      if (err && err.message && err.message.includes('超时')) {
        wx.showToast({ title: '网络较慢，请稍后重试', icon: 'none' });
      }
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

  // 点击菜品卡：进入店铺详情并定位到该商品（提前发起店铺详情请求，减少目标页等待）
  onProductTap(e) {
    const storeId = e.currentTarget.dataset.storeId;
    const productId = e.currentTarget.dataset.productId;
    if (!storeId) return;
    this._prefetchStoreDetail(storeId);
    const url = productId
      ? `/subpackages/store/pages/store-detail/index?storeId=${storeId}&productId=${productId}`
      : `/subpackages/store/pages/store-detail/index?storeId=${storeId}`;
    wx.navigateTo({ url });
  },

  // 点击商家卡：进入店铺详情（无商品定位）
  onStoreTap(e) {
    const storeId = e.currentTarget.dataset.storeId;
    if (!storeId) return;
    this._prefetchStoreDetail(storeId);
    wx.navigateTo({ url: `/subpackages/store/pages/store-detail/index?storeId=${storeId}` });
  },

  // 提前请求店铺详情，供目标页复用
  _prefetchStoreDetail(storeId) {
    const app = getApp();
    if (app.globalData.prefetchedStoreDetail[storeId]) return;
    app.globalData.prefetchedStoreDetail[storeId] = wx.cloud.callFunction({
      name: 'storeManage',
      data: { action: 'getStoreDetailWithProducts', data: { storeId } }
    });
  },

  // 图片加载错误处理（菜品/商家封面）
  onImageError(e) {
    const id = e.currentTarget && e.currentTarget.dataset.id;
    if (!id) return;
    const originalProducts = (this.data.originalProducts || []).map(p => {
      if (p._id === id) {
        if (p.type === 'store') {
          return Object.assign({}, p, { logo: '/pages/小标/商家.png' });
        }
        return Object.assign({}, p, { coverUrl: '/pages/小标/商家.png' });
      }
      return p;
    });
    this.setData({ originalProducts });
    const payload = this.applyProductSort(this.data.activeFilter, originalProducts);
    if (payload) {
      this.setData({
        displayProductsLeft: payload.left,
        displayProductsRight: payload.right
      });
    }
  },

  // 筛选栏点击
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

  // 搜索输入
  onSearchInput(e) {
    this.setData({ searchKeyword: e.detail.value.trim() });
  },

  // 搜索提交
  onSearchSubmit(e) {
    const keyword = e.detail.value ? e.detail.value.trim() : this.data.searchKeyword.trim();
    if (!keyword) {
      this.setData({ searchKeyword: '' });
      this.loadProducts(undefined, false, this.data.activeCategoryKey);
      return;
    }
    this.setData({ searchKeyword: keyword, activeFilter: 0 });
    this.loadProducts(keyword, false, this.data.activeCategoryKey);
  },

  // 清空搜索
  onClearSearch() {
    this.setData({ searchKeyword: '' });
    this.loadProducts(undefined, false, this.data.activeCategoryKey);
  },
  
  // 搜索框聚焦事件（跳转到搜索页面或显示搜索历史）
  onSearchFocus() {
    // 可以在这里添加搜索历史或热门搜索的显示逻辑
    // 目前直接允许输入搜索
  },

  // 分类点击事件
  onCategoryTap(e) {
    const key = e.currentTarget.dataset.key;
    if (key === this.data.activeCategoryKey) return;
    
    this.setData({
      activeCategoryKey: key,
      productPage: 1,
      originalProducts: [],
      displayProductsLeft: [],
      displayProductsRight: [],
      hasMoreProducts: true
    });
    
    this.loadProducts(undefined, false, key);
  },

  // 加载商品列表（优化版本：添加缓存和并行请求）
  async loadProducts(keyword, isLoadMore = false, catKey = 'all') {
    // 防止重复请求
    if (this.loadingProducts) return;
    
    this.loadingProducts = true;
    
    try {
      // 检查分类缓存
      if (!isLoadMore && !keyword) {
        const cachedData = this.getCategoryCache(catKey);
        if (cachedData) {
          const payload = this.applyProductSort(this.data.activeFilter, cachedData.originalProducts);
          if (payload) {
            this.setData({
              originalProducts: cachedData.originalProducts,
              productPage: cachedData.productPage,
              hasMoreProducts: cachedData.hasMoreProducts,
              displayProductsLeft: payload.left,
              displayProductsRight: payload.right,
              productListLoading: false
            });
            // 异步更新缓存数据，不阻塞用户体验
            this.updateCategoryCacheAsync(catKey);
            this.loadingProducts = false;
            return;
          }
        }
      }

      if (!isLoadMore) {
        wx.showLoading({ title: keyword ? '搜索中...' : '加载中...' });
      }

      const page = isLoadMore ? this.data.productPage + 1 : 1;
      const pageSize = this.data.productPageSize;
      const needStores = !keyword && !isLoadMore && (catKey === 'all' || catKey === '盖饭套餐');
      
      // 并行请求商家列表和商品列表，减少加载时间
      const [storeRes, productRes] = await Promise.all([
        needStores ? callFunctionWithTimeout({
          name: 'getStoreList',
          data: {
            page: 1,
            pageSize: catKey === '盖饭套餐' ? 8 : 5,
            storeCategory: catKey === '盖饭套餐' ? '学校食堂' : undefined
          }
        }, 12000) : Promise.resolve({ result: { code: 200, data: { list: [] } } }),
        callFunctionWithTimeout({
          name: 'getProductList',
          data: {
            page,
            pageSize,
            keyword: keyword || undefined,
            categoryName: catKey && catKey !== 'all' ? catKey : undefined
          }
        }, 15000)
      ]);

      // 处理商家列表
      let stores = [];
      if (storeRes.result && storeRes.result.code === 200) {
        stores = (storeRes.result.data.list || []).map(shop => ({
          ...shop,
          type: 'store',
          storeId: shop._id,
          logo: this.formatImageUrl(shop.logoUrl || shop.img || ''),
          name: shop.name,
          minOrderAmount: shop.minOrderAmount || 0,
          deliveryFee: shop.deliveryFee || 0
        }));
      }

      // 处理商品列表
      let products = [];
      let hasMore = true;
      if (productRes.result && productRes.result.code === 200) {
        const list = productRes.result.data.list || [];
        products = list.map(item => ({
          ...item,
          type: 'product',
          logo: this.formatImageUrl(item.coverUrl || item.imageUrl || item.img || ''),
          name: item.name,
          storeName: item.storeName,
          sales: item.sales || item.monthlySales || 0
        }));
        hasMore = list.length === pageSize;
      }

      // 合并商家和商品
      const allItems = [...stores, ...products];
      const originalProducts = isLoadMore ? [...this.data.originalProducts, ...allItems] : allItems;
      const payload = this.applyProductSort(this.data.activeFilter, originalProducts);

      if (payload) {
        // 批量更新数据，减少setData调用
        const updateData = {
          originalProducts,
          productPage: page,
          hasMoreProducts: hasMore,
          displayProductsLeft: payload.left,
          displayProductsRight: payload.right,
          productListLoading: false
        };
        
        this.setData(updateData);

        // 缓存数据
        if (!isLoadMore && !keyword) {
          this.setCategoryCache(catKey, {
            originalProducts,
            productPage: page,
            hasMoreProducts: hasMore
          });
        }

        // 缓存到全局缓存
        if (!keyword) {
          wx.setStorage({
            key: CACHE_KEY_PRODUCTS,
            data: {
              left: payload.left,
              right: payload.right,
              original: originalProducts,
              page,
              hasMore
            }
          });
        }
      }

      this.lastLoadTime = Date.now();
    } catch (err) {
      log.error('加载商品失败:', err);
      if (err && err.message && err.message.includes('超时')) {
        wx.showToast({ title: '网络较慢，请稍后重试', icon: 'none' });
      } else {
        // 显示更友好的错误提示
        wx.showToast({ title: '加载失败，请重试', icon: 'none' });
      }
    } finally {
      wx.hideLoading();
      this.loadingProducts = false;
    }
  },

  // 异步更新分类缓存
  async updateCategoryCacheAsync(catKey) {
    try {
      const page = 1;
      const pageSize = this.data.productPageSize;
      const needStores = catKey === 'all' || catKey === '盖饭套餐';
      
      // 并行请求商家列表和商品列表
      const [storeRes, productRes] = await Promise.all([
        needStores ? callFunctionWithTimeout({
          name: 'getStoreList',
          data: {
            page: 1,
            pageSize: catKey === '盖饭套餐' ? 8 : 5,
            storeCategory: catKey === '盖饭套餐' ? '学校食堂' : undefined
          }
        }, 10000) : Promise.resolve({ result: { code: 200, data: { list: [] } } }),
        callFunctionWithTimeout({
          name: 'getProductList',
          data: {
            page,
            pageSize,
            categoryName: catKey && catKey !== 'all' ? catKey : undefined
          }
        }, 10000)
      ]);

      // 处理商家列表
      let stores = [];
      if (storeRes.result && storeRes.result.code === 200) {
        stores = (storeRes.result.data.list || []).map(shop => ({
          ...shop,
          type: 'store',
          storeId: shop._id,
          logo: this.formatImageUrl(shop.logoUrl || shop.img || ''),
          name: shop.name,
          minOrderAmount: shop.minOrderAmount || 0,
          deliveryFee: shop.deliveryFee || 0
        }));
      }

      // 处理商品列表
      let products = [];
      let hasMore = true;
      if (productRes.result && productRes.result.code === 200) {
        const list = productRes.result.data.list || [];
        products = list.map(item => ({
          ...item,
          type: 'product',
          logo: this.formatImageUrl(item.coverUrl || item.imageUrl || item.img || ''),
          name: item.name,
          storeName: item.storeName,
          sales: item.sales || item.monthlySales || 0
        }));
        hasMore = list.length === pageSize;
      }

      // 合并商家和商品
      const allItems = [...stores, ...products];
      
      // 更新缓存
      this.setCategoryCache(catKey, {
        originalProducts: allItems,
        productPage: page,
        hasMoreProducts: hasMore
      });
      
      // 缓存到全局缓存
      const payload = this.applyProductSort(this.data.activeFilter, allItems);
      if (payload) {
        wx.setStorage({
          key: CACHE_KEY_PRODUCTS,
          data: {
            left: payload.left,
            right: payload.right,
            original: allItems,
            page,
            hasMore
          }
        });
      }
    } catch (err) {
      log.error('异步更新分类缓存失败:', err);
    }
  },

  // 应用商品排序
  applyProductSort(sortType, products) {
    const items = (products || this.data.originalProducts || []).slice();
    
    // 缓存排序结果，避免重复计算
    const sortCacheKey = `${sortType}_${items.length}`;
    if (this._sortCache && this._sortCache[sortCacheKey]) {
      return this._sortCache[sortCacheKey];
    }
    
    // 根据排序类型排序
    switch (sortType) {
      case 0: // 推荐
        // 综合排序：优先显示店铺，然后按销量排序
        items.sort((a, b) => {
          if (a.type === 'store' && b.type !== 'store') return -1;
          if (a.type !== 'store' && b.type === 'store') return 1;
          return (b.sales || 0) - (a.sales || 0);
        });
        break;
      case 1: // 销量
        items.sort((a, b) => (b.sales || 0) - (a.sales || 0));
        break;
      case 2: // 低价优先
        items.sort((a, b) => (a.price || 0) - (b.price || 0));
        break;
    }
    
    // 分左右两列
    const left = [];
    const right = [];
    items.forEach((item, index) => {
      if (index % 2 === 0) {
        left.push(item);
      } else {
        right.push(item);
      }
    });
    
    const result = { left, right };
    
    // 缓存排序结果
    if (!this._sortCache) {
      this._sortCache = {};
    }
    this._sortCache[sortCacheKey] = result;
    
    return result;
  },

  // 获取分类缓存
  getCategoryCache(catKey) {
    try {
      const cache = wx.getStorageSync(`category_cache_${catKey}`);
      if (cache && (Date.now() - cache.timestamp) < 5 * 60 * 1000) { // 5分钟缓存
        return cache.data;
      }
    } catch (e) {
      log.error('获取分类缓存失败:', e);
    }
    return null;
  },

  // 设置分类缓存
  setCategoryCache(catKey, data) {
    try {
      wx.setStorageSync(`category_cache_${catKey}`, {
        data,
        timestamp: Date.now()
      });
    } catch (e) {
      log.error('设置分类缓存失败:', e);
    }
  }
});

