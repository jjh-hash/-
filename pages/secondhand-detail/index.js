// pages/secondhand-detail/index.js
Page({
  data: {
    statusBarHeight: wx.getWindowInfo().statusBarHeight || 20,
    productId: '',
    product: null,
    loading: true,
    currentImageIndex: 0,
    showAllImages: false
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
          discount: product.discount || (product.originalPrice 
            ? Math.round((1 - product.price / product.originalPrice) * 100)
            : 0)
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
  async onContactSeller() {
    if (!this.data.product || !this.data.product.seller || !this.data.product.seller.id) {
      wx.showToast({
        title: '卖家信息不存在',
        icon: 'none'
      });
      return;
    }

    const sellerId = this.data.product.seller.id;
    
    wx.showLoading({ title: '获取联系方式...' });

    try {
      // 通过 sellerId (openid) 查询用户信息
      // sellerId 可能是 openid，云函数已支持通过 openid 查询
      const res = await wx.cloud.callFunction({
        name: 'userManage',
        data: {
          action: 'getUserDetail',
          data: {
            userId: sellerId, // 云函数会尝试作为 _id 或 openid 查询
            openid: sellerId // 明确指定通过 openid 查询
          }
        }
      });

      wx.hideLoading();

      if (res.result && res.result.code === 200) {
        const sellerUserInfo = res.result.data.user || res.result.data;
        const phone = sellerUserInfo.phone;

        if (phone && phone !== '未绑定' && phone.trim() !== '') {
          // 直接跳转到聊天页面
          wx.navigateTo({
            url: `/pages/chat/index?toUserId=${sellerId}&toUserName=${encodeURIComponent(sellerUserInfo.nickname || sellerUserInfo.userName || '卖家')}&messageType=secondhand&relatedId=${this.data.productId}&relatedTitle=${encodeURIComponent(this.data.product ? this.data.product.title : '闲置商品')}`
          });
        } else {
          // 没有电话号码，显示提示
          wx.showModal({
            title: '联系卖家',
            content: '卖家未设置有效的电话号码，请通过其他方式联系。',
            showCancel: false,
            confirmText: '知道了'
          });
        }
      } else {
        // 查询失败，可能是 sellerId 是 openid 而不是 _id
        // 尝试通过 openid 查询用户信息
        try {
          const userRes = await wx.cloud.callFunction({
            name: 'loginUser',
            data: {
              action: 'getUserInfo',
              data: {
                openid: sellerId
              }
            }
          });

          if (userRes.result && userRes.result.code === 200) {
            const sellerUserInfo = userRes.result.data.user || userRes.result.data;
            const phone = sellerUserInfo.phone;

            if (phone && phone !== '未绑定' && phone.trim() !== '') {
              // 直接跳转到聊天页面
              wx.navigateTo({
                url: `/pages/chat/index?toUserId=${sellerId}&toUserName=${encodeURIComponent(sellerUserInfo.nickname || sellerUserInfo.userName || '卖家')}&messageType=secondhand&relatedId=${this.data.productId}&relatedTitle=${encodeURIComponent(this.data.product ? this.data.product.title : '闲置商品')}`
              });
              return;
            }
          }
        } catch (err) {
          console.error('【闲置出售详情】通过openid查询用户信息失败:', err);
        }

        // 如果都查询失败，显示提示
        wx.showModal({
          title: '联系卖家',
          content: '无法获取卖家联系方式。您可以通过以下方式联系：\n1. 在商品详情中查看是否有其他联系方式\n2. 通过微信小程序客服功能联系',
          showCancel: false,
          confirmText: '知道了'
        });
      }
    } catch (err) {
      wx.hideLoading();
      console.error('【闲置出售详情】获取卖家信息失败:', err);
      wx.showModal({
        title: '联系卖家',
        content: '无法获取卖家联系方式。您可以通过以下方式联系：\n1. 在商品详情中查看是否有其他联系方式\n2. 通过微信小程序客服功能联系',
        showCancel: false,
        confirmText: '知道了'
      });
    }
  },

  // 返回
  onBackTap() {
    wx.navigateBack();
  },

  // 分享
  onShareAppMessage() {
    return {
      title: this.data.product ? `${this.data.product.title} - 校园闲置出售` : '校园闲置出售',
      path: `/pages/secondhand-detail/index?id=${this.data.productId}`,
      imageUrl: this.data.product && this.data.product.images && this.data.product.images[0] 
        ? this.data.product.images[0] 
        : ''
    };
  }
});

