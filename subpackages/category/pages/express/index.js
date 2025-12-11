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
    orderExpiredAt: '', // 订单截止时间（日期时间字符串）
    orderExpiredAtDisplay: '', // 订单截止时间显示文本
    dateTimeRange: [[], []], // 日期时间选择器范围
    dateTimeValue: [0, 0] // 日期时间选择器当前值
  },

  onLoad() {
    // 页面加载时加载用户联系信息
    this.loadContactInfo();
    // 初始化日期时间选择器
    this.initDateTimePicker();
  },

  // 初始化日期时间选择器
  initDateTimePicker() {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const date = now.getDate();
    const hour = now.getHours();
    const minute = now.getMinutes();
    
    // 生成日期范围（今天到30天后）
    const dates = [];
    for (let i = 0; i <= 30; i++) {
      const d = new Date(year, month, date + i);
      const monthStr = String(d.getMonth() + 1).padStart(2, '0');
      const dateStr = String(d.getDate()).padStart(2, '0');
      if (i === 0) {
        dates.push(`今天 ${monthStr}-${dateStr}`);
      } else if (i === 1) {
        dates.push(`明天 ${monthStr}-${dateStr}`);
      } else {
        dates.push(`${monthStr}-${dateStr}`);
      }
    }
    
    // 生成时间范围（00:00 - 23:59，每15分钟一个选项）
    const times = [];
    for (let h = 0; h < 24; h++) {
      for (let m = 0; m < 60; m += 15) {
        const hStr = String(h).padStart(2, '0');
        const mStr = String(m).padStart(2, '0');
        times.push(`${hStr}:${mStr}`);
      }
    }
    
    this.setData({
      dateTimeRange: [dates, times],
      dateTimeValue: [0, Math.floor((hour * 60 + minute) / 15)]
    });
  },

  // 选择订单截止时间
  onOrderExpiredAtChange(e) {
    const [dateIndex, timeIndex] = e.detail.value;
    const dates = this.data.dateTimeRange[0];
    const times = this.data.dateTimeRange[1];
    
    const dateStr = dates[dateIndex];
    const timeStr = times[timeIndex];
    
    // 解析日期
    const now = new Date();
    const dateMatch = dateStr.match(/(\d+)-(\d+)/);
    if (!dateMatch) return;
    
    const month = parseInt(dateMatch[1]) - 1;
    const date = parseInt(dateMatch[2]);
    const year = now.getFullYear();
    
    // 解析时间
    const [hours, minutes] = timeStr.split(':').map(Number);
    
    // 构建日期时间
    const expiredAt = new Date(year, month, date, hours, minutes);
    
    // 如果选择的是今天，且时间已过，则设置为明天
    if (dateIndex === 0 && expiredAt.getTime() <= now.getTime()) {
      expiredAt.setDate(expiredAt.getDate() + 1);
    }
    
    const expiredAtStr = expiredAt.toISOString().slice(0, 16).replace('T', ' ');
    
    this.setData({
      orderExpiredAt: expiredAtStr,
      orderExpiredAtDisplay: this.formatExpiredAtDisplay(expiredAt),
      dateTimeValue: [dateIndex, timeIndex]
    });
  },

  // 格式化截止时间显示
  formatExpiredAtDisplay(expiredAt) {
    if (!expiredAt) return '';
    
    const now = new Date();
    const diff = expiredAt.getTime() - now.getTime();
    
    if (diff < 0) {
      return '已过期';
    }
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const month = expiredAt.getMonth() + 1;
    const date = expiredAt.getDate();
    const hoursStr = String(expiredAt.getHours()).padStart(2, '0');
    const minutesStr = String(expiredAt.getMinutes()).padStart(2, '0');
    
    if (days === 0) {
      return `今天 ${hoursStr}:${minutesStr}截止`;
    } else if (days === 1) {
      return `明天 ${hoursStr}:${minutesStr}截止`;
    } else {
      return `${month}/${date} ${hoursStr}:${minutesStr}截止`;
    }
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

    if (!this.data.orderExpiredAt) {
      missingFields.push('订单截止时间');
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

    // 验证截止时间不能早于当前时间
    if (this.data.orderExpiredAt) {
      const expiredAt = new Date(this.data.orderExpiredAt.replace(' ', 'T'));
      const now = new Date();
      if (expiredAt.getTime() <= now.getTime()) {
        wx.showToast({
          title: '截止时间不能早于当前时间',
          icon: 'none',
          duration: 2000
        });
        return;
      }
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
        orderExpiredAt: this.data.orderExpiredAt || null // 订单截止时间
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
