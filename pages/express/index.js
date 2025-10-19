Page({
  data: {
    statusBarHeight: wx.getWindowInfo().statusBarHeight || 20,
    pickupLocation: '',
    deliveryLocation: '',
    selectedItems: [],
    uploadedImages: [],
    maxImages: 3,
    pickupCode: '',
    packageSizes: [
      {
        id: 1,
        name: '小件',
        description: '巴掌大的快递',
        price: 2,
        icon: '📦',
        selected: false,
        quantity: 0
      },
      {
        id: 2,
        name: '中间',
        description: '鞋盒那么大',
        price: 4,
        icon: '📦',
        selected: false,
        quantity: 0
      },
      {
        id: 3,
        name: '大件',
        description: '皮箱那么大',
        price: 6,
        icon: '📦',
        selected: false,
        quantity: 0
      }
    ],
    totalPrice: 0
  },

  onLoad() {
    // 页面加载时的逻辑
  },

  // 选择取件位置
  onPickupLocationTap() {
    wx.showActionSheet({
      itemList: ['菜鸟驿站', '快递柜', '学校门口', '宿舍楼下', '其他位置'],
      success: (res) => {
        const locations = ['菜鸟驿站', '快递柜', '学校门口', '宿舍楼下', '其他位置'];
        this.setData({
          pickupLocation: locations[res.tapIndex]
        });
      }
    });
  },

  // 选择送达位置
  onDeliveryLocationTap() {
    wx.showActionSheet({
      itemList: ['宿舍楼', '教学楼', '图书馆', '食堂', '其他位置'],
      success: (res) => {
        const locations = ['宿舍楼', '教学楼', '图书馆', '食堂', '其他位置'];
        this.setData({
          deliveryLocation: locations[res.tapIndex]
        });
      }
    });
  },

  // 添加包裹
  onAddPackage(e) {
    const packageId = e.currentTarget.dataset.id;
    const packageSizes = [...this.data.packageSizes];
    const packageIndex = packageSizes.findIndex(pkg => pkg.id === packageId);
    
    if (packageIndex !== -1) {
      const packageInfo = packageSizes[packageIndex];
      
      if (!packageInfo.selected) {
        packageInfo.selected = true;
        packageInfo.quantity = 1;
      } else {
        packageInfo.quantity += 1;
      }
      
      this.calculateTotalPrice(packageSizes);
    }
  },

  // 减少包裹
  onRemovePackage(e) {
    const packageId = e.currentTarget.dataset.id;
    const packageSizes = [...this.data.packageSizes];
    const packageIndex = packageSizes.findIndex(pkg => pkg.id === packageId);
    
    if (packageIndex !== -1) {
      const packageInfo = packageSizes[packageIndex];
      
      if (packageInfo.quantity > 1) {
        packageInfo.quantity -= 1;
      } else {
        packageInfo.selected = false;
        packageInfo.quantity = 0;
      }
      
      this.calculateTotalPrice(packageSizes);
    }
  },

  // 计算总价
  calculateTotalPrice(packageSizes) {
    const totalPrice = packageSizes.reduce((total, item) => {
      if (item.selected) {
        return total + (item.price * item.quantity);
      }
      return total;
    }, 0);
    
    this.setData({
      packageSizes: packageSizes,
      totalPrice: totalPrice
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

  // 取件码输入
  onPickupCodeInput(e) {
    this.setData({
      pickupCode: e.detail.value
    });
  },

  // 立即下单
  onPlaceOrder() {
    // 验证必填项
    if (!this.data.pickupLocation) {
      wx.showToast({
        title: '请选择取件位置',
        icon: 'none'
      });
      return;
    }

    if (!this.data.deliveryLocation) {
      wx.showToast({
        title: '请选择送达位置',
        icon: 'none'
      });
      return;
    }

    const hasSelectedItems = this.data.packageSizes.some(item => item.selected);
    if (!hasSelectedItems) {
      wx.showToast({
        title: '请选择包裹类型',
        icon: 'none'
      });
      return;
    }

    if (!this.data.pickupCode.trim()) {
      wx.showToast({
        title: '请输入取件码',
        icon: 'none'
      });
      return;
    }

    // 提交订单
    const orderData = {
      pickupLocation: this.data.pickupLocation,
      deliveryLocation: this.data.deliveryLocation,
      selectedItems: this.data.selectedItems,
      uploadedImages: this.data.uploadedImages,
      pickupCode: this.data.pickupCode,
      totalPrice: this.data.totalPrice
    };

    console.log('提交代取快递订单:', orderData);
    
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
