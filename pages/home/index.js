const log = require('../../utils/logger.js');
const { callFunctionWithTimeout } = require('../../utils/cloudWithTimeout.js');
const cloudImages = require('../../config/cloudImages.js');

const CACHE_KEY_PRODUCTS = 'home_products_cache';
const CACHE_KEY_BANNERS = 'home_banners_cache';
const CACHE_KEY_CATEGORY = 'home_category_cache';
const CACHE_EXPIRE_TIME = 5 * 60 * 1000; // 5分钟缓存过期

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
    userLocation: null,
    searchKeyword: '',
    categoryCache: {}
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

  onReachBottom() {
    if (!this.loadingProducts && this.data.hasMoreProducts) {
      this.loadProducts(this.data.searchKeyword || undefined, true);
    }
  },

  // 分类切换
  onCategoryTap(e) {
    const key = e.currentTarget.dataset.key;
    if (key === this.data.activeCategoryKey) return;
    this.setData({ activeCategoryKey: key });
    this.loadProducts(this.data.searchKeyword || undefined, false, key);
  },

  // 加载菜品流（keyword 可选，isLoadMore 上拉加载更多，categoryKey 分类筛选）
  // 混合展示：商家卡片 + 商品卡片，盖饭套餐/全部时插入商家
  async loadProducts(keyword, isLoadMore = false, categoryKey) {
    if (this.loadingProducts) return;

    this.loadingProducts = true;
    const pageSize = this.data.productPageSize || 20;
    const page = isLoadMore ? this.data.productPage : 1;
    const catKey = categoryKey !== undefined ? categoryKey : this.data.activeCategoryKey;

    if (!isLoadMore) {
      this.setData({ productListLoading: true });
    }

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
            this.loadingProducts = false;
            return;
          }
        }
      }

      if (!isLoadMore) {
        wx.showLoading({ title: keyword ? '搜索中...' : '加载中...' });
      }

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

      let storeList = [];
      if (needStores && storeRes.result && storeRes.result.code === 200 && storeRes.result.data.list) {
        storeList = (storeRes.result.data.list || []).map(s => ({
          type: 'store',
          _id: s._id || s.storeId,
          storeId: s.storeId || s._id,
          name: s.name || '',
          logo: this.formatImageUrl(s.logoUrl || s.img || ''),
          minOrderAmount: s.minOrderAmount ?? s.start ?? 20,
          deliveryFee: s.deliveryFee ?? s.delivery ?? 3,
          sales: s.sales ?? s.monthlySales ?? s.month ?? 0
        }));
      } else if (needStores) {
        log.error('【首页】加载商家列表失败:', storeRes.result?.message || '未知错误');
      }

      const res = productRes;

      if (!isLoadMore) wx.hideLoading();

      log.log('【首页】加载菜品流:', res.result);

      if (res.result && res.result.code === 200) {
        const total = res.result.data.total != null ? res.result.data.total : 0;
        const productList = (res.result.data.list || []).map(p => ({
          type: 'product',
          _id: p._id,
          name: p.name || '',
          coverUrl: this.formatImageUrl(p.coverUrl || ''),
          price: p.price,
          sales: p.sales != null ? p.sales : 0,
          storeId: p.storeId || '',
          storeName: p.storeName || '',
          storeLogo: this.formatImageUrl(p.storeLogo || '')
        }));

        const newItems = isLoadMore ? productList : [...storeList, ...productList];
        const originalProducts = isLoadMore
          ? (this.data.originalProducts || []).concat(newItems)
          : newItems;
        const hasMoreProducts = (page * pageSize) < total;

        const payload = this.applyProductSort(this.data.activeFilter, originalProducts);
        if (payload) {
          const categoryData = {
            originalProducts,
            productPage: page + 1,
            hasMoreProducts
          };
          
          // 合并setData调用，减少渲染次数
          const dataToUpdate = {
            originalProducts,
            productPage: page + 1,
            hasMoreProducts,
            displayProductsLeft: payload.left,
            displayProductsRight: payload.right
          };
          
          if (!isLoadMore) {
            dataToUpdate.productListLoading = false;
          }
          
          this.setData(dataToUpdate);
          
          // 缓存分类数据
          this.setCategoryCache(catKey, categoryData);
          
          // 写入缓存，供下次启动优先渲染
          if (catKey === 'all' && !keyword && !isLoadMore) {
            wx.setStorage({
              key: CACHE_KEY_PRODUCTS,
              data: {
                left: payload.left,
                right: payload.right,
                original: originalProducts,
                page: page + 1,
                hasMore: hasMoreProducts
              }
            });
          }
        } else {
          this.setData({
            originalProducts,
            productPage: page + 1,
            hasMoreProducts,
            productListLoading: false
          });
        }

        if (!isLoadMore) this.lastLoadTime = Date.now();
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
      this.loadingProducts = false;
      if (!isLoadMore) {
        this.setData({ productListLoading: false });
      }
    }
  },

  // 获取分类缓存
  getCategoryCache(categoryKey) {
    const cache = this.data.categoryCache[categoryKey];
    if (cache && (Date.now() - cache.timestamp) < CACHE_EXPIRE_TIME) {
      return cache.data;
    }
    return null;
  },

  // 设置分类缓存
  setCategoryCache(categoryKey, data) {
    const newCache = {
      ...this.data.categoryCache,
      [categoryKey]: {
        data,
        timestamp: Date.now()
      }
    };
    this.setData({ categoryCache: newCache });
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
    if (index === this.data.activeFilter) return;
    this.setData({ activeFilter: index });
    const payload = this.applyProductSort(index);
    if (payload) {
      this.setData({
        displayProductsLeft: payload.left,
        displayProductsRight: payload.right
      });
    }
  },

  // 菜品排序并拆分为左右列（0 推荐 1 销量 2 低价优先）
  // 支持混合列表：商家卡片置顶不参与排序，商品按规则排序
  applyProductSort(sortType, sourceProducts) {
    const raw = sourceProducts !== undefined ? sourceProducts : (this.data.originalProducts || []);
    const stores = [];
    const products = [];
    
    // 一次遍历完成分类，避免多次filter
    for (let i = 0; i < raw.length; i++) {
      const item = raw[i];
      if (item.type === 'store') {
        stores.push(item);
      } else if (item.type === 'product') {
        products.push(item);
      }
    }

    switch (sortType) {
      case 0: // 综合排序（按销量）
      case 1: // 销量
        products.sort((a, b) => (b.sales || 0) - (a.sales || 0));
        break;
      case 2: // 价格
        products.sort((a, b) => {
          const pa = parseFloat(a.price) || 0;
          const pb = parseFloat(b.price) || 0;
          return pa - pb;
        });
        break;
      default:
        break;
    }

    const toDisplay = item => {
      if (item.type === 'store') {
        return {
          type: 'store',
          listKey: 's_' + (item.storeId || item._id),
          _id: item._id,
          storeId: item.storeId,
          name: item.name,
          logo: item.logo || '/pages/小标/商家.png',
          minOrderAmount: item.minOrderAmount,
          deliveryFee: item.deliveryFee,
          sales: item.sales
        };
      }
      return {
        type: 'product',
        listKey: 'p_' + item._id,
        _id: item._id,
        name: item.name,
        logo: item.coverUrl || item.storeLogo || '/pages/小标/商家.png',
        price: item.price,
        sales: item.sales,
        storeName: item.storeName,
        storeId: item.storeId
      };
    };

    const left = [];
    const right = [];
    let leftH = 0;
    let rightH = 0;
    const EST_CARD_H = 140;
    
    // 先添加商家卡片
    for (let i = 0; i < stores.length; i++) {
      const item = toDisplay(stores[i]);
      if (leftH <= rightH) {
        left.push(item);
        leftH += EST_CARD_H;
      } else {
        right.push(item);
        rightH += EST_CARD_H;
      }
    }
    
    // 再添加商品卡片
    for (let i = 0; i < products.length; i++) {
      const item = toDisplay(products[i]);
      if (leftH <= rightH) {
        left.push(item);
        leftH += EST_CARD_H;
      } else {
        right.push(item);
        rightH += EST_CARD_H;
      }
    }

    log.log('【首页】列表排序完成:', this.data.filters[sortType], '商家:', stores.length, '商品:', products.length);
    return { left, right };
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
  }
});

