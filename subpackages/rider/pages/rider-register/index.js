Page({
  data: {
    statusBarHeight: wx.getWindowInfo().statusBarHeight || 20,
    name: '',
    phone: '',
    idNumber: '',
    vehicle: '',
    serviceArea: '',
    inviteCode: ''
  },

  onNameInput(e) {
    this.setData({ name: e.detail.value });
  },

  onPhoneInput(e) {
    this.setData({ phone: e.detail.value });
  },

  onIdInput(e) {
    this.setData({ idNumber: e.detail.value });
  },

  onVehicleInput(e) {
    this.setData({ vehicle: e.detail.value });
  },

  onAreaInput(e) {
    this.setData({ serviceArea: e.detail.value });
  },

  onInviteInput(e) {
    this.setData({ inviteCode: e.detail.value });
  },

  onBackTap() {
    const pages = getCurrentPages();
    if (pages.length > 1) {
      wx.navigateBack();
    } else {
      wx.reLaunch({
        url: '/subpackages/rider/pages/rider/index'
      });
    }
  },

  onSubmit() {
    const { name, phone, idNumber, vehicle, serviceArea } = this.data;

    if (!name.trim()) {
      wx.showToast({ title: '请输入姓名', icon: 'none' });
      return;
    }
    if (!/^1\d{10}$/.test(phone.trim())) {
      wx.showToast({ title: '请输入正确手机号', icon: 'none' });
      return;
    }
    if (!idNumber.trim()) {
      wx.showToast({ title: '请输入身份证号', icon: 'none' });
      return;
    }
    if (!vehicle.trim()) {
      wx.showToast({ title: '请输入配送工具', icon: 'none' });
      return;
    }
    if (!serviceArea.trim()) {
      wx.showToast({ title: '请输入服务区域', icon: 'none' });
      return;
    }

    wx.showLoading({ title: '提交中...' });

    setTimeout(() => {
      wx.hideLoading();
      wx.showToast({ title: '提交成功，待审核', icon: 'success' });
      wx.setStorageSync('isRider', true);
      wx.setStorageSync('riderInfo', {
        name,
        phone,
        vehicle,
        serviceArea,
        status: 'pending'
      });
      setTimeout(() => {
        wx.reLaunch({
          url: '/subpackages/rider/pages/rider-home/index'
        });
      }, 1600);
    }, 1200);
  }
});


