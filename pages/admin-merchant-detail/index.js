const { verifyAdminPage } = require('../../utils/verifyAdminPage.js');

Page({
  data: {
    statusBarHeight: wx.getWindowInfo().statusBarHeight || 20,
    merchantId: null,
    merchant: null,
    storeInfo: null,
    storePhotos: [],
    products: [],
    categories: [],
    loading: true
  },

  onLoad(options) {
    if (!verifyAdminPage()) return;
    if (options.id) {
      this.setData({ merchantId: options.id });
      this.loadMerchantDetail();
    } else {
      wx.showToast({
        title: '商家ID不存在',
        icon: 'none'
      });
      setTimeout(() => wx.navigateBack(), 1500);
    }
  },

  // 加载商家详情
  async loadMerchantDetail() {
    wx.showLoading({ title: '加载中...' });
    
    try {
      const res = await wx.cloud.callFunction({
        name: 'merchantManage',
        data: {
          action: 'getDetail',
          data: {
            merchantId: this.data.merchantId
          }
        }
      });

      wx.hideLoading();

      console.log('【商家详情】加载结果:', res.result);

      if (res.result && res.result.code === 200) {
        // 格式化商家申请时间为中国时间
        const merchant = res.result.data.merchant;
        if (merchant && merchant.createdAt) {
          merchant.createdAt = this.formatDateChina(merchant.createdAt);
        }
        
        this.setData({
          merchant: merchant,
          storeInfo: res.result.data.storeInfo,
          storePhotos: res.result.data.storePhotos || [],
          products: res.result.data.products || [],
          categories: res.result.data.categories || [],
          loading: false
        });
      } else {
        wx.showToast({
          title: res.result.message || '加载失败',
          icon: 'none'
        });
        setTimeout(() => wx.navigateBack(), 1500);
      }
    } catch (err) {
      wx.hideLoading();
      console.error('【商家详情】加载失败:', err);
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      });
      setTimeout(() => wx.navigateBack(), 1500);
    }
  },

  // 预览图片
  onPreviewImage(e) {
    const url = e.currentTarget.dataset.url;
    wx.previewImage({
      urls: [url],
      current: url
    });
  },

  // Logo加载错误处理
  onLogoError(e) {
    console.warn('店铺Logo加载失败，使用默认图片');
    this.setData({
      'storeInfo.logoUrl': '/pages/小标/商家.png'
    });
  },

  // 格式化日期为中国时间（UTC+8）
  formatDateChina(date) {
    if (!date) return '';
    
    let d;
    
    // 处理云数据库的Date对象（有getTime方法）
    if (date && typeof date === 'object' && date.getTime && typeof date.getTime === 'function') {
      d = new Date(date.getTime());
    } else if (date && typeof date === 'object' && date.getFullYear) {
      d = date;
    } else if (typeof date === 'string') {
      // 处理字符串日期
      let dateStr = date;
      // 兼容 "2025-11-01 07:32" 格式，转换为 ISO 格式
      if (dateStr.includes(' ') && !dateStr.includes('T')) {
        // 检查是否有时区信息
        const hasTimezone = dateStr.endsWith('Z') || 
                           /[+-]\d{2}:?\d{2}$/.test(dateStr) ||
                           dateStr.match(/[+-]\d{4}$/);
        
        if (!hasTimezone) {
          // 如果没有时区信息，假设是UTC时间（云数据库通常返回UTC时间），添加Z后缀
          dateStr = dateStr.replace(' ', 'T') + 'Z';
        } else {
          dateStr = dateStr.replace(' ', 'T');
        }
      }
      // 兼容 iOS 格式
      if (dateStr.includes('-') && !dateStr.includes('T') && !dateStr.includes('Z')) {
        dateStr = dateStr.replace(/(\d{4})-(\d{2})-(\d{2})/, '$1/$2/$3');
      }
      d = new Date(dateStr);
    } else if (typeof date === 'object' && date.type === 'date') {
      // 处理云数据库的特殊日期对象格式
      if (date.date) {
        d = new Date(date.date);
      } else {
        d = new Date(date);
      }
    } else {
      d = new Date(date);
    }
    
    if (isNaN(d.getTime())) {
      console.warn('【格式化日期】无效的日期:', date);
      return '';
    }
    
    // 云函数返回的日期通常是UTC时间，需要转换为中国时间（UTC+8）
    // 获取UTC时间戳，然后加上8小时
    const chinaTimeOffset = 8 * 60 * 60 * 1000; // 8小时的毫秒数
    const chinaTime = new Date(d.getTime() + chinaTimeOffset);
    
    // 使用UTC方法获取时间组件（因为我们已经手动加上了时区偏移）
    const year = chinaTime.getUTCFullYear();
    const month = String(chinaTime.getUTCMonth() + 1).padStart(2, '0');
    const day = String(chinaTime.getUTCDate()).padStart(2, '0');
    const hour = String(chinaTime.getUTCHours()).padStart(2, '0');
    const minute = String(chinaTime.getUTCMinutes()).padStart(2, '0');
    
    return `${year}-${month}-${day} ${hour}:${minute}`;
  },

  // 返回
  onBack() {
    wx.navigateBack();
  }
});

