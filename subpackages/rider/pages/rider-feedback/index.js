Page({
  data: {
    feedbackType: 'bug', // 默认选择bug
    feedbackTypes: [
      { value: 'bug', label: '问题反馈', icon: '🐛' },
      { value: 'suggestion', label: '功能建议', icon: '💡' },
      { value: 'complaint', label: '投诉建议', icon: '😞' },
      { value: 'praise', label: '表扬建议', icon: '👍' },
      { value: 'other', label: '其他', icon: '📝' }
    ],
    content: '',
    images: [],
    maxImages: 6,
    contact: '',
    isSubmitting: false
  },

  onLoad(options) {
    // 页面加载
  },

  // 选择反馈类型
  onTypeTap(e) {
    const value = e.currentTarget.dataset.value;
    this.setData({
      feedbackType: value
    });
  },

  // 输入反馈内容
  onContentInput(e) {
    this.setData({
      content: e.detail.value
    });
  },

  // 输入联系方式
  onContactInput(e) {
    this.setData({
      contact: e.detail.value
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
        const cloudPath = `feedback/${timestamp}_${randomStr}_${index}.jpg`;
        
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

  // 提交反馈
  onSubmitFeedback() {
    const { feedbackType, content, images, contact, isSubmitting } = this.data;

    if (isSubmitting) {
      return;
    }

    // 验证反馈内容
    if (!content || !content.trim()) {
      wx.showToast({
        title: '请填写反馈内容',
        icon: 'none'
      });
      return;
    }

    // 验证内容长度
    if (content.trim().length < 5) {
      wx.showToast({
        title: '反馈内容至少5个字符',
        icon: 'none'
      });
      return;
    }

    this.setData({
      isSubmitting: true
    });

    wx.showLoading({ title: '提交中...' });

    // 调用云函数提交反馈
    wx.cloud.callFunction({
      name: 'feedbackManage',
      data: {
        action: 'submitFeedback',
        data: {
          type: feedbackType,
          content: content.trim(),
          images: images,
          contact: contact.trim() || ''
        }
      },
      success: (res) => {
        wx.hideLoading();
        
        if (res.result && res.result.code === 200) {
          wx.showToast({
            title: '反馈提交成功',
            icon: 'success',
            duration: 1500
          });

          // 延迟返回上一页
          setTimeout(() => {
            wx.navigateBack();
          }, 1500);
        } else {
          wx.showToast({
            title: res.result?.message || '提交失败',
            icon: 'none',
            duration: 2000
          });
          this.setData({
            isSubmitting: false
          });
        }
      },
      fail: (err) => {
        wx.hideLoading();
        console.error('提交反馈失败:', err);
        wx.showToast({
          title: '提交失败，请稍后重试',
          icon: 'none'
        });
        this.setData({
          isSubmitting: false
        });
      }
    });
  }
});

