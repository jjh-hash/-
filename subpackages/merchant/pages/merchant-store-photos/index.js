Page({
  data: {
    statusBarHeight: wx.getWindowInfo().statusBarHeight || 20,
    activeCategory: 'all',
    activeCategoryText: '全部',
    showModal: false,
    showAddModal: false,
    previewPhoto: {},
    newPhoto: {
      name: '',
      category: 'environment',
      tempUrl: ''
    },
    categoryIndex: 0,
    categoryOptions: ['环境照片', '菜品照片', '证件照片'],
    photos: [],
    filteredPhotos: []
  },

  onLoad() {
    this.loadPhotos();
  },

  onShow() {
    this.loadPhotos();
  },

  // 加载照片数据
  loadPhotos() {
    wx.showLoading({ title: '加载中...' });
    
    // 获取当前登录的商家信息
    const merchantInfo = wx.getStorageSync('merchantInfo');
    const merchantId = merchantInfo?._id || null;
    const storeId = merchantInfo?.storeId || null;
    
    console.log('【店铺照片】加载照片，商家ID:', merchantId, '店铺ID:', storeId);
    
    wx.cloud.callFunction({
      name: 'storePhotoManage',
      data: {
        action: 'getPhotos',
        data: {
          category: this.data.activeCategory === 'all' ? null : this.data.activeCategory,
          merchantId: merchantId, // 传递商家ID，优先使用
          storeId: storeId // 传递店铺ID
        }
      }
    }).then(res => {
      wx.hideLoading();
      
      console.log('【店铺照片】加载结果:', res.result);
      
      if (res.result.code === 200) {
        this.setData({
          photos: res.result.data.photos
        });
        console.log('【店铺照片】加载成功，共', res.result.data.photos.length, '张照片');
        
        // 更新过滤后的照片列表
        this.updateFilteredPhotos();
      } else {
        console.error('【店铺照片】加载失败:', res.result.message);
        wx.showToast({
          title: res.result.message || '加载失败',
          icon: 'none'
        });
      }
    }).catch(err => {
      wx.hideLoading();
      console.error('【店铺照片】加载失败:', err);
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      });
    });
  },

  // 返回上一页
  goBack() {
    wx.navigateBack();
  },

  // 分类切换
  onCategoryChange(e) {
    const category = e.currentTarget.dataset.category;
    const categoryTexts = {
      'all': '全部',
      'environment': '环境照片',
      'food': '菜品照片',
      'license': '证件照片'
    };
    
    this.setData({
      activeCategory: category,
      activeCategoryText: categoryTexts[category]
    });
    
    // 更新过滤后的照片列表
    this.updateFilteredPhotos();
  },
  
  // 更新过滤后的照片列表
  updateFilteredPhotos() {
    const { photos, activeCategory } = this.data;
    let filteredPhotos = [];
    
    if (activeCategory === 'all') {
      filteredPhotos = photos;
    } else {
      filteredPhotos = photos.filter(photo => photo.category === activeCategory);
    }
    
    this.setData({
      filteredPhotos: filteredPhotos
    });
  },

  // 点击照片
  onPhotoTap(e) {
    const id = e.currentTarget.dataset.id;
    const photo = this.data.photos.find(item => item.id === id);
    
    if (photo) {
      this.setData({
        previewPhoto: photo,
        showModal: true
      });
    }
  },

  // 关闭预览模态框
  onCloseModal() {
    this.setData({
      showModal: false,
      previewPhoto: {}
    });
  },

  // 编辑照片
  onEditPhoto(e) {
    const id = e.currentTarget.dataset.id;
    const photo = this.data.photos.find(item => item.id === id);
    
    if (photo) {
      wx.showModal({
        title: '编辑照片',
        editable: true,
        placeholderText: '请输入照片名称',
        content: photo.name,
        success: (res) => {
          if (res.confirm && res.content.trim()) {
            this.updatePhotoName(id, res.content.trim());
          }
        }
      });
    }
  },

  // 删除照片
  onDeletePhoto(e) {
    const id = e.currentTarget.dataset.id;
    const photo = this.data.photos.find(item => item.id === id);
    
    if (photo) {
      wx.showModal({
        title: '确认删除',
        content: `确定要删除照片"${photo.name}"吗？`,
        confirmColor: '#ff4d4f',
        success: (res) => {
          if (res.confirm) {
            this.deletePhoto(id);
          }
        }
      });
    }
  },

  // 添加照片
  onAddPhoto() {
    // 根据当前选中的标签页自动设置照片分类
    let defaultCategory = 'environment';
    let defaultCategoryIndex = 0;
    
    // 如果当前不在"全部"标签页，则使用当前标签页对应的分类
    if (this.data.activeCategory !== 'all') {
      defaultCategory = this.data.activeCategory;
      // 根据分类设置对应的索引：environment=0, food=1, license=2
      const categoryMap = {
        'environment': 0,
        'food': 1,
        'license': 2
      };
      defaultCategoryIndex = categoryMap[defaultCategory] || 0;
    }
    
    this.setData({
      showAddModal: true,
      newPhoto: {
        name: '',
        category: defaultCategory,
        tempUrl: ''
      },
      categoryIndex: defaultCategoryIndex
    });
  },

  // 关闭添加模态框
  onCloseAddModal() {
    this.setData({
      showAddModal: false,
      newPhoto: {
        name: '',
        category: 'environment',
        tempUrl: ''
      }
    });
  },

  // 选择图片
  onChooseImage() {
    wx.chooseImage({
      count: 1,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const tempFilePath = res.tempFilePaths[0];
        this.setData({
          'newPhoto.tempUrl': tempFilePath
        });
      },
      fail: (err) => {
        console.error('选择图片失败:', err);
        wx.showToast({
          title: '选择图片失败',
          icon: 'error'
        });
      }
    });
  },

  // 照片名称输入
  onNameInput(e) {
    this.setData({
      'newPhoto.name': e.detail.value
    });
  },

  // 分类选择器变化
  onCategoryPickerChange(e) {
    const index = e.detail.value;
    const categories = ['environment', 'food', 'license'];
    
    this.setData({
      categoryIndex: index,
      'newPhoto.category': categories[index]
    });
  },

  // 确认添加
  onConfirmAdd() {
    const { name, category, tempUrl } = this.data.newPhoto;
    
    if (!name.trim()) {
      wx.showToast({
        title: '请输入照片名称',
        icon: 'none'
      });
      return;
    }
    
    if (!tempUrl) {
      wx.showToast({
        title: '请选择照片',
        icon: 'none'
      });
      return;
    }
    
    this.uploadPhoto(name.trim(), category, tempUrl);
  },

  // 上传照片
  uploadPhoto(name, category, tempFilePath) {
    wx.showLoading({ title: '上传中...' });
    
    // 1. 先上传文件到云存储
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substr(2, 9);
    const cloudPath = `store-photos/${timestamp}-${randomStr}.jpg`;
    
    console.log('【店铺照片】开始上传文件到云存储:', cloudPath);
    
    wx.cloud.uploadFile({
      cloudPath: cloudPath,
      filePath: tempFilePath
    }).then(uploadRes => {
      console.log('【店铺照片】文件上传成功:', uploadRes.fileID);
      
      // 2. 保存照片信息到数据库
      // 获取当前登录的商家信息
      const merchantInfo = wx.getStorageSync('merchantInfo');
      const merchantId = merchantInfo?._id || null;
      
      return wx.cloud.callFunction({
        name: 'storePhotoManage',
        data: {
          action: 'addPhoto',
          data: {
            name,
            category,
            fileID: uploadRes.fileID,
            merchantId: merchantId // 传递商家ID，优先使用
          }
        }
      });
    }).then(res => {
      wx.hideLoading();
      
      console.log('【店铺照片】保存结果:', res.result);
      
      if (res.result.code === 200) {
        wx.showToast({
          title: '上传成功',
          icon: 'success'
        });
        
        // 重新加载照片列表
        this.loadPhotos();
        
        // 关闭添加模态框
        this.onCloseAddModal();
      } else {
        console.error('【店铺照片】保存失败:', res.result.message);
        wx.showToast({
          title: res.result.message || '保存失败',
          icon: 'none'
        });
      }
    }).catch(err => {
      wx.hideLoading();
      console.error('【店铺照片】上传失败:', err);
      wx.showToast({
        title: '上传失败，请重试',
        icon: 'none'
      });
    });
  },

  // 保存照片到数据库（已废弃，合并到uploadPhoto中）
  savePhotoToDatabase(name, category, url) {
    // 此方法已不再使用，逻辑已合并到uploadPhoto中
  },


  // 更新照片名称
  updatePhotoName(id, name) {
    wx.showLoading({ title: '更新中...' });
    
    wx.cloud.callFunction({
      name: 'storePhotoManage',
      data: {
        action: 'updatePhoto',
        data: {
          photoId: id,
          name: name
        }
      }
    }).then(res => {
      wx.hideLoading();
      
      console.log('【店铺照片】更新结果:', res.result);
      
      if (res.result.code === 200) {
        // 重新加载照片列表
        this.loadPhotos();
        
        wx.showToast({
          title: '更新成功',
          icon: 'success'
        });
      } else {
        console.error('【店铺照片】更新失败:', res.result.message);
        wx.showToast({
          title: res.result.message || '更新失败',
          icon: 'none'
        });
      }
    }).catch(err => {
      wx.hideLoading();
      console.error('【店铺照片】更新失败:', err);
      wx.showToast({
        title: '更新失败',
        icon: 'none'
      });
    });
  },

  // 删除照片
  deletePhoto(id) {
    wx.showLoading({ title: '删除中...' });
    
    wx.cloud.callFunction({
      name: 'storePhotoManage',
      data: {
        action: 'deletePhoto',
        data: {
          photoId: id
        }
      }
    }).then(res => {
      wx.hideLoading();
      
      console.log('【店铺照片】删除结果:', res.result);
      
      if (res.result.code === 200) {
        // 重新加载照片列表
        this.loadPhotos();
        
        wx.showToast({
          title: '删除成功',
          icon: 'success'
        });
      } else {
        console.error('【店铺照片】删除失败:', res.result.message);
        wx.showToast({
          title: res.result.message || '删除失败',
          icon: 'none'
        });
      }
    }).catch(err => {
      wx.hideLoading();
      console.error('【店铺照片】删除失败:', err);
      wx.showToast({
        title: '删除失败',
        icon: 'none'
      });
    });
  },

  // 获取分类文本
  getCategoryText(category) {
    const texts = {
      'environment': '环境照片',
      'food': '菜品照片',
      'license': '证件照片'
    };
    return texts[category] || '未知分类';
  },

  // 格式化时间
  formatTime(date) {
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const hour = date.getHours();
    const minute = date.getMinutes();
    
    return `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')} ${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
  }
});
