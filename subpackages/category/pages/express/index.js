Page({
  data: {
    statusBarHeight: wx.getWindowInfo().statusBarHeight || 20,
    pickupLocation: '',
    deliveryLocation: '',
    selectedItems: [],
    uploadedImages: [], // 存储临时文件路径
    uploadedImageFileIDs: [], // 存储云存储fileID
    maxImages: 3,
    pickupCode: '',
    address: null, // 选中的地址信息
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
    // 页面加载时加载用户默认地址
    this.loadUserAddress();
  },

  onShow() {
    // 从地址选择页面返回时，地址已在onSelectAddress中通过setData设置
    // 这里不需要额外处理
  },

  // 加载用户默认地址
  async loadUserAddress() {
    try {
      const res = await wx.cloud.callFunction({
        name: 'addressManage',
        data: {
          action: 'getAddressList',
          data: {}
        }
      });

      console.log('【express页面】加载地址结果:', res.result);

      if (res.result && res.result.code === 200 && res.result.data.list.length > 0) {
        // 获取默认地址或第一个地址
        const defaultAddress = res.result.data.list.find(addr => addr.isDefault) || res.result.data.list[0];
        console.log('【express页面】设置默认地址:', defaultAddress);
        this.setData({
          address: defaultAddress
        });
      } else {
        console.log('【express页面】用户没有地址');
      }
    } catch (error) {
      console.error('加载地址失败:', error);
    }
  },

  // 选择地址
  onSelectAddress() {
    wx.navigateTo({
      url: '/pages/address/index?from=express'
    });
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
        // 先显示临时图片
        const uploadedImages = [...this.data.uploadedImages, ...tempFilePaths];
        this.setData({
          uploadedImages: uploadedImages
        });
        
        // 上传图片到云存储
        this.uploadImagesToCloud(tempFilePaths);
      }
    });
  },

  // 上传图片到云存储
  async uploadImagesToCloud(tempFilePaths) {
    wx.showLoading({ title: '上传中...' });
    
    const uploadPromises = tempFilePaths.map((filePath, index) => {
      return new Promise((resolve, reject) => {
        const timestamp = Date.now();
        const randomStr = Math.random().toString(36).substring(2, 8);
        const cloudPath = `express-orders/${timestamp}_${randomStr}_${index}.jpg`;
        
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

    try {
      const fileIDs = await Promise.all(uploadPromises);
      const uploadedImageFileIDs = [...this.data.uploadedImageFileIDs, ...fileIDs];
      
      this.setData({
        uploadedImageFileIDs: uploadedImageFileIDs
      });
      
      wx.hideLoading();
      wx.showToast({
        title: '上传成功',
        icon: 'success',
        duration: 1500
      });
    } catch (error) {
      wx.hideLoading();
      console.error('批量上传失败:', error);
      wx.showToast({
        title: '上传失败，请重试',
        icon: 'none'
      });
      // 移除已添加的临时图片
      const uploadedImages = this.data.uploadedImages.slice(0, -tempFilePaths.length);
      this.setData({
        uploadedImages: uploadedImages
      });
    }
  },

  // 删除图片
  onDeleteImage(e) {
    const index = e.currentTarget.dataset.index;
    const uploadedImages = [...this.data.uploadedImages];
    const uploadedImageFileIDs = [...this.data.uploadedImageFileIDs];
    
    uploadedImages.splice(index, 1);
    uploadedImageFileIDs.splice(index, 1);
    
    this.setData({
      uploadedImages: uploadedImages,
      uploadedImageFileIDs: uploadedImageFileIDs
    });
  },

  // 取件码输入
  onPickupCodeInput(e) {
    this.setData({
      pickupCode: e.detail.value
    });
  },

  // 立即下单
  async onPlaceOrder() {
    // 验证必填项 - 按顺序检查，给出明确的提示
    const missingFields = [];
    
    if (!this.data.pickupLocation) {
      missingFields.push('取件位置');
    }

    if (!this.data.deliveryLocation) {
      missingFields.push('送达位置');
    }

    const hasSelectedItems = this.data.packageSizes.some(item => item.selected);
    if (!hasSelectedItems) {
      missingFields.push('包裹类型');
    }

    if (!this.data.pickupCode || !this.data.pickupCode.trim()) {
      missingFields.push('取件码');
    }

    // 验证地址
    if (!this.data.address) {
      missingFields.push('收货地址');
    }

    // 如果有缺失项，统一提示
    if (missingFields.length > 0) {
      wx.showToast({
        title: `请完善：${missingFields.join('、')}`,
        icon: 'none',
        duration: 3000
      });
      return;
    }

    // 确保图片已上传完成
    if (this.data.uploadedImages.length !== this.data.uploadedImageFileIDs.length) {
      wx.showToast({
        title: '图片上传中，请稍候',
        icon: 'none'
      });
      return;
    }

    wx.showLoading({ title: '提交订单中...' });

    try {
      // 准备订单数据
      const selectedPackages = this.data.packageSizes.filter(item => item.selected);
      
      const orderData = {
        orderType: 'express', // 订单类型：代拿快递
        pickupLocation: this.data.pickupLocation,
        deliveryLocation: this.data.deliveryLocation,
        packageSizes: selectedPackages.map(pkg => ({
          id: pkg.id,
          name: pkg.name,
          description: pkg.description,
          price: pkg.price,
          quantity: pkg.quantity
        })),
        images: this.data.uploadedImageFileIDs, // 使用云存储fileID
        pickupCode: this.data.pickupCode.trim(),
        address: this.data.address,
        totalPrice: this.data.totalPrice
      };

      console.log('提交代拿快递订单:', orderData);

      // 调用云函数创建订单
      const res = await wx.cloud.callFunction({
        name: 'orderManage',
        data: {
          action: 'createExpressOrder',
          data: orderData
        }
      });

      wx.hideLoading();

      if (res.result && res.result.code === 200) {
        wx.showToast({
          title: '订单提交成功',
          icon: 'success',
          duration: 2000
        });

        // 延迟跳转到订单页面
        setTimeout(() => {
          wx.redirectTo({
            url: '/pages/order/index'
          });
        }, 2000);
      } else {
        wx.showToast({
          title: res.result?.message || '订单提交失败',
          icon: 'none',
          duration: 2000
        });
      }
    } catch (error) {
      wx.hideLoading();
      console.error('提交订单异常:', error);
      wx.showToast({
        title: '订单提交失败，请重试',
        icon: 'none',
        duration: 2000
      });
    }
  },

  // 返回
  onBackTap() {
    wx.navigateBack();
  }
});
