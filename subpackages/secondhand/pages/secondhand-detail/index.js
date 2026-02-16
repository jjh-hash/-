// pages/secondhand-detail/index.js
Page({
  data: {
    statusBarHeight: wx.getWindowInfo().statusBarHeight || 20,
    productId: '',
    product: null,
    loading: true,
    currentImageIndex: 0,
    showAllImages: false,
    showContactModal: false,
    contactType: '',
    contactInfo: ''
  },

  onLoad(options) {
    if (options.id) {
      this.setData({ productId: options.id });
      this.loadProductDetail();
    } else {
      wx.showToast({
        title: '商品ID不存在',
        icon: 'none'
      });
      setTimeout(() => wx.navigateBack(), 1500);
    }
  },

  // 加载商品详情
  async loadProductDetail() {
    wx.showLoading({ title: '加载中...' });

    try {
      const res = await wx.cloud.callFunction({
        name: 'idleProductManage',
        data: {
          action: 'getDetail',
          data: {
            productId: this.data.productId
          }
        }
      });

      wx.hideLoading();

      if (res.result && res.result.code === 200) {
        const product = res.result.data;
        
        // 计算折扣的辅助函数
        const calculateDiscount = (price, originalPrice) => {
          // 转换为数字
          const priceNum = parseFloat(price);
          const originalPriceNum = parseFloat(originalPrice);
          
          // 验证条件：原价必须存在且大于0，现价必须有效且小于等于原价
          if (!originalPriceNum || originalPriceNum <= 0 || isNaN(priceNum) || priceNum < 0 || priceNum > originalPriceNum) {
            return 0;
          }
          
          // 计算折扣百分比（例如：8折 = 80）
          return Math.round((1 - priceNum / originalPriceNum) * 100);
        };

        // 格式化商品数据
        const formattedProduct = {
          ...product,
          images: product.images || [],
          publishTime: product.publishTime || this.formatTime(product.createdAt),
          seller: {
            name: product.sellerName || '匿名用户',
            avatar: product.sellerAvatar || '/pages/小标/商家.png',
            id: product.sellerId
          },
          discount: product.discount !== undefined && product.discount !== null 
            ? product.discount 
            : calculateDiscount(product.price, product.originalPrice),
          contactType: product.contactType || '',
          contactInfo: product.contactInfo || ''
        };

        this.setData({
          product: formattedProduct,
          loading: false
        });
      } else {
        wx.hideLoading();
        wx.showToast({
          title: res.result?.message || '加载失败',
          icon: 'none'
        });
        setTimeout(() => wx.navigateBack(), 1500);
      }
    } catch (err) {
      wx.hideLoading();
      console.error('加载商品详情失败:', err);
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      });
      setTimeout(() => wx.navigateBack(), 1500);
    }
  },

  // 格式化时间
  formatTime(timestamp) {
    if (!timestamp) return '刚刚';
    
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    
    const minute = 60 * 1000;
    const hour = 60 * minute;
    const day = 24 * hour;
    
    if (diff < minute) {
      return '刚刚';
    } else if (diff < hour) {
      return `${Math.floor(diff / minute)}分钟前`;
    } else if (diff < day) {
      return `${Math.floor(diff / hour)}小时前`;
    } else if (diff < 7 * day) {
      return `${Math.floor(diff / day)}天前`;
    } else {
      const month = date.getMonth() + 1;
      const day = date.getDate();
      return `${month}月${day}日`;
    }
  },

  // 图片切换
  onImageChange(e) {
    const index = e.detail.current;
    this.setData({
      currentImageIndex: index
    });
  },

  // 预览图片
  onPreviewImage(e) {
    const index = e.currentTarget.dataset.index;
    const images = this.data.product.images;
    
    wx.previewImage({
      current: images[index],
      urls: images
    });
  },

  // 联系卖家
  onContactSeller() {
    if (!this.data.product) {
      wx.showToast({
        title: '商品信息不存在',
        icon: 'none'
      });
      return;
    }

    // 从商品数据中获取联系方式
    const contactType = this.data.product.contactType || '';
    const contactInfo = this.data.product.contactInfo || '';

    if (!contactInfo || contactInfo.trim() === '') {
      wx.showModal({
        title: '联系卖家',
        content: '卖家未填写联系方式，请通过其他方式联系。',
        showCancel: false,
        confirmText: '知道了'
      });
      return;
    }

    // 显示联系方式弹窗
    this.setData({
      showContactModal: true,
      contactType: contactType || '联系方式',
      contactInfo: contactInfo
    });
  },

  // 关闭联系方式弹窗
  onCloseContactModal() {
    this.setData({
      showContactModal: false
    });
  },

  // 复制联系方式
  onCopyContact() {
    const contactInfo = this.data.contactInfo;
    if (!contactInfo) {
      return;
    }

    wx.setClipboardData({
      data: contactInfo,
      success: () => {
        wx.showToast({
          title: '已复制到剪贴板',
          icon: 'success'
        });
      },
      fail: () => {
        wx.showToast({
          title: '复制失败',
          icon: 'none'
        });
      }
    });
  },

  // 阻止事件冒泡
  stopPropagation() {
    // 空函数，用于阻止事件冒泡
  },

  // 返回
  onBackTap() {
    wx.navigateBack();
  }
});

