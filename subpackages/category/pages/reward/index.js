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

const { normalizeMoneyInput } = require('../../../../utils/moneyInput');

Page({
  data: {
    campus: '白沙校区',
    statusBarHeight: wx.getWindowInfo().statusBarHeight || 20,
    helpLocation: '',
    helpContent: '',
    selectedCategory: '',
    uploadedImages: [], // 存储临时文件路径
    uploadedImageFileIDs: [], // 存储云存储fileID
    maxImages: 3,
    remarks: '',
    bounty: '', // 赏金，改为字符串以便输入框显示
    address: null, // 选中的地址信息
    totalPrice: '0.00', // 总价（格式化后的字符串）
    hasBounty: false, // 是否有赏金（用于显示总价）
    categories: [
      { id: 1, name: '找搭子', active: false },
      { id: 2, name: '搬东西', active: false },
      { id: 3, name: '借东西', active: false },
      { id: 4, name: '事件代办', active: false },
      { id: 5, name: '其他请说明', active: false },
      { id: 6, name: '代买商品', active: false }
    ],
    orderDuration: 30, // 订单在任务大厅存在时长（分钟），默认30分钟
    orderDurationUnit: 'minute', // 时长单位：'minute' 或 'hour'
    orderExpiredAtDisplay: '' // 订单截止时间显示文本（自动计算）
  },

  onLoad(options) {
    const campus = resolveCampusFromEntry(options || {});
    this.setData({ campus });
    try {
      wx.setStorageSync('homeCurrentCampus', campus);
    } catch (e) {}
    // 页面加载时加载用户联系信息
    this.loadContactInfo();
    // 初始化总价
    this.updateTotalPrice();
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
        console.log('【悬赏页面】设置联系信息:', contactInfo);
      } else {
        console.log('【悬赏页面】用户信息不存在');
      }
    } catch (error) {
      console.error('加载联系信息失败:', error);
    }
  },

  // 选择联系信息
  onSelectAddress() {
    wx.navigateTo({
      url: '/subpackages/common/pages/contact-info/index?from=reward'
    });
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
        
        // 上传到云存储
        this.uploadImagesToCloud(tempFilePaths);
      }
    });
  },

  // 上传图片到云存储
  async uploadImagesToCloud(tempFilePaths) {
    wx.showLoading({ title: '上传图片中...' });
    
    try {
      const uploadPromises = tempFilePaths.map(async (filePath) => {
        // 生成唯一的云存储路径
        const cloudPath = `reward/${Date.now()}-${Math.random().toString(36).substr(2, 9)}.jpg`;
        
        return wx.cloud.uploadFile({
          cloudPath: cloudPath,
          filePath: filePath
        });
      });

      const uploadResults = await Promise.all(uploadPromises);
      const fileIDs = uploadResults.map(res => res.fileID);
      
      // 更新云存储fileID列表
      this.setData({
        uploadedImageFileIDs: [...this.data.uploadedImageFileIDs, ...fileIDs]
      });
      
      wx.hideLoading();
      console.log('【悬赏页面】图片上传成功:', fileIDs);
    } catch (error) {
      wx.hideLoading();
      console.error('【悬赏页面】图片上传失败:', error);
      wx.showToast({
        title: '图片上传失败',
        icon: 'none'
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

  // 备注输入
  onRemarksInput(e) {
    this.setData({
      remarks: e.detail.value
    });
  },

  // 赏金输入（不用 type=digit，避免部分 Android 无小数点键盘；此处统一过滤）
  onBountyInput(e) {
    const bountyValue = normalizeMoneyInput(e.detail.value);
    this.setData({
      bounty: bountyValue
    });
    this.updateTotalPrice();
  },

  // 更新总价显示
  updateTotalPrice() {
    const bounty = parseFloat(this.data.bounty) || 0;
    const hasBounty = bounty > 0;
    
    this.setData({
      totalPrice: bounty.toFixed(2),
      bountyDisplay: bounty > 0 ? bounty.toFixed(2) : '0.00',
      hasBounty: hasBounty
    });
  },

  // 立即下单
  async onPlaceOrder() {
    // 验证必填项
    const missingFields = [];
    
    if (!this.data.helpLocation) {
      missingFields.push('帮助地点');
    }

    if (!this.data.helpContent.trim()) {
      missingFields.push('帮助内容');
    }

    if (!this.data.selectedCategory) {
      missingFields.push('帮助类别');
    }

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

    // 检查图片是否全部上传完成
    if (this.data.uploadedImages.length !== this.data.uploadedImageFileIDs.length) {
      wx.showToast({
        title: '图片正在上传中，请稍候...',
        icon: 'none',
        duration: 2000
      });
      return;
    }

    wx.showLoading({ title: '提交订单中...' });

    try {
      // 计算总价
      const totalPrice = parseFloat(this.data.bounty) || 0;
      
      // 准备订单数据
      const orderData = {
        orderType: 'reward', // 订单类型：悬赏
        campus: this.data.campus || '白沙校区',
        helpLocation: this.data.helpLocation,
        helpContent: this.data.helpContent.trim(),
        category: this.data.selectedCategory,
        images: this.data.uploadedImageFileIDs, // 使用云存储fileID
        remarks: this.data.remarks.trim(),
        bounty: totalPrice,
        address: this.data.address,
        totalPrice: totalPrice,
        orderDuration: this.data.orderDuration, // 订单在任务大厅存在时长（分钟）
        orderDurationUnit: this.data.orderDurationUnit // 时长单位
      };

      console.log('提交悬赏订单:', orderData);

      // 调用云函数创建订单
      const res = await wx.cloud.callFunction({
        name: 'orderManage',
        data: {
          action: 'createRewardOrder',
          data: orderData
        }
      });

      wx.hideLoading();

      if (res.result && res.result.code === 200) {
        wx.showToast({
          title: '发布成功，已为您打开任务大厅',
          icon: 'success',
          duration: 2000
        });

        // 跳转到任务大厅，用户可查看/接单或点「我发布的」查看自己的任务
        setTimeout(() => {
          wx.reLaunch({
            url: '/subpackages/order/pages/receive-order/index'
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

  // 去任务大厅
  onGoTaskHall() {
    wx.navigateTo({
      url: '/subpackages/order/pages/receive-order/index',
      fail: (err) => {
        console.error('跳转到任务大厅失败:', err);
        wx.showToast({ title: '跳转失败，请重试', icon: 'none' });
      }
    });
  },

  // 返回
  onBackTap() {
    wx.navigateBack();
  }
});
