Page({
  data: {
    statusBarHeight: wx.getWindowInfo().statusBarHeight || 20,
    name: '',
    phone: '',
    gender: 'male', // 默认值对应 genderIndex: 0（男）
    genderIndex: 0,
    genderOptions: ['男', '女'],
    vehicle: '',
    inviteCode: ''
  },

  onNameInput(e) {
    this.setData({ name: e.detail.value });
  },

  onPhoneInput(e) {
    this.setData({ phone: e.detail.value });
  },

  onGenderChange(e) {
    const index = Number(e.detail.value); // 确保转换为数字
    const gender = index === 0 ? 'male' : 'female';
    this.setData({
      genderIndex: index,
      gender: gender
    });
  },

  onVehicleInput(e) {
    this.setData({ vehicle: e.detail.value });
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

  async onSubmit() {
    const { name, phone, gender, vehicle, inviteCode } = this.data;

    if (!name.trim()) {
      wx.showToast({ title: '请输入姓名', icon: 'none' });
      return;
    }
    if (!/^1\d{10}$/.test(phone.trim())) {
      wx.showToast({ title: '请输入正确手机号', icon: 'none' });
      return;
    }
    if (!gender) {
      wx.showToast({ title: '请选择性别', icon: 'none' });
      return;
    }
    if (!vehicle.trim()) {
      wx.showToast({ title: '请输入配送工具', icon: 'none' });
      return;
    }

    wx.showLoading({ title: '提交中...' });

    try {
      // 调用云函数注册骑手
      const res = await wx.cloud.callFunction({
        name: 'riderRegister',
        data: {
          name: name.trim(),
          phone: phone.trim(),
          gender: gender,
          vehicle: vehicle.trim(),
          inviteCode: inviteCode || ''
        }
      });

      wx.hideLoading();

      if (res.result && res.result.code === 200) {
        wx.showToast({ title: '提交成功，待审核', icon: 'success' });
        wx.setStorageSync('isRider', true);
        wx.setStorageSync('riderInfo', {
          name,
          phone,
          gender,
          vehicle,
          status: 'pending'
        });
        setTimeout(() => {
          wx.reLaunch({
            url: '/subpackages/rider/pages/rider-home/index'
          });
        }, 1600);
      } else {
        wx.showToast({
          title: res.result.message || '提交失败',
          icon: 'none'
        });
      }
    } catch (error) {
      wx.hideLoading();
      console.error('注册骑手失败:', error);
      wx.showToast({
        title: '提交失败，请重试',
        icon: 'none'
      });
    }
  }
});


