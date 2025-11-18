Page({
  data: {
    statusBarHeight: wx.getWindowInfo().statusBarHeight || 20,
    storeId: '', // 店铺ID
    activeTab: 1, // 默认选中评价标签
    tabs: ['点餐', '评价', '商家'],
    storeInfo: {
      name: '意大利特火小面条馆',
      overallRating: 4.8,
      deliveryRating: 4.8,
      totalReviews: 24,
      ratingStars: [true, true, true, true, true] // 默认5星
    },
    reviews: []
  },

  onLoad(options) {
    // 如果有传入的店铺ID，可以在这里获取店铺详情
    if (options.storeId) {
      this.setData({
        storeId: options.storeId
      });
      this.loadStoreRating(options.storeId);
      this.loadReviewList(options.storeId);
    }
    
    // 如果是刷新页面，重新加载数据
    if (options.refresh === 'true') {
      wx.showToast({
        title: '评论已提交',
        icon: 'success',
        duration: 1500
      });
    }
  },

  // 页面显示时刷新数据
  onShow() {
    if (this.data.storeId) {
      this.loadStoreRating(this.data.storeId);
      this.loadReviewList(this.data.storeId);
    }
  },

  // 加载店铺评分
  async loadStoreRating(storeId) {
    try {
      const res = await wx.cloud.callFunction({
        name: 'reviewManage',
        data: {
          action: 'getStoreRating',
          data: {
            storeId: storeId
          }
        }
      });

      if (res.result.code === 200) {
        const overallRating = res.result.data.overallRating || 0;
        const deliveryRating = res.result.data.deliveryRating || 0;
        
        // 计算商品质量星星数组（根据实际评分）
        // 对于1.5分，显示1颗实心星+4颗空心星（向下取整）
        const ratingStars = [];
        const fullStars = Math.floor(overallRating); // 完整星星数
        
        for (let i = 0; i < 5; i++) {
          ratingStars.push(i < fullStars);
        }
        
        console.log('【店铺评分】评分:', overallRating, '完整星星数:', fullStars, '星星数组:', ratingStars);
        
        this.setData({
          storeInfo: {
            name: this.data.storeInfo.name,
            overallRating: overallRating,
            deliveryRating: deliveryRating,
            totalReviews: res.result.data.totalReviews,
            ratingStars: ratingStars // 添加星星数组
          }
        });
      }
    } catch (error) {
      console.error('加载店铺评分失败:', error);
    }
  },

  // 加载评论列表
  async loadReviewList(storeId) {
    if (!storeId) {
      console.error('【加载评论列表】店铺ID为空');
      return;
    }

    wx.showLoading({ title: '加载中...' });

    try {
      console.log('【加载评论列表】开始加载，店铺ID:', storeId);
      
      const res = await wx.cloud.callFunction({
        name: 'reviewManage',
        data: {
          action: 'getReviewList',
          data: {
            storeId: storeId,
            page: 1,
            pageSize: 20,
            filter: 'all'
          }
        }
      });

      wx.hideLoading();

      console.log('【加载评论列表】云函数返回:', res.result);

      if (res.result && res.result.code === 200) {
        const rawList = res.result.data?.list || [];
        console.log('【加载评论列表】原始数据数量:', rawList.length);
        console.log('【加载评论列表】原始数据示例:', rawList[0]);

        // 格式化评论数据
        const reviews = rawList.map(review => {
          // 确保rating是数字
          let rating = review.rating;
          if (typeof rating === 'string') {
            rating = parseInt(rating) || 5;
          } else if (typeof rating !== 'number' || isNaN(rating)) {
            rating = 5;
          }
          
          console.log('【加载评论列表】处理评论:', review._id, 'rating:', rating);
          
          // 生成星星数组（使用布尔值，true表示实心星，false表示空心星）
          const stars = [];
          for (let i = 0; i < 5; i++) {
            stars.push(i < rating);
          }
          
          return {
            id: review._id,
            userAvatar: review.userAvatar || '/pages/小标/商家.png',
            userName: review.userName || '用户',
            rating: rating,
            stars: stars,
            date: this.formatDate(review.createdAt),
            content: review.content || '',
            images: review.images || [], // 先保存fileID，后面会转换为URL
            imageFileIDs: review.images || [], // 保存原始fileID用于转换
            merchantReply: review.merchantReply || null,
            hasMerchantReply: review.hasMerchantReply || false
          };
        });

        console.log('【加载评论列表】格式化后的评论数量:', reviews.length);
        console.log('【加载评论列表】格式化后的评论列表:', reviews);

        // 转换所有图片的fileID为可访问的URL
        await this.convertImageFileIDs(reviews);

        this.setData({
          reviews: reviews
        });
        
        console.log('【加载评论列表】setData完成，当前reviews数量:', this.data.reviews.length);
      } else {
        console.error('【加载评论列表】返回错误:', res.result);
        wx.showToast({
          title: res.result?.message || '加载失败',
          icon: 'none',
          duration: 2000
        });
      }
    } catch (error) {
      wx.hideLoading();
      console.error('【加载评论列表】异常:', error);
      wx.showToast({
        title: '加载失败',
        icon: 'none',
        duration: 2000
      });
    }
  },

  // 格式化日期 - 兼容iOS和Android
  formatDate(dateStr) {
    if (!dateStr) return '';
    
    let d;
    
    // 处理云数据库的Date对象（有getTime方法）
    if (dateStr.getTime && typeof dateStr.getTime === 'function') {
      d = new Date(dateStr.getTime());
    } else if (dateStr instanceof Date) {
      d = dateStr;
    } else if (typeof dateStr === 'string') {
      // 处理字符串格式的日期
      let dateString = dateStr;
      // 兼容ISO格式和空格格式
      if (dateString.includes(' ') && !dateString.includes('T')) {
        // 检查是否有时区信息
        const hasTimezone = dateString.endsWith('Z') || 
                           /[+-]\d{2}:?\d{2}$/.test(dateString) ||
                           dateString.match(/[+-]\d{4}$/);
        
        if (!hasTimezone) {
          // 如果没有时区信息，假设是UTC时间，添加Z后缀
          dateString = dateString.replace(' ', 'T') + 'Z';
        } else {
          dateString = dateString.replace(' ', 'T');
        }
      }
      // 兼容 iOS 格式（iOS不支持 "2025-11-01" 格式，需要转换为 "2025/11/01"）
      if (dateString.includes('-') && !dateString.includes('T') && !dateString.includes('Z')) {
        dateString = dateString.replace(/(\d{4})-(\d{2})-(\d{2})/, '$1/$2/$3');
      }
      d = new Date(dateString);
    } else if (typeof dateStr === 'object' && dateStr.type === 'date') {
      // 处理云数据库的特殊日期对象格式 { type: 'date', date: '2025-11-11T14:53:00.000Z' }
      if (dateStr.date) {
        d = new Date(dateStr.date);
      } else {
        d = new Date(dateStr);
      }
    } else {
      d = new Date(dateStr);
    }
    
    // 验证日期是否有效
    if (isNaN(d.getTime())) {
      console.warn('【格式化日期】无效的日期:', dateStr);
      return '';
    }
    
    // 云数据库通常返回UTC时间，需要转换为中国时间（UTC+8）
    // 获取UTC时间戳，然后加上8小时
    const chinaTimeOffset = 8 * 60 * 60 * 1000; // 8小时的毫秒数
    const chinaTime = new Date(d.getTime() + chinaTimeOffset);
    
    // 使用UTC方法获取时间组件（因为我们已经手动加上了时区偏移）
    const year = chinaTime.getUTCFullYear();
    const month = String(chinaTime.getUTCMonth() + 1).padStart(2, '0');
    const day = String(chinaTime.getUTCDate()).padStart(2, '0');
    return `${year}.${month}.${day}`;
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


  // 预览图片
  onImageTap(e) {
    const { images, index } = e.currentTarget.dataset;
    
    // 检查数据是否有效
    if (!images || !Array.isArray(images) || images.length === 0) {
      console.error('【预览图片】图片数组无效:', images);
      wx.showToast({
        title: '图片加载失败',
        icon: 'none',
        duration: 2000
      });
      return;
    }
    
    const currentIndex = parseInt(index) || 0;
    if (currentIndex < 0 || currentIndex >= images.length) {
      console.error('【预览图片】索引无效:', currentIndex, '图片数量:', images.length);
      return;
    }
    
    wx.previewImage({
      current: images[currentIndex],
      urls: images
    });
  },

  // 返回
  onBack() {
    wx.navigateBack();
  },

  // 将云存储fileID转换为可访问的临时URL
  async convertImageFileIDs(reviews) {
    try {
      // 收集所有需要转换的fileID
      const allFileIDs = [];
      reviews.forEach(review => {
        if (review.imageFileIDs && review.imageFileIDs.length > 0) {
          allFileIDs.push(...review.imageFileIDs);
        }
      });

      if (allFileIDs.length === 0) {
        return;
      }

      console.log('【转换图片URL】开始转换，fileID数量:', allFileIDs.length);

      // 批量获取临时URL（每次最多20个）
      const batchSize = 20;
      const urlMap = new Map();

      for (let i = 0; i < allFileIDs.length; i += batchSize) {
        const batch = allFileIDs.slice(i, i + batchSize);
        try {
          const res = await wx.cloud.getTempFileURL({
            fileList: batch
          });

          // 将结果映射到fileID
          res.fileList.forEach((item, index) => {
            const fileID = batch[index];
            if (item.status === 'ok') {
              urlMap.set(fileID, item.tempFileURL);
            } else {
              console.error('【转换图片URL】转换失败:', fileID, item.errMsg);
              // 如果转换失败，使用原fileID（可能已经是URL）
              urlMap.set(fileID, fileID);
            }
          });
        } catch (error) {
          console.error('【转换图片URL】批量转换异常:', error);
          // 如果转换失败，使用原fileID
          batch.forEach(fileID => {
            urlMap.set(fileID, fileID);
          });
        }
      }

      // 更新reviews中的images数组
      reviews.forEach(review => {
        if (review.imageFileIDs && review.imageFileIDs.length > 0) {
          review.images = review.imageFileIDs.map(fileID => urlMap.get(fileID) || fileID);
        }
      });

      console.log('【转换图片URL】转换完成，成功转换:', urlMap.size);
    } catch (error) {
      console.error('【转换图片URL】转换过程异常:', error);
      // 如果转换失败，保持原fileID不变
    }
  },

  // 上传图片时使用云存储图片的完整URL
  formatImageUrl(fileID) {
    // 如果已经是完整的云存储URL，直接返回
    if (fileID.startsWith('http://') || fileID.startsWith('https://')) {
      return fileID;
    }
    // 否则返回fileID（小程序会自动转换为访问URL）
    return fileID;
  },

  // 点击发表评论按钮
  onSubmitReviewTap() {
    // 检查是否登录
    const userInfo = wx.getStorageSync('userInfo');
    if (!userInfo) {
      wx.showModal({
        title: '提示',
        content: '请先登录后再发表评论',
        confirmText: '去登录',
        success: (res) => {
          if (res.confirm) {
            wx.navigateTo({
              url: '/pages/user-login/index'
            });
          }
        }
      });
      return;
    }

    // 获取用户的订单列表，让用户选择要评论的订单
    this.getUserOrdersForReview();
  },

  // 获取用户订单列表用于评论
  async getUserOrdersForReview() {
    wx.showLoading({ title: '加载中...' });

    try {
      // 调用云函数获取用户未评论的订单
      const res = await wx.cloud.callFunction({
        name: 'orderManage', // 需要确保有这个云函数
        data: {
          action: 'getUserOrdersForReview',
          data: {
            storeId: this.data.storeId
          }
        }
      });

      wx.hideLoading();

      if (res.result && res.result.code === 200 && res.result.data.list.length > 0) {
        // 如果有订单，自动选择第一个订单（最近的订单），直接跳转到评论页面
        const firstOrder = res.result.data.list[0];
        wx.navigateTo({
          url: `/pages/submit-review/index?orderId=${firstOrder._id}&storeId=${this.data.storeId}`
        });
      } else {
        // 如果没有订单，也允许用户评论（允许无订单评论）
        wx.navigateTo({
          url: `/pages/submit-review/index?storeId=${this.data.storeId}`
        });
      }
    } catch (error) {
      wx.hideLoading();
      console.error('获取订单列表失败:', error);
      
      // 获取订单失败时，也允许用户评论（直接跳转到评论页面）
      wx.navigateTo({
        url: `/pages/submit-review/index?storeId=${this.data.storeId}`
      });
    }
  }
});
