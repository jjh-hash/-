Page({
  data: {
    statusBarHeight: wx.getWindowInfo().statusBarHeight || 20,
    addressDetail: '',
    buildingName: '',
    houseNumber: '',
    name: '',
    phone: ''
  },

  onBack() {
    wx.navigateBack();
  },

  onSelectAddress() {
    wx.showToast({
      title: '地址选择功能待开发',
      icon: 'none'
    });
  },

  onBuildingInput(e) {
    this.setData({
      buildingName: e.detail.value
    });
  },

  onHouseInput(e) {
    this.setData({
      houseNumber: e.detail.value
    });
  },

  onNameInput(e) {
    this.setData({
      name: e.detail.value
    });
  },

  onPhoneInput(e) {
    this.setData({
      phone: e.detail.value
    });
  },

  onConfirm() {
    const { addressDetail, buildingName, houseNumber, name, phone } = this.data;
    
    if (!addressDetail) {
      wx.showToast({
        title: '请选择地址',
        icon: 'none'
      });
      return;
    }
    
    if (!name) {
      wx.showToast({
        title: '请输入姓名',
        icon: 'none'
      });
      return;
    }
    
    if (!phone) {
      wx.showToast({
        title: '请输入电话号码',
        icon: 'none'
      });
      return;
    }

    // 模拟保存地址
    wx.showToast({
      title: '地址保存成功',
      icon: 'success'
    });

    setTimeout(() => {
      wx.navigateBack();
    }, 1500);
  }
});
