Page({
  data: {
    statusBarHeight: wx.getWindowInfo().statusBarHeight || 20,
    reviews: [],
    loading: false,
    isEmpty: false
  },

  onLoad() {
    this.loadMyReviews();
  },

  onShow() {
    // 页面显示时刷新列表
    this.loadMyReviews();
  },

  // 加载我的评价列表
  async loadMyReviews() {
    this.setData({
      loading: true
    });

    try {
      const res = await wx.cloud.callFunction({
        name: 'reviewManage',
        data: {
          action: 'getMyReviews',
          data: {}
        }
      });

      console.log('获取我的评价列表:', res.result);

      if (res.result.code === 200) {
        const reviews = res.result.data.list.map(review => {
          const rating = parseInt(review.rating) || 5;
          
          // 生成星星数组（使用布尔值，true表示实心星，false表示空心星）
          const stars = [];
          for (let i = 0; i < 5; i++) {
            stars.push(i < rating);
          }

          return {
            id: review._id,
            storeId: review.storeId,
            storeName: review.storeName || '店铺',
            rating: rating,
            stars: stars,
            content: review.content,
            images: review.images || [], // 先保存fileID，后面会转换为URL
            imageFileIDs: review.images || [], // 保存原始fileID用于转换
            date: this.formatDate(review.createdAt),
            merchantReply: review.merchantReply || null,
            hasMerchantReply: review.hasMerchantReply || false
          };
        });

        // 转换所有图片的fileID为可访问的URL
        await this.convertImageFileIDs(reviews);

        this.setData({
          reviews: reviews,
          isEmpty: reviews.length === 0,
          loading: false
        });
      } else {
        wx.showToast({
          title: res.result.message || '加载失败',
          icon: 'none'
        });
        this.setData({
          loading: false
        });
      }
    } catch (error) {
      console.error('加载我的评价失败:', error);
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      });
      this.setData({
        loading: false
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

  // 返回上一页
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

      console.log('【我的评价-转换图片URL】开始转换，fileID数量:', allFileIDs.length);

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
              console.error('【我的评价-转换图片URL】转换失败:', fileID, item.errMsg);
              // 如果转换失败，使用原fileID（可能已经是URL）
              urlMap.set(fileID, fileID);
            }
          });
        } catch (error) {
          console.error('【我的评价-转换图片URL】批量转换异常:', error);
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

      console.log('【我的评价-转换图片URL】转换完成，成功转换:', urlMap.size);
    } catch (error) {
      console.error('【我的评价-转换图片URL】转换过程异常:', error);
      // 如果转换失败，保持原fileID不变
    }
  },

  // 预览图片
  onPreviewImage(e) {
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

  // 删除评价
  onDeleteReview(e) {
    const reviewId = e.currentTarget.dataset.id;
    
    wx.showModal({
      title: '确认删除',
      content: '确定要删除这条评价吗？',
      success: async (res) => {
        if (res.confirm) {
          await this.deleteReview(reviewId);
        }
      }
    });
  },

  // 删除评价
  async deleteReview(reviewId) {
    wx.showLoading({ title: '删除中...' });

    try {
      const res = await wx.cloud.callFunction({
        name: 'reviewManage',
        data: {
          action: 'deleteReview',
          data: {
            reviewId: reviewId
          }
        }
      });

      wx.hideLoading();

      if (res.result.code === 200) {
        wx.showToast({
          title: '删除成功',
          icon: 'success'
        });
        // 重新加载列表
        this.loadMyReviews();
      } else {
        wx.showToast({
          title: res.result.message || '删除失败',
          icon: 'none'
        });
      }
    } catch (error) {
      wx.hideLoading();
      console.error('删除评价失败:', error);
      wx.showToast({
        title: '删除失败',
        icon: 'none'
      });
    }
  }
});

