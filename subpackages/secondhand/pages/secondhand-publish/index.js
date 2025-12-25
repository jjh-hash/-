// pages/secondhand-publish/index.js
Page({
  data: {
    statusBarHeight: wx.getWindowInfo().statusBarHeight || 20,
    title: '',
    description: '',
    price: '',
    originalPrice: '',
    category: '',
    categoryIndex: 0,
    categories: ['数码电子', '服装配饰', '图书文具', '生活用品', '运动器材', '其他'],
    location: '',
    contactType: '微信号',
    contactTypeIndex: 0,
    contactTypes: ['微信号', '手机号', 'QQ号'],
    contactInfo: '',
    images: [],
    maxImages: 9,
    uploading: false
  },

  onLoad() {
    // 获取用户信息
    this.getUserInfo();
  },

  // 获取用户信息
  async getUserInfo() {
    try {
      const userInfo = wx.getStorageSync('userInfo');
      if (userInfo && userInfo.location) {
        this.setData({
          location: userInfo.location
        });
      }
    } catch (err) {
      console.error('获取用户信息失败:', err);
    }
  },

  // 标题输入
  onTitleInput(e) {
    this.setData({
      title: e.detail.value
    });
  },

  // 描述输入
  onDescriptionInput(e) {
    this.setData({
      description: e.detail.value
    });
  },

  // 价格输入
  onPriceInput(e) {
    this.setData({
      price: e.detail.value
    });
  },

  // 原价输入
  onOriginalPriceInput(e) {
    this.setData({
      originalPrice: e.detail.value
    });
  },

  // 分类选择
  onCategoryChange(e) {
    const index = e.detail.value;
    this.setData({
      categoryIndex: index,
      category: this.data.categories[index]
    });
  },

  // 位置输入
  onLocationInput(e) {
    this.setData({
      location: e.detail.value
    });
  },

  // 联系方式类型选择
  onContactTypeChange(e) {
    const index = e.detail.value;
    const contactTypes = ['微信号', '手机号', 'QQ号'];
    this.setData({
      contactTypeIndex: index,
      contactType: contactTypes[index]
    });
  },

  // 联系方式输入
  onContactInfoInput(e) {
    this.setData({
      contactInfo: e.detail.value
    });
  },

  // 选择图片
  onChooseImage() {
    if (this.data.images.length >= this.data.maxImages) {
      wx.showToast({
        title: `最多只能上传${this.data.maxImages}张图片`,
        icon: 'none'
      });
      return;
    }

    const remaining = this.data.maxImages - this.data.images.length;

    wx.chooseImage({
      count: remaining,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const tempFilePaths = res.tempFilePaths;
        const images = [...this.data.images, ...tempFilePaths];
        
        this.setData({
          images: images
        });
        
        // 上传图片到云存储
        this.uploadImagesToCloud(tempFilePaths);
      }
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

  // 上传图片到云存储
  async uploadImagesToCloud(tempFilePaths) {
    if (this.data.uploading) {
      return;
    }

    this.setData({ uploading: true });
    wx.showLoading({ title: '上传中...' });

    try {
      const uploadPromises = tempFilePaths.map(async (tempFilePath) => {
        const timestamp = Date.now();
        const randomStr = Math.random().toString(36).substr(2, 9);
        const cloudPath = `idle-products/${timestamp}-${randomStr}.jpg`;
        
        const uploadRes = await wx.cloud.uploadFile({
          cloudPath: cloudPath,
          filePath: tempFilePath
        });
        
        return uploadRes.fileID;
      });

      const fileIDs = await Promise.all(uploadPromises);
      
      // 更新图片列表，将临时路径替换为云存储fileID
      const images = this.data.images.map((img, index) => {
        // 如果是新上传的临时路径，替换为fileID
        if (tempFilePaths.includes(img)) {
          const tempIndex = tempFilePaths.indexOf(img);
          return fileIDs[tempIndex];
        }
        return img;
      });

      this.setData({
        images: images,
        uploading: false
      });

      wx.hideLoading();
      wx.showToast({
        title: '图片上传成功',
        icon: 'success',
        duration: 1000
      });
    } catch (err) {
      console.error('图片上传失败:', err);
      this.setData({ uploading: false });
      wx.hideLoading();
      wx.showToast({
        title: '图片上传失败',
        icon: 'none'
      });
    }
  },

  // 发布商品
  async onPublish() {
    // 验证必填项
    if (!this.data.title.trim()) {
      wx.showToast({
        title: '请输入商品标题',
        icon: 'none'
      });
      return;
    }

    if (!this.data.price.trim()) {
      wx.showToast({
        title: '请输入商品价格',
        icon: 'none'
      });
      return;
    }

    if (this.data.images.length === 0) {
      wx.showToast({
        title: '请至少上传一张图片',
        icon: 'none'
      });
      return;
    }

    if (!this.data.category) {
      wx.showToast({
        title: '请选择商品分类',
        icon: 'none'
      });
      return;
    }

    wx.showLoading({ title: '发布中...' });

    try {
      // 获取用户信息
      const userInfo = wx.getStorageSync('userInfo') || {};
      const openid = userInfo.openid || '';

      // 准备发布数据
      const publishData = {
        title: this.data.title.trim(),
        description: this.data.description.trim(),
        price: parseFloat(this.data.price),
        originalPrice: this.data.originalPrice ? parseFloat(this.data.originalPrice) : null,
        category: this.data.category,
        location: this.data.location.trim() || '未填写',
        contactType: this.data.contactType || '微信号',
        contactInfo: this.data.contactInfo.trim() || '',
        images: this.data.images,
        sellerId: openid,
        sellerName: userInfo.nickName || '匿名用户',
        sellerAvatar: userInfo.avatarUrl || ''
      };

      console.log('【发布闲置商品】提交数据:', publishData);

      const res = await wx.cloud.callFunction({
        name: 'idleProductManage',
        data: {
          action: 'publish',
          data: publishData
        }
      });

      wx.hideLoading();

      if (res.result && res.result.code === 200) {
        wx.showToast({
          title: '发布成功',
          icon: 'success',
          duration: 2000
        });

        setTimeout(() => {
          wx.navigateBack();
        }, 2000);
      } else {
        wx.showToast({
          title: res.result?.message || '发布失败',
          icon: 'none'
        });
      }
    } catch (err) {
      wx.hideLoading();
      console.error('发布失败:', err);
      wx.showToast({
        title: '发布失败，请重试',
        icon: 'none'
      });
    }
  },

  // 返回
  onBackTap() {
    wx.navigateBack();
  }
});

