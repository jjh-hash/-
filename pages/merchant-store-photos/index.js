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
    photos: [
      {
        id: 1,
        name: '店铺门面',
        category: 'environment',
        categoryText: '环境照片',
        url: 'https://picsum.photos/400/400?random=1',
        createTime: '2024-01-15 10:30'
      },
      {
        id: 2,
        name: '招牌菜品',
        category: 'food',
        categoryText: '菜品照片',
        url: 'https://picsum.photos/400/400?random=2',
        createTime: '2024-01-15 11:20'
      },
      {
        id: 3,
        name: '营业执照',
        category: 'license',
        categoryText: '证件照片',
        url: 'https://picsum.photos/400/400?random=3',
        createTime: '2024-01-15 12:10'
      },
      {
        id: 4,
        name: '店内环境',
        category: 'environment',
        categoryText: '环境照片',
        url: 'https://picsum.photos/400/400?random=4',
        createTime: '2024-01-15 13:45'
      },
      {
        id: 5,
        name: '特色小吃',
        category: 'food',
        categoryText: '菜品照片',
        url: 'https://picsum.photos/400/400?random=5',
        createTime: '2024-01-15 14:30'
      }
    ]
  },

  computed: {
    filteredPhotos() {
      if (this.data.activeCategory === 'all') {
        return this.data.photos;
      }
      return this.data.photos.filter(photo => photo.category === this.data.activeCategory);
    }
  },

  onLoad() {
    this.loadPhotos();
  },

  onShow() {
    this.loadPhotos();
  },

  // 加载照片数据
  loadPhotos() {
    // TODO: 从云数据库加载照片数据
    // wx.cloud.callFunction({
    //   name: 'merchant/getStorePhotos',
    //   data: {
    //     storeId: 'your_store_id'
    //   }
    // }).then(res => {
    //   if (res.result.code === 0) {
    //     this.setData({
    //       photos: res.result.data
    //     });
    //   }
    // }).catch(err => {
    //   console.error('加载照片失败:', err);
    // });
    
    // 模拟加载数据
    console.log('加载店铺照片数据');
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
    this.setData({
      showAddModal: true,
      newPhoto: {
        name: '',
        category: 'environment',
        tempUrl: ''
      },
      categoryIndex: 0
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
    
    // TODO: 上传到云存储
    // wx.cloud.uploadFile({
    //   cloudPath: `store-photos/${Date.now()}-${Math.random().toString(36).substr(2, 9)}.jpg`,
    //   filePath: tempFilePath,
    //   success: (res) => {
    //     this.savePhotoToDatabase(name, category, res.fileID);
    //   },
    //   fail: (err) => {
    //     wx.hideLoading();
    //     console.error('上传失败:', err);
    //     wx.showToast({
    //       title: '上传失败',
    //       icon: 'error'
    //     });
    //   }
    // });
    
    // 模拟上传成功
    setTimeout(() => {
      wx.hideLoading();
      this.savePhotoToDatabase(name, category, tempFilePath);
    }, 1500);
  },

  // 保存照片到数据库
  savePhotoToDatabase(name, category, url) {
    // TODO: 保存到云数据库
    // wx.cloud.callFunction({
    //   name: 'merchant/addStorePhoto',
    //   data: {
    //     storeId: 'your_store_id',
    //     name: name,
    //     category: category,
    //     url: url
    //   }
    // }).then(res => {
    //   if (res.result.code === 0) {
    //     this.addPhotoToList(res.result.data);
    //     wx.showToast({
    //       title: '添加成功',
    //       icon: 'success'
    //     });
    //   }
    // }).catch(err => {
    //   console.error('保存照片失败:', err);
    //   wx.showToast({
    //     title: '保存失败',
    //     icon: 'error'
    //   });
    // });
    
    // 模拟保存成功
    const newPhoto = {
      id: Date.now(),
      name: name,
      category: category,
      categoryText: this.getCategoryText(category),
      url: url,
      createTime: this.formatTime(new Date())
    };
    
    this.addPhotoToList(newPhoto);
    wx.showToast({
      title: '添加成功',
      icon: 'success'
    });
  },

  // 添加照片到列表
  addPhotoToList(photo) {
    const photos = [photo, ...this.data.photos];
    this.setData({ photos });
    this.onCloseAddModal();
  },

  // 更新照片名称
  updatePhotoName(id, name) {
    // TODO: 调用云函数更新照片名称
    // wx.cloud.callFunction({
    //   name: 'merchant/updateStorePhoto',
    //   data: {
    //     photoId: id,
    //     name: name
    //   }
    // }).then(res => {
    //   if (res.result.code === 0) {
    //     const photos = this.data.photos.map(item => {
    //       if (item.id === id) {
    //         return { ...item, name: name };
    //       }
    //       return item;
    //     });
    //     this.setData({ photos });
    //     wx.showToast({
    //       title: '更新成功',
    //       icon: 'success'
    //     });
    //   }
    // });
    
    // 模拟更新成功
    const photos = this.data.photos.map(item => {
      if (item.id === id) {
        return { ...item, name: name };
      }
      return item;
    });
    this.setData({ photos });
    wx.showToast({
      title: '更新成功',
      icon: 'success'
    });
  },

  // 删除照片
  deletePhoto(id) {
    // TODO: 调用云函数删除照片
    // wx.cloud.callFunction({
    //   name: 'merchant/deleteStorePhoto',
    //   data: {
    //     photoId: id
    //   }
    // }).then(res => {
    //   if (res.result.code === 0) {
    //     const photos = this.data.photos.filter(item => item.id !== id);
    //     this.setData({ photos });
    //     wx.showToast({
    //       title: '删除成功',
    //       icon: 'success'
    //     });
    //   }
    // });
    
    // 模拟删除成功
    const photos = this.data.photos.filter(item => item.id !== id);
    this.setData({ photos });
    wx.showToast({
      title: '删除成功',
      icon: 'success'
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
