Page({
  data: {
    statusBarHeight: wx.getWindowInfo().statusBarHeight || 20,
    helpLocation: '',
    helpContent: '',
    selectedCategory: '',
    uploadedImages: [],
    maxImages: 3,
    remarks: '',
    bounty: 3,
    categories: [
      { id: 1, name: '找搭子', active: false },
      { id: 2, name: '搬东西', active: false },
      { id: 3, name: '借东西', active: false },
      { id: 4, name: '事件代办', active: false },
      { id: 5, name: '其他请说明', active: false },
      { id: 6, name: '代买商品', active: false }
    ]
  },

  onLoad() {
    // 页面加载时的逻辑
  },

  // 选择帮助地点
  onLocationTap() {
    wx.showActionSheet({
      itemList: ['图书馆', '宿舍楼', '教学楼', '食堂', '体育馆', '其他地点'],
      success: (res) => {
        const locations = ['图书馆', '宿舍楼', '教学楼', '食堂', '体育馆', '其他地点'];
        this.setData({
          helpLocation: locations[res.tapIndex]
        });
      }
    });
  },

  // 帮助内容输入
  onContentInput(e) {
    this.setData({
      helpContent: e.detail.value
    });
  },

  // 选择帮助类别
  onCategoryTap(e) {
    const index = e.currentTarget.dataset.index;
    const categories = this.data.categories;
    
    // 重置所有类别状态
    categories.forEach(cat => cat.active = false);
    
    // 设置当前选中的类别
    categories[index].active = true;
    
    this.setData({
      categories: categories,
      selectedCategory: categories[index].name
    });
  },

  // 上传图片
  onUploadImage() {
    if (this.data.uploadedImages.length >= this.data.maxImages) {
      wx.showToast({
        title: `最多只能上传${this.data.maxImages}张图片`,
        icon: 'none'
      });
      return;
    }

    wx.chooseImage({
      count: this.data.maxImages - this.data.uploadedImages.length,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const tempFilePaths = res.tempFilePaths;
        const uploadedImages = [...this.data.uploadedImages, ...tempFilePaths];
        
        this.setData({
          uploadedImages: uploadedImages
        });
      }
    });
  },

  // 删除图片
  onDeleteImage(e) {
    const index = e.currentTarget.dataset.index;
    const uploadedImages = this.data.uploadedImages;
    uploadedImages.splice(index, 1);
    
    this.setData({
      uploadedImages: uploadedImages
    });
  },

  // 备注输入
  onRemarksInput(e) {
    this.setData({
      remarks: e.detail.value
    });
  },

  // 调整赏金
  onBountyChange(e) {
    const type = e.currentTarget.dataset.type;
    let bounty = this.data.bounty;
    
    if (type === 'increase') {
      bounty = Math.min(bounty + 1, 999);
    } else if (type === 'decrease') {
      bounty = Math.max(bounty - 1, 1);
    }
    
    this.setData({
      bounty: bounty
    });
  },

  // 立即下单
  onPlaceOrder() {
    // 验证必填项
    if (!this.data.helpLocation) {
      wx.showToast({
        title: '请选择帮助地点',
        icon: 'none'
      });
      return;
    }

    if (!this.data.helpContent.trim()) {
      wx.showToast({
        title: '请输入帮助内容',
        icon: 'none'
      });
      return;
    }

    if (!this.data.selectedCategory) {
      wx.showToast({
        title: '请选择帮助类别',
        icon: 'none'
      });
      return;
    }

    // 提交订单
    const orderData = {
      location: this.data.helpLocation,
      content: this.data.helpContent,
      category: this.data.selectedCategory,
      images: this.data.uploadedImages,
      remarks: this.data.remarks,
      bounty: this.data.bounty
    };

    console.log('提交订单:', orderData);
    
    wx.showToast({
      title: '订单提交成功',
      icon: 'success'
    });

    // 延迟返回上一页
    setTimeout(() => {
      wx.navigateBack();
    }, 1500);
  },

  // 返回
  onBackTap() {
    wx.navigateBack();
  }
});
