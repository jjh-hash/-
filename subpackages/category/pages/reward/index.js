Page({
  data: {
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
    ]
  },

  onLoad() {
    // 页面加载时加载用户联系信息
    this.loadContactInfo();
    // 初始化总价
    this.updateTotalPrice();
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

  // 赏金输入
  onBountyInput(e) {
    const bountyValue = e.detail.value;
    const bounty = parseFloat(bountyValue) || 0;
    
    this.setData({
      bounty: bountyValue // 保存原始输入值
    });
    
    // 更新总价显示
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
        helpLocation: this.data.helpLocation,
        helpContent: this.data.helpContent.trim(),
        category: this.data.selectedCategory,
        images: this.data.uploadedImageFileIDs, // 使用云存储fileID
        remarks: this.data.remarks.trim(),
        bounty: totalPrice,
        address: this.data.address,
        totalPrice: totalPrice
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
