Page({
  data: {
    orderId: '',
    storeId: '',
    rating: 5, // 默认5星
    content: '',
    images: [],
    maxImages: 9,
    isSubmitting: false
  },

  onLoad(options) {
    if (options.orderId) {
      this.setData({
        orderId: options.orderId
      });
    } else {
      // 如果没有订单ID，生成一个临时ID（用于测试）
      this.setData({
        orderId: 'temp_' + Date.now()
      });
    }
    if (options.storeId) {
      this.setData({
        storeId: options.storeId
      });
    }
  },

  // 选择星级
  onRatingTap(e) {
    const rating = e.currentTarget.dataset.rating;
    this.setData({
      rating: rating
    });
  },

  // 输入评论内容
  onContentInput(e) {
    this.setData({
      content: e.detail.value
    });
  },

  // 选择图片
  onChooseImage() {
    const { images, maxImages } = this.data;
    const remaining = maxImages - images.length;

    if (remaining <= 0) {
      wx.showToast({
        title: `最多只能上传${maxImages}张图片`,
        icon: 'none'
      });
      return;
    }

    wx.chooseImage({
      count: remaining,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const tempFiles = res.tempFilePaths;
        
        // 逐个上传图片
        this.uploadImages(tempFiles);
      },
      fail: (err) => {
        console.error('选择图片失败:', err);
        wx.showToast({
          title: '选择图片失败',
          icon: 'none'
        });
      }
    });
  },

  // 上传图片到云存储
  uploadImages(tempFiles) {
    wx.showLoading({ title: '上传中...' });

    const uploadPromises = tempFiles.map((filePath, index) => {
      return new Promise((resolve, reject) => {
        const timestamp = Date.now();
        const randomStr = Math.random().toString(36).substring(2, 8);
        // 如果没有orderId，使用随机字符串
        const orderId = this.data.orderId || randomStr;
        const cloudPath = `reviews/${orderId}_${timestamp}_${index}.jpg`;
        
        wx.cloud.uploadFile({
          cloudPath: cloudPath,
          filePath: filePath,
          success: (res) => {
            resolve(res.fileID);
          },
          fail: (err) => {
            console.error('上传图片失败:', err);
            reject(err);
          }
        });
      });
    });

    Promise.all(uploadPromises)
      .then((fileIDs) => {
        this.setData({
          images: [...this.data.images, ...fileIDs]
        });
        wx.hideLoading();
        wx.showToast({
          title: '上传成功',
          icon: 'success'
        });
      })
      .catch((err) => {
        wx.hideLoading();
        console.error('批量上传失败:', err);
        wx.showToast({
          title: '上传失败',
          icon: 'none'
        });
      });
  },

  // 删除图片
  onDeleteImage(e) {
    const index = e.currentTarget.dataset.index;
    const images = this.data.images;
    images.splice(index, 1);
    this.setData({
      images: images
    });
  },

  // 预览图片
  onPreviewImage(e) {
    const index = e.currentTarget.dataset.index;
    const images = this.data.images;
    
    wx.previewImage({
      current: images[index],
      urls: images
    });
  },

  // 返回上一页
  onBackTap() {
    wx.navigateBack();
  },

  // 提交评论
  onSubmitReview() {
    const { orderId, storeId, rating, content, images, isSubmitting } = this.data;

    if (isSubmitting) {
      return;
    }

    // 基本验证
    if (!storeId) {
      wx.showToast({
        title: '缺少店铺信息',
        icon: 'none'
      });
      return;
    }

    // 评分验证（必填）
    if (!rating || rating < 1 || rating > 5) {
      wx.showToast({
        title: '请选择评分',
        icon: 'none'
      });
      return;
    }

    // 评论内容和图片至少要有一个
    const hasContent = content && content.trim().length > 0;
    const hasImages = images && images.length > 0;
    
    if (!hasContent && !hasImages) {
      wx.showToast({
        title: '请填写评论或上传图片',
        icon: 'none'
      });
      return;
    }

    this.setData({
      isSubmitting: true
    });

    wx.showLoading({ title: '提交中...' });

    // 调用云函数提交评论
    wx.cloud.callFunction({
      name: 'reviewManage',
      data: {
        action: 'submitReview',
        data: {
          orderId: orderId,
          storeId: storeId,
          rating: rating,
          content: content,
          images: images
        }
      },
      success: (res) => {
        wx.hideLoading();
        
        if (res.result.code === 200) {
          wx.showToast({
            title: '评论成功',
            icon: 'success',
            duration: 1500
          });

          // 延迟跳转到评论页面
          setTimeout(() => {
            // 跳转到评论页面并刷新
            wx.redirectTo({
              url: `/pages/reviews/index?storeId=${storeId}&refresh=true`,
              success: () => {
                console.log('跳转到评论页面成功');
              },
              fail: (err) => {
                console.error('跳转失败:', err);
                // 如果跳转失败，返回上一页
                wx.navigateBack();
              }
            });
          }, 1500);
        } else {
          wx.showToast({
            title: res.result.message || '提交失败',
            icon: 'none',
            duration: 2000
          });
        }
      },
      fail: (err) => {
        wx.hideLoading();
        console.error('提交评论失败:', err);
        wx.showToast({
          title: '提交失败',
          icon: 'none'
        });
      },
      complete: () => {
        this.setData({
          isSubmitting: false
        });
      }
    });
  }
});

