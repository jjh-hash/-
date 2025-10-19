Page({
  data:{
    statusBarHeight: wx.getWindowInfo().statusBarHeight || 20,
    form: {
      avatar: 'https://picsum.photos/seed/store/80/80',
      name: '可爱的麻辣土豆丝店',
      phone: '13078834530',
      address: '山东大学中心校园第二餐南',
      category: '杂货',
      startPrice: '17'
    },
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
  loadStoreInfo() {
    // TODO: 从云数据库加载店铺信息
    // 这里使用模拟数据
    console.log('加载店铺信息');
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

  onSave(){ 
    // 保存店铺信息到云数据库
    wx.showLoading({ title: '保存中...' });
    
    // TODO: 调用云函数保存店铺信息
    // wx.cloud.callFunction({
    //   name: 'merchant/updateStoreInfo',
    //   data: {
    //     storeId: 'your_store_id',
    //     storeInfo: {
    //       name: this.data.form.name,
    //       phone: this.data.form.phone,
    //       address: this.data.form.address,
    //       category: this.data.form.category,
    //       startPrice: parseFloat(this.data.form.startPrice),
    //       businessHours: this.data.businessHours
    //     }
    //   }
    // }).then(res => {
    //   wx.hideLoading();
    //   if (res.result.code === 0) {
    //     wx.showToast({ title: '保存成功', icon: 'success' });
    //   } else {
    //     wx.showToast({ title: res.result.message || '保存失败', icon: 'error' });
    //   }
    // }).catch(err => {
    //   wx.hideLoading();
    //   console.error('保存店铺信息失败:', err);
    //   wx.showToast({ title: '保存失败', icon: 'error' });
    // });
    
    // 模拟保存
    setTimeout(() => {
      wx.hideLoading();
      wx.showToast({ title: '保存成功', icon: 'success' });
    }, 1000);
  },
  
  onBack(){ wx.navigateBack(); }
});


