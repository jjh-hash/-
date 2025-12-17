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
    totalPrice: 0,
    orderDuration: 30, // 订单在任务大厅存在时长（分钟），默认30分钟
    orderDurationUnit: 'minute', // 时长单位：'minute' 或 'hour'
    orderExpiredAtDisplay: '' // 订单截止时间显示文本（自动计算）
  },

  onLoad() {
    // 页面加载时加载用户联系信息
    this.loadContactInfo();
    // 计算并显示截止时间
    this.updateExpiredAtDisplay();
  },

  // 输入订单存在时长
  onOrderDurationInput(e) {
    const value = e.detail.value;
    // 只允许输入数字
    const numValue = parseInt(value) || 0;
    if (numValue < 1) {
      wx.showToast({
        title: '时长至少1分钟',
        icon: 'none',
        duration: 2000
      });
      return;
    }
    if (numValue > 10080) { // 最多7天（10080分钟）
      wx.showToast({
        title: '时长不能超过7天',
        icon: 'none',
        duration: 2000
      });
      return;
    }
    this.setData({
      orderDuration: numValue
    });
    // 更新截止时间显示
    this.updateExpiredAtDisplay();
  },

  // 选择时长单位
  onOrderDurationUnitChange(e) {
    const unit = e.detail.value === '0' ? 'minute' : 'hour';
    this.setData({
      orderDurationUnit: unit
    });
    // 更新截止时间显示
    this.updateExpiredAtDisplay();
  },

  // 更新截止时间显示
  updateExpiredAtDisplay() {
    const duration = this.data.orderDuration;
    const unit = this.data.orderDurationUnit;
    
    // 转换为分钟
    let totalMinutes = duration;
    if (unit === 'hour') {
      totalMinutes = duration * 60;
    }
    
    // 计算截止时间
    const now = new Date();
    const expiredAt = new Date(now.getTime() + totalMinutes * 60 * 1000);
    
    // 格式化显示
    const month = expiredAt.getMonth() + 1;
    const date = expiredAt.getDate();
    const hoursStr = String(expiredAt.getHours()).padStart(2, '0');
    const minutesStr = String(expiredAt.getMinutes()).padStart(2, '0');
    
    const days = Math.floor(totalMinutes / (24 * 60));
    const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
    const mins = totalMinutes % 60;
    
    let displayText = '';
    if (days > 0) {
      displayText = `${month}/${date} ${hoursStr}:${minutesStr}截止`;
    } else if (hours > 0) {
      displayText = `今天 ${hoursStr}:${minutesStr}截止（${hours}小时${mins > 0 ? mins + '分钟' : ''}后）`;
    } else {
      displayText = `今天 ${hoursStr}:${minutesStr}截止（${mins}分钟后）`;
    }
    
    this.setData({
      orderExpiredAtDisplay: displayText
    });
  },

  onShow() {
    // 从联系信息页面返回时，联系信息已在onSelectAddress中通过setData设置
    this.loadContactInfo();
  },

  // 加载用户联系信息
  async loadContactInfo() {
    try {
      // 从本地存储获取用户信息
      const userInfo = wx.getStorageSync('userInfo') || getApp().globalData.userInfo;
      if (userInfo) {
        // 构建联系信息对象（兼容地址格式，用于订单创建）
        const contactInfo = {
          name: userInfo.nickname || '微信用户',
          phone: userInfo.phone || '',
          wechat: userInfo.wechat || '',
          qq: userInfo.qq || '',
          avatar: userInfo.avatar || '',
          // 为了兼容订单创建，保留地址格式字段
          buildingName: '',
          houseNumber: '',
          addressDetail: '',
          address: ''
        };
        
        this.setData({
          address: contactInfo
        });
        console.log('【代拿快递页面】设置联系信息:', contactInfo);
      } else {
        console.log('【代拿快递页面】用户信息不存在');
      }
    } catch (error) {
      console.error('加载联系信息失败:', error);
    }
  },

  // 选择联系信息
  onSelectAddress() {
    wx.navigateTo({
      url: '/subpackages/common/pages/contact-info/index?from=express'
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
      missingFields.push('联系信息');
    }

    // 验证订单存在时长
    if (!this.data.orderDuration || this.data.orderDuration < 1) {
      missingFields.push('订单存在时长');
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
        totalPrice: this.data.totalPrice,
        orderDuration: this.data.orderDuration, // 订单在任务大厅存在时长（分钟）
        orderDurationUnit: this.data.orderDurationUnit // 时长单位
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
          duration: 1500
        });

        // 延迟跳转到首页，跳出当前页面
        setTimeout(() => {
          wx.reLaunch({
            url: '/pages/home/index'
          });
        }, 1500);
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
