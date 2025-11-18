Page({
  data:{
    statusBarHeight: wx.getWindowInfo().statusBarHeight || 20,
    form: {
      avatar: 'https://picsum.photos/seed/store/80/80',
      name: '可爱的麻辣土豆丝店',
      phone: '13078834530',
      address: '山东大学中心校园第二餐南',
      storeCategory: '其他', // 店铺分类
      category: '杂货', // 经营分类
      startPrice: '17'
    },
    storeCategoryOptions: ['学校食堂', '生鲜水果', '校园超市', '奶茶果汁', '其他'],
    // 营业时间相关
    businessHours: {
      startTime: '07:00',
      endTime: '08:00'
    },
    tempBusinessHours: {
      startTime: '07:00',
      endTime: '08:00'
    },
    showTimePicker: false,
    selectedTimeType: 'start', // 'start' 或 'end'
    selectedHour: '07',
    selectedMinute: '00',
    hourOptions: [],
    minuteOptions: []
  },
  onLoad() {
    this.initTimeOptions();
    this.loadStoreInfo();
  },

  onInput(e){
    const key = e.currentTarget.dataset.key;
    const v = e.detail.value;
    this.setData({ [`form.${key}`]: v });
  },

  // 选择店铺分类
  onStoreCategoryChange(e) {
    const index = e.detail.value;
    const selectedCategory = this.data.storeCategoryOptions[index];
    this.setData({
      'form.storeCategory': selectedCategory
    });
  },

  // 选择头像
  async onSelectAvatar() {
    wx.showActionSheet({
      itemList: ['选择相册图片', '拍照'],
      success: async (res) => {
        let sourceType = [];
        if (res.tapIndex === 0) {
          sourceType = ['album'];
        } else if (res.tapIndex === 1) {
          sourceType = ['camera'];
        }
        
        try {
          // 选择图片
          const chooseRes = await wx.chooseImage({
            count: 1,
            sizeType: ['compressed'],
            sourceType: sourceType
          });
          
          const tempFilePath = chooseRes.tempFilePaths[0];
          
          // 上传到云存储
          wx.showLoading({ title: '上传中...' });
          
          const uploadRes = await wx.cloud.uploadFile({
            cloudPath: `merchant-avatars/${Date.now()}.jpg`,
            filePath: tempFilePath
          });
          
          wx.hideLoading();
          
          // 更新头像显示
          console.log('头像上传成功，FileID:', uploadRes.fileID);
          this.setData({
            'form.avatar': uploadRes.fileID
          });
          
          console.log('更新后的头像URL:', this.data.form.avatar);
          
          wx.showToast({
            title: '头像上传成功',
            icon: 'success'
          });
          
        } catch (err) {
          wx.hideLoading();
          console.error('选择/上传头像失败:', err);
          wx.showToast({
            title: '操作失败',
            icon: 'none'
          });
        }
      }
    });
  },

  // 初始化时间选项
  initTimeOptions() {
    const hours = [];
    const minutes = [];
    
    // 生成小时选项 (00-23)
    for (let i = 0; i < 24; i++) {
      hours.push(i.toString().padStart(2, '0'));
    }
    
    // 生成分钟选项 (00-59)
    for (let i = 0; i < 60; i++) {
      minutes.push(i.toString().padStart(2, '0'));
    }
    
    this.setData({
      hourOptions: hours,
      minuteOptions: minutes
    });
  },

  // 加载店铺信息
  async loadStoreInfo() {
    wx.showLoading({ title: '加载中...' });
    
    try {
      // 获取当前登录的商家信息
      const merchantInfo = wx.getStorageSync('merchantInfo');
      const merchantId = merchantInfo?._id || null;
      
      console.log('【店铺信息】加载店铺信息，商家ID:', merchantId);
      
      const res = await wx.cloud.callFunction({
        name: 'storeManage',
        data: {
          action: 'getStoreInfo',
          data: {
            merchantId: merchantId // 传递商家ID，优先使用
          }
        }
      });
      
      wx.hideLoading();
      
      console.log('【店铺信息】加载结果:', res.result);
      
      if (res.result && res.result.code === 200) {
        const storeInfo = res.result.data.storeInfo;
        
        // 设置头像，优先使用avatar字段，然后是logoUrl，最后是商家头像
        let avatar = '';
        if (storeInfo.avatar && storeInfo.avatar.trim() !== '' && storeInfo.avatar !== 'undefined' && storeInfo.avatar !== 'null') {
          avatar = storeInfo.avatar;
        } else if (storeInfo.logoUrl && storeInfo.logoUrl.trim() !== '' && storeInfo.logoUrl !== 'undefined' && storeInfo.logoUrl !== 'null') {
          avatar = storeInfo.logoUrl;
        } else {
          // 使用默认头像
          avatar = 'https://picsum.photos/seed/store/80/80';
        }
        
        console.log('【店铺信息】加载的头像:', avatar);
        
        this.setData({
          'form.name': storeInfo.name || storeInfo.merchantName || '未设置店铺名称',
          'form.phone': storeInfo.contactPhone || '未设置联系方式',
          'form.address': storeInfo.deliveryArea || '未设置店铺地址',
          'form.storeCategory': storeInfo.storeCategory || '其他',
          'form.category': storeInfo.category || '未设置经营分类',
          'form.startPrice': storeInfo.minOrderAmount || '17',
          'form.avatar': avatar,
          businessHours: storeInfo.businessHours || {
            startTime: '09:00',
            endTime: '22:00'
          }
        });
      } else {
        // 使用本地存储的备用数据
        const merchantInfo = wx.getStorageSync('merchantInfo');
        if (merchantInfo) {
          let avatar = 'https://picsum.photos/seed/store/80/80';
          if (merchantInfo.avatar && merchantInfo.avatar.trim() !== '') {
            avatar = merchantInfo.avatar;
          }
          
          this.setData({
            'form.name': merchantInfo.merchantName || '未设置店铺名称',
            'form.phone': merchantInfo.contactPhone || '未设置联系方式',
            'form.avatar': avatar
          });
        }
      }
    } catch (err) {
      wx.hideLoading();
      console.error('【店铺信息】加载失败:', err);
      
      // 使用本地存储的备用数据
      const merchantInfo = wx.getStorageSync('merchantInfo');
      if (merchantInfo) {
        let avatar = 'https://picsum.photos/seed/store/80/80';
        if (merchantInfo.avatar && merchantInfo.avatar.trim() !== '') {
          avatar = merchantInfo.avatar;
        }
        
        this.setData({
          'form.name': merchantInfo.merchantName || '未设置店铺名称',
          'form.phone': merchantInfo.contactPhone || '未设置联系方式',
          'form.avatar': avatar
        });
      }
    }
  },

  // 显示时间选择器
  showTimePicker() {
    this.setData({
      showTimePicker: true,
      tempBusinessHours: { ...this.data.businessHours },
      selectedTimeType: 'start'
    });
    this.updateSelectedTime();
  },

  // 隐藏时间选择器
  hideTimePicker() {
    this.setData({
      showTimePicker: false
    });
  },

  // 阻止事件冒泡
  stopPropagation() {
    // 阻止点击弹窗内容时关闭弹窗
  },

  // 选择时间类型（开始时间或结束时间）
  selectTimeType(e) {
    const type = e.currentTarget.dataset.type;
    this.setData({
      selectedTimeType: type
    });
    this.updateSelectedTime();
  },

  // 更新选中的时间
  updateSelectedTime() {
    const { selectedTimeType, tempBusinessHours } = this.data;
    const timeStr = selectedTimeType === 'start' ? tempBusinessHours.startTime : tempBusinessHours.endTime;
    const [hour, minute] = timeStr.split(':');
    
    this.setData({
      selectedHour: hour,
      selectedMinute: minute
    });
  },

  // 确认时间选择
  confirmTimeSelection() {
    const { tempBusinessHours } = this.data;
    this.setData({
      businessHours: { ...tempBusinessHours },
      showTimePicker: false
    });
    
    wx.showToast({
      title: '营业时间已更新',
      icon: 'success'
    });
  },

  // 时间选择器滚动事件
  onTimePickerScroll(e) {
    // 这里可以添加滚动选择时间的逻辑
    // 由于微信小程序的限制，这里使用点击选择的方式
  },

  // 选择小时
  selectHour(e) {
    const hour = e.currentTarget.dataset.hour;
    this.setData({
      selectedHour: hour
    });
    this.updateTempTime();
  },

  // 选择分钟
  selectMinute(e) {
    const minute = e.currentTarget.dataset.minute;
    this.setData({
      selectedMinute: minute
    });
    this.updateTempTime();
  },

  // 更新临时时间
  updateTempTime() {
    const { selectedTimeType, selectedHour, selectedMinute } = this.data;
    const timeStr = `${selectedHour}:${selectedMinute}`;
    
    this.setData({
      [`tempBusinessHours.${selectedTimeType}Time`]: timeStr
    });
  },

  async onSave(){ 
    // 保存店铺信息到云数据库
    wx.showLoading({ title: '保存中...' });
    
    try {
      // 先获取平台设置的最低订单金额下限
      let minLimit = 20; // 默认下限20元
      try {
        const configRes = await wx.cloud.callFunction({
          name: 'platformConfig',
          data: {
            action: 'getConfig',
            data: {}
          }
        });
        
        if (configRes.result && configRes.result.code === 200) {
          minLimit = (configRes.result.data.minOrderAmountLimit || 2000) / 100; // 转换为元
        }
      } catch (err) {
        console.warn('获取平台配置失败，使用默认值:', err);
      }
      
      // 验证起步价不能低于平台下限
      const startPrice = parseFloat(this.data.form.startPrice) || 0;
      if (startPrice < minLimit) {
        wx.hideLoading();
        wx.showModal({
          title: '保存失败',
          content: `起步价不能低于平台设置的最低订单金额下限¥${minLimit.toFixed(2)}，请重新设置`,
          showCancel: false
        });
        return;
      }
      
      const saveData = {
        merchantName: this.data.form.name,
        contactPhone: this.data.form.phone,
        name: this.data.form.name,
        address: this.data.form.address,
        storeCategory: this.data.form.storeCategory || '其他', // 店铺分类：学校食堂、生鲜水果、校园超市、奶茶果汁、其他
        category: this.data.form.category,
        // 起步价保存为minOrderAmount，与起送金额保持一致
        minOrderAmount: startPrice
      };
      
      // 只有当头像不是默认图片且不为空时才传递
      if (this.data.form.avatar && 
          !this.data.form.avatar.includes('picsum.photos') && 
          this.data.form.avatar.trim() !== '') {
        saveData.avatar = this.data.form.avatar;
      }
      
      // 获取当前登录的商家信息
      const merchantInfo = wx.getStorageSync('merchantInfo');
      const merchantId = merchantInfo?._id || null;
      
      // 添加merchantId到保存数据中
      if (merchantId) {
        saveData.merchantId = merchantId;
      }
      
      console.log('【店铺信息】准备保存的数据:', saveData);
      console.log('【店铺信息】保存的头像:', saveData.avatar);
      
      // 调用云函数更新店铺信息
      const res = await wx.cloud.callFunction({
        name: 'storeManage',
        data: {
          action: 'updateStoreInfo',
          data: saveData
        }
      });
      
      console.log('【店铺信息】更新结果:', res.result);
      
      // 更新营业时间
      if (this.data.businessHours) {
        // 获取当前登录的商家信息
        const merchantInfo = wx.getStorageSync('merchantInfo');
        const merchantId = merchantInfo?._id || null;
        
        await wx.cloud.callFunction({
          name: 'storeManage',
          data: {
            action: 'updateBusinessHours',
            data: {
              startTime: this.data.businessHours.startTime,
              endTime: this.data.businessHours.endTime,
              merchantId: merchantId // 传递商家ID，优先使用
            }
          }
        });
      }
      
      // 保存成功后，更新本地存储的商家信息（包含头像）
      if (res.result && res.result.code === 200 && saveData.avatar) {
        const updatedMerchantInfo = wx.getStorageSync('merchantInfo');
        if (updatedMerchantInfo) {
          updatedMerchantInfo.avatar = saveData.avatar;
          wx.setStorageSync('merchantInfo', updatedMerchantInfo);
          console.log('【店铺信息】已更新本地存储的商家头像');
        }
      }
      
      wx.hideLoading();
      
      if (res.result && res.result.code === 200) {
        wx.showToast({ 
          title: '保存成功', 
          icon: 'success',
          duration: 1500
        });
        
        // 延迟返回上一页
        setTimeout(() => {
          wx.navigateBack();
        }, 1500);
      } else {
        wx.showToast({ 
          title: res.result.message || '保存失败', 
          icon: 'none' 
        });
      }
    } catch (err) {
      wx.hideLoading();
      console.error('【店铺信息】保存失败:', err);
      wx.showToast({ 
        title: '保存失败，请重试', 
        icon: 'none' 
      });
    }
  },
  
  onBack(){ wx.navigateBack(); }
});


