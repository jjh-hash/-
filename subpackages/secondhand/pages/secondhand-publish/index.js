// pages/secondhand-publish/index.js
function resolveCampusFromEntry(options) {
  let campus = '';
  if (options && options.campus) {
    try {
      campus = decodeURIComponent(options.campus);
    } catch (e) {
      campus = options.campus;
    }
  }
  if (campus !== '金水校区' && campus !== '白沙校区') {
    campus = wx.getStorageSync('homeCurrentCampus');
  }
  if (campus !== '金水校区' && campus !== '白沙校区') {
    campus = '白沙校区';
  }
  return campus;
}

Page({
  data: {
    campus: '白沙校区',
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
    uploading: false,
    realNickName: '', // 用户真实昵称
    realAvatarUrl: '' // 用户真实头像
  },

  onLoad(options) {
    const campus = resolveCampusFromEntry(options || {});
    this.setData({ campus });
    // 获取用户信息
    this.getUserInfo();
  },

  // 获取用户信息
  async getUserInfo() {
    try {
      const userInfo = wx.getStorageSync('userInfo');
      console.log('【发布页面】获取到的用户信息:', userInfo);
      
      if (userInfo) {
        // 保存用户真实信息（注意字段名：nickname 和 avatar）
        const nickname = userInfo.nickname || userInfo.nickName || '';
        const avatar = userInfo.avatar || userInfo.avatarUrl || '/pages/小标/商家.png';
        
        console.log('【发布页面】用户昵称:', nickname);
        console.log('【发布页面】用户头像:', avatar);
        
        this.setData({
          realNickName: nickname,
          realAvatarUrl: avatar
        });
        
        // 如果有位置信息，设置位置
        if (userInfo.location) {
          this.setData({
            location: userInfo.location
          });
        }
      } else {
        console.warn('【发布页面】未找到用户信息');
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

      // 使用真实卖家信息发布（已移除匿名发布）
      // 注意：用户信息字段名是 nickname 和 avatar，不是 nickName 和 avatarUrl
      const realNickname = this.data.realNickName || userInfo.nickname || userInfo.nickName || '';
      const realAvatar = this.data.realAvatarUrl || userInfo.avatar || userInfo.avatarUrl || '/pages/小标/商家.png';

      const sellerName = realNickname || '微信用户';
      const sellerAvatar = realAvatar || '/pages/小标/商家.png';

      console.log('【发布页面】真实昵称:', realNickname);
      console.log('【发布页面】真实头像:', realAvatar);
      console.log('【发布页面】最终卖家名称:', sellerName);
      console.log('【发布页面】最终卖家头像:', sellerAvatar);

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
        sellerName: sellerName,
        sellerAvatar: sellerAvatar,
        campus: this.data.campus || '白沙校区'
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

        // 刷新列表页面
        this.refreshListPage();

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

  // 刷新列表页面
  refreshListPage() {
    try {
      // 方法1：通过页面栈直接刷新
      const pages = getCurrentPages();
      
      // 查找列表页面（可能是分包页面或主包页面）
      for (let i = pages.length - 2; i >= 0; i--) {
        const page = pages[i];
        const route = page.route;
        
        // 检查是否是闲置出售列表页面
        if (route === 'subpackages/secondhand/pages/secondhand/index' || 
            route === 'pages/secondhand/index') {
          // 重置页码并刷新列表
          if (page.setData) {
            page.setData({
              page: 1,
              products: []
            });
          }
          // 调用刷新方法
          if (typeof page.loadProducts === 'function') {
            page.loadProducts();
          }
          console.log('【发布页面】已刷新列表页面:', route);
          return;
        }
      }
      
      // 方法2：如果页面栈中没有列表页面，设置全局标记
      // 列表页面的 onShow 会检查这个标记并刷新
      const app = getApp();
      if (app.globalData) {
        app.globalData.needRefreshSecondhandList = true;
        console.log('【发布页面】已设置刷新标记，列表页面显示时会自动刷新');
      }
    } catch (err) {
      console.error('【发布页面】刷新列表页面失败:', err);
      // 出错时也设置全局标记作为备用方案
      try {
        const app = getApp();
        if (app.globalData) {
          app.globalData.needRefreshSecondhandList = true;
        }
      } catch (e) {
        console.error('【发布页面】设置刷新标记失败:', e);
      }
    }
  },

  // 返回
  onBackTap() {
    wx.navigateBack();
  }
});

