Page({
  data: {
    statusBarHeight: wx.getWindowInfo().statusBarHeight || 20,
    activeTab: 1, // 默认选中"全部评价"
    reviews: [],
    allReviews: [], // 保存所有评价，用于筛选
    storeId: '', // 店铺ID
    loading: false,
    // 评分统计
    ratingStats: {
      overallRating: 0,
      totalReviews: 0
    },
    // 回复相关
    showReplyModal: false,
    currentReviewId: '',
    replyContent: '',
    replying: false
  },

  onLoad() {
    console.log('【评价管理】页面加载');
    this.initPage();
  },

  onShow() {
    if (!this.data.storeId) return;
    const now = Date.now();
    if (this._reviewsLastLoadTime && (now - this._reviewsLastLoadTime < 60000)) return;
    this.loadReviews();
    this.loadRatingStats();
  },

  // 初始化页面
  async initPage() {
    // 先获取店铺ID
    const storeId = await this.getStoreId();
    if (storeId) {
      // 店铺ID获取成功后，加载数据
      this.loadReviews();
      this.loadRatingStats();
    } else {
      // 如果获取失败，延迟重试
      setTimeout(() => {
        if (this.data.storeId) {
          this.loadReviews();
          this.loadRatingStats();
        } else {
          console.error('【评价管理】店铺ID获取失败，无法加载数据');
          wx.showToast({
            title: '获取店铺信息失败',
            icon: 'none'
          });
        }
      }, 1000);
    }
  },

  // 获取店铺ID
  async getStoreId() {
    const merchantInfo = wx.getStorageSync('merchantInfo');
    if (merchantInfo && merchantInfo.storeId) {
      this.setData({ storeId: merchantInfo.storeId });
      console.log('【评价管理】从本地存储获取店铺ID:', merchantInfo.storeId);
      return merchantInfo.storeId;
    }
    
    // 如果没有storeId，尝试从云函数获取
    try {
      wx.showLoading({ title: '获取店铺信息...' });
      const res = await wx.cloud.callFunction({
        name: 'storeManage',
        data: {
          action: 'getStoreInfo',
          data: {}
        }
      });
      wx.hideLoading();
      
      console.log('【评价管理】云函数返回:', res.result);
      
      if (res.result && res.result.code === 200 && res.result.data.storeInfo) {
        const storeInfo = res.result.data.storeInfo;
        const storeId = storeInfo._id || storeInfo.storeId || storeInfo.id;
        if (storeId) {
          console.log('【评价管理】获取到店铺ID:', storeId);
          this.setData({ storeId: storeId });
          // 更新本地存储
          const merchantInfo = wx.getStorageSync('merchantInfo') || {};
          merchantInfo.storeId = storeId;
          wx.setStorageSync('merchantInfo', merchantInfo);
          return storeId;
        }
      }
      
      console.error('【评价管理】未能获取店铺ID');
      wx.showToast({
        title: '获取店铺信息失败',
        icon: 'none'
      });
    } catch (err) {
      wx.hideLoading();
      console.error('【评价管理】获取店铺ID失败:', err);
      wx.showToast({
        title: '获取店铺信息失败',
        icon: 'none'
      });
    }
    
    return null;
  },

  // 加载评价列表
  async loadReviews() {
    const storeId = this.data.storeId;
    if (!storeId) {
      console.log('【评价管理】店铺ID为空，等待获取');
      setTimeout(() => {
        if (this.data.storeId) {
          this.loadReviews();
        }
      }, 500);
      return;
    }

    if (this.data.loading) {
      return;
    }

    this.setData({ loading: true });

    try {
      wx.showLoading({ title: '加载中...' });

      const res = await wx.cloud.callFunction({
        name: 'reviewManage',
        data: {
          action: 'getReviewList',
          data: {
            storeId: storeId,
            page: 1,
            pageSize: 100 // 获取所有评价用于筛选
          }
        }
      });

      wx.hideLoading();

      if (res.result && res.result.code === 200) {
        const rawList = res.result.data.list || [];
        console.log('【评价管理】原始数据数量:', rawList.length);
        console.log('【评价管理】原始数据示例:', rawList.length > 0 ? JSON.stringify(rawList[0]) : '无数据');
        
        const reviews = this.formatReviews(rawList);
        console.log('【评价管理】格式化后数量:', reviews.length);
        console.log('【评价管理】格式化后示例:', reviews.length > 0 ? JSON.stringify(reviews[0]) : '无数据');
        
        // 检查是否有重复的id（iOS对wx:key要求严格）
        const idSet = new Set();
        const duplicateIds = [];
        reviews.forEach((review, index) => {
          if (idSet.has(review.id)) {
            duplicateIds.push({ index, id: review.id });
            // 如果发现重复，生成新的唯一ID
            review.id = `review_${review._id || 'unknown'}_${index}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          }
          idSet.add(review.id);
        });
        if (duplicateIds.length > 0) {
          console.warn('【评价管理】发现重复的id，已修复:', duplicateIds);
        }
        
        // 转换所有图片的fileID为可访问的URL
        await this.convertImageFileIDs(reviews);
        
        const filteredReviews = this.filterReviews(reviews, this.data.activeTab);
        console.log('【评价管理】筛选后数量:', filteredReviews.length);
        console.log('【评价管理】当前标签:', this.data.activeTab, '筛选后示例:', filteredReviews.length > 0 ? JSON.stringify(filteredReviews[0]) : '无数据');
        
        // 直接使用setData，确保数据格式正确
        // 确保reviews是数组且不为null/undefined
        const finalReviews = Array.isArray(filteredReviews) ? filteredReviews : [];
        const finalAllReviews = Array.isArray(reviews) ? reviews : [];
        
        console.log('【评价管理】准备setData，finalReviews数量:', finalReviews.length);
        console.log('【评价管理】准备setData，finalAllReviews数量:', finalAllReviews.length);
        
        this.setData({
          allReviews: finalAllReviews,
          reviews: finalReviews,
          loading: false
        });
        this._reviewsLastLoadTime = Date.now();
      } else {
        console.error('【评价管理】加载失败:', res.result);
        wx.showToast({
          title: res.result?.message || '加载失败',
          icon: 'none',
          duration: 2000
        });
        this.setData({ loading: false });
      }
    } catch (error) {
      wx.hideLoading();
      console.error('【评价管理】加载异常:', error);
      console.error('【评价管理】错误详情:', JSON.stringify(error));
      wx.showToast({
        title: '加载失败: ' + (error.message || '未知错误'),
        icon: 'none',
        duration: 3000
      });
      this.setData({ loading: false });
    }
  },

  // 加载评分统计
  async loadRatingStats() {
    const storeId = this.data.storeId;
    if (!storeId) {
      return;
    }

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

      if (res.result && res.result.code === 200) {
        const overallRating = res.result.data.overallRating || 0;
        const totalReviews = res.result.data.totalReviews || 0;
        console.log('【评价管理】评分统计:', { overallRating, totalReviews });
        this.setData({
          ratingStats: {
            overallRating: overallRating,
            totalReviews: totalReviews
          }
        });
      } else {
        console.error('【评价管理】获取评分统计失败:', res.result);
      }
    } catch (error) {
      console.error('【评价管理】加载评分统计失败:', error);
      console.error('【评价管理】评分统计错误详情:', JSON.stringify(error));
    }
  },

  // 格式化评价数据
  formatReviews(reviews) {
    if (!reviews || !Array.isArray(reviews)) {
      console.warn('【评价管理】formatReviews: reviews不是数组', reviews);
      return [];
    }
    
    return reviews.map(review => {
      // 确保rating是数字类型（iOS对类型更严格）
      let rating = review.rating;
      if (typeof rating === 'string') {
        rating = parseInt(rating) || 5;
      } else if (typeof rating !== 'number' || isNaN(rating)) {
        rating = 5;
      }
      // 确保rating在1-5范围内
      rating = Math.max(1, Math.min(5, rating));
      
      // 确保hasReply是严格的布尔值
      // 优先使用hasMerchantReply字段，如果不存在则根据merchantReply内容判断
      let hasReply = false;
      if (review.hasMerchantReply !== undefined && review.hasMerchantReply !== null) {
        hasReply = review.hasMerchantReply === true || review.hasMerchantReply === 'true' || review.hasMerchantReply === 1;
      } else if (review.merchantReply) {
        hasReply = !!(review.merchantReply && String(review.merchantReply).trim().length > 0);
      }
      
      // 确保id不为空且唯一，iOS对wx:key要求严格
      // 使用_id作为主要标识，如果不存在则生成唯一ID
      let reviewId = review._id;
      if (!reviewId || typeof reviewId !== 'string' || reviewId.trim() === '') {
        reviewId = `review_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      }
      
      return {
        id: reviewId,
        _id: review._id || reviewId, // 保留原始_id用于后续操作
        username: review.userName || '用户',
        avatar: review.userAvatar || '/pages/小标/商家.png',
        date: this.formatDate(review.createdAt) || '',
        rating: rating,
        content: review.content || '',
        images: review.images || [], // 先保存fileID，后面会转换为URL
        imageFileIDs: review.images || [], // 保存原始fileID用于转换
        reply: review.merchantReply || '',
        hasReply: hasReply
      };
    });
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

      console.log('【商家评价管理-转换图片URL】开始转换，fileID数量:', allFileIDs.length);

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
              console.error('【商家评价管理-转换图片URL】转换失败:', fileID, item.errMsg);
              // 如果转换失败，使用原fileID（可能已经是URL）
              urlMap.set(fileID, fileID);
            }
          });
        } catch (error) {
          console.error('【商家评价管理-转换图片URL】批量转换异常:', error);
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

      console.log('【商家评价管理-转换图片URL】转换完成，成功转换:', urlMap.size);
    } catch (error) {
      console.error('【商家评价管理-转换图片URL】转换过程异常:', error);
      // 如果转换失败，保持原fileID不变
    }
  },

  // 筛选评价
  filterReviews(reviews, tabIndex) {
    if (!reviews || !Array.isArray(reviews)) {
      console.warn('【评价管理】filterReviews: reviews不是数组', reviews);
      return [];
    }
    
    if (tabIndex === 0) {
      // 未回复 - 确保hasReply是严格的布尔值判断
      const filtered = reviews.filter(review => {
        // 使用与formatReviews相同的逻辑判断hasReply
        let hasReply = false;
        if (review.hasReply !== undefined && review.hasReply !== null) {
          hasReply = review.hasReply === true || review.hasReply === 'true' || review.hasReply === 1;
        } else if (review.reply) {
          hasReply = !!(review.reply && String(review.reply).trim().length > 0);
        }
        return !hasReply;
      });
      console.log('【评价管理】筛选未回复，原始数量:', reviews.length, '筛选后数量:', filtered.length);
      return filtered;
    } else {
      // 全部评价
      return reviews;
    }
  },

  // 预览图片
  onPreviewImage(e) {
    const { images, index } = e.currentTarget.dataset;
    
    // 检查数据是否有效
    if (!images || !Array.isArray(images) || images.length === 0) {
      console.error('【商家评价管理-预览图片】图片数组无效:', images);
      wx.showToast({
        title: '图片加载失败',
        icon: 'none',
        duration: 2000
      });
      return;
    }
    
    const currentIndex = parseInt(index) || 0;
    if (currentIndex < 0 || currentIndex >= images.length) {
      console.error('【商家评价管理-预览图片】索引无效:', currentIndex, '图片数量:', images.length);
      return;
    }
    
    // 过滤掉无效的图片URL（支持http、https、cloud://等格式）
    const validImages = images.filter(img => {
      if (!img || typeof img !== 'string') return false;
      return img.startsWith('http://') || 
             img.startsWith('https://') || 
             img.startsWith('cloud://') ||
             img.startsWith('wxfile://') ||
             img.length > 0; // 允许其他格式，让小程序自己处理
    });
    
    if (validImages.length === 0) {
      wx.showToast({
        title: '暂无有效图片',
        icon: 'none',
        duration: 2000
      });
      return;
    }
    
    // 找到当前图片在有效图片中的索引
    const currentImage = images[currentIndex];
    let finalIndex = 0;
    
    if (currentImage && validImages.includes(currentImage)) {
      finalIndex = validImages.indexOf(currentImage);
    } else if (currentIndex < validImages.length) {
      // 如果当前图片无效，但索引在有效范围内，使用索引
      finalIndex = currentIndex;
    }
    
    console.log('【商家评价管理-预览图片】预览图片，当前索引:', finalIndex, '总数量:', validImages.length);
    
    wx.previewImage({
      current: validImages[finalIndex],
      urls: validImages,
      fail: (err) => {
        console.error('【商家评价管理-预览图片】预览失败:', err);
        wx.showToast({
          title: '图片预览失败',
          icon: 'none',
          duration: 2000
        });
      }
    });
  },

  onBack() {
    wx.navigateBack();
  },

  onTabTap(e) {
    const index = Number(e.currentTarget.dataset.index);
    console.log('【评价管理】切换标签，从', this.data.activeTab, '到', index);
    console.log('【评价管理】allReviews数量:', this.data.allReviews.length);
    
    const filteredReviews = this.filterReviews(this.data.allReviews, index);
    console.log('【评价管理】切换后筛选数量:', filteredReviews.length);
    
    this.setData({ 
      activeTab: index,
      reviews: filteredReviews
    }, () => {
      console.log('【评价管理】标签切换完成，当前reviews数量:', this.data.reviews.length);
    });
  },

  // 打开回复弹窗
  onOpenReply(e) {
    const reviewId = e.currentTarget.dataset.id;
    const review = this.data.reviews.find(r => r.id === reviewId);
    
    if (!review) {
      return;
    }

    this.setData({
      showReplyModal: true,
      currentReviewId: reviewId,
      replyContent: review.reply || ''
    });
  },

  // 关闭回复弹窗
  onCloseReply() {
    this.setData({
      showReplyModal: false,
      currentReviewId: '',
      replyContent: ''
    });
  },

  // 阻止事件冒泡
  stopPropagation() {
    // 阻止事件冒泡，防止点击弹窗内容区域时关闭弹窗
  },

  // 输入框获得焦点
  onTextareaFocus() {
    // 输入框获得焦点时，不做任何操作
  },

  // 输入框失去焦点
  onTextareaBlur() {
    // 输入框失去焦点时，不做任何操作
  },

  // 输入回复内容
  onReplyInput(e) {
    this.setData({
      replyContent: e.detail.value
    });
  },

  // 提交回复
  async onSubmitReply() {
    const { currentReviewId, replyContent } = this.data;

    if (!replyContent || !replyContent.trim()) {
      wx.showToast({
        title: '请输入回复内容',
        icon: 'none'
      });
      return;
    }

    if (this.data.replying) {
      return;
    }

    this.setData({ replying: true });

    try {
      wx.showLoading({ title: '提交中...' });

      const res = await wx.cloud.callFunction({
        name: 'reviewManage',
        data: {
          action: 'merchantReply',
          data: {
            reviewId: currentReviewId,
            replyContent: replyContent.trim()
          }
        }
      });

      wx.hideLoading();

      if (res.result && res.result.code === 200) {
        wx.showToast({
          title: '回复成功',
          icon: 'success'
        });

        // 关闭弹窗
        this.onCloseReply();

        // 重新加载评价列表
        this.loadReviews();
      } else {
        wx.showToast({
          title: res.result?.message || '回复失败',
          icon: 'none'
        });
        this.setData({ replying: false });
      }
    } catch (error) {
      wx.hideLoading();
      console.error('【评价管理】回复异常:', error);
      wx.showToast({
        title: '回复失败',
        icon: 'none'
      });
      this.setData({ replying: false });
    }
  }
});
