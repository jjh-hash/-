Page({
  data: {
    statusBarHeight: wx.getWindowInfo().statusBarHeight || 20,
    formData: {
      name: '',
      category: '',
      prepTime: '',
      price: '',
      boxFee: '',
      spec: '',
      attr: '',
      image: ''
    },
    categories: ['招牌菜', '热门美食', '把把串串', '招牌烤肠', '主食小吃'],
    specs: ['小份', '中份', '大份', '特大份'],
    attrs: ['不辣', '微辣', '中辣', '重辣', '特辣']
  },

  onBack() {
    wx.navigateBack();
  },

  onInput(e) {
    const field = e.currentTarget.dataset.field;
    const value = e.detail.value;
    this.setData({
      [`formData.${field}`]: value
    });
  },

  onSelectCategory() {
    wx.showActionSheet({
      itemList: this.data.categories,
      success: (res) => {
        this.setData({
          'formData.category': this.data.categories[res.tapIndex]
        });
      }
    });
  },

  onSelectSpec() {
    wx.showActionSheet({
      itemList: this.data.specs,
      success: (res) => {
        this.setData({
          'formData.spec': this.data.specs[res.tapIndex]
        });
      }
    });
  },

  onSelectAttr() {
    wx.showActionSheet({
      itemList: this.data.attrs,
      success: (res) => {
        this.setData({
          'formData.attr': this.data.attrs[res.tapIndex]
        });
      }
    });
  },

  onUploadImage() {
    wx.chooseImage({
      count: 1,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const tempFilePath = res.tempFilePaths[0];
        this.setData({
          'formData.image': tempFilePath
        });
      }
    });
  },

  onSave() {
    const { formData } = this.data;
    
    // 简单验证
    if (!formData.name) {
      wx.showToast({ title: '请输入商品名称', icon: 'none' });
      return;
    }
    if (!formData.category) {
      wx.showToast({ title: '请选择商品分类', icon: 'none' });
      return;
    }
    if (!formData.price) {
      wx.showToast({ title: '请输入价格', icon: 'none' });
      return;
    }

    wx.showLoading({ title: '保存中...' });
    
    // 模拟保存
    setTimeout(() => {
      wx.hideLoading();
      wx.showToast({ title: '保存成功', icon: 'success' });
      
      setTimeout(() => {
        wx.navigateBack();
      }, 1500);
    }, 1000);
  }
});
