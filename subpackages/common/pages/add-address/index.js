Page({
  data: {
    statusBarHeight: wx.getWindowInfo().statusBarHeight || 20,
    addressDetail: '',
    buildingName: '',
    houseNumber: '',
    name: '',
    phone: '',
    mode: 'add',
    addressId: ''
  },

  onLoad(options) {
    if (!getApp().globalData.isLoggedIn) {
      wx.showToast({ title: '请先登录后添加地址', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 1500);
      return;
    }
    const mode = options?.mode === 'edit' ? 'edit' : 'add';
    const addressId = options?.addressId || '';
    this.setData({ mode, addressId });
    if (mode === 'edit' && addressId) {
      this.loadAddressForEdit(addressId);
    }
  },

  async loadAddressForEdit(addressId) {
    try {
      wx.showLoading({ title: '加载中...' });
      const res = await wx.cloud.callFunction({
        name: 'addressManage',
        data: {
          action: 'getAddressList',
          data: {}
        }
      });
      wx.hideLoading();
      const list = (res.result && res.result.code === 200 && res.result.data && res.result.data.list) ? res.result.data.list : [];
      const current = list.find(item => item._id === addressId);
      if (!current) {
        wx.showToast({ title: '地址不存在', icon: 'none' });
        setTimeout(() => wx.navigateBack(), 1200);
        return;
      }
      this.setData({
        addressDetail: current.addressDetail || '',
        buildingName: current.buildingName || '',
        houseNumber: current.houseNumber || '',
        name: current.name || '',
        phone: current.phone || ''
      });
    } catch (error) {
      wx.hideLoading();
      wx.showToast({ title: '地址加载失败', icon: 'none' });
    }
  },

  onLoad() {
    if (!getApp().globalData.isLoggedIn) {
      wx.showToast({ title: '请先登录后添加地址', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 1500);
    }
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

  onAddressDetailInput(e) {
    this.setData({
      addressDetail: e.detail.value
    });
  },

  async onConfirm() {
    const { addressDetail, buildingName, houseNumber, name, phone } = this.data;
    
    console.log('【新增地址】准备保存地址:', this.data);
    
    // 参数验证
    if (!addressDetail || addressDetail.trim() === '') {
      wx.showToast({
        title: '请选择地址',
        icon: 'none'
      });
      return;
    }
    
    if (!name || name.trim() === '') {
      wx.showToast({
        title: '请输入姓名',
        icon: 'none'
      });
      return;
    }
    
    if (!phone || phone.trim() === '') {
      wx.showToast({
        title: '请输入电话号码',
        icon: 'none'
      });
      return;
    }
    
    // 验证手机号格式
    const phoneRegex = /^1[3-9]\d{9}$/;
    if (!phoneRegex.test(phone.trim())) {
      wx.showToast({
        title: '请输入正确的手机号',
        icon: 'none'
      });
      return;
    }

    try {
      wx.showLoading({ title: '保存中...' });

      const isEdit = this.data.mode === 'edit' && !!this.data.addressId;
      // 调用云函数保存/更新地址
      const res = await wx.cloud.callFunction({
        name: 'addressManage',
        data: {
          action: isEdit ? 'updateAddress' : 'addAddress',
          data: {
            ...(isEdit ? { addressId: this.data.addressId } : {}),
            addressDetail: addressDetail.trim(),
            buildingName: buildingName.trim(),
            houseNumber: houseNumber.trim(),
            name: name.trim(),
            phone: phone.trim(),
            isDefault: false
          }
        }
      });

      wx.hideLoading();

      console.log('【新增地址】云函数返回结果:', res.result);

      if (res.result && res.result.code === 200) {
        wx.showToast({
          title: isEdit ? '地址修改成功' : '地址保存成功',
          icon: 'success',
          duration: 1500
        });

        setTimeout(() => {
          wx.navigateBack();
        }, 1500);
      } else {
        wx.showToast({
          title: res.result?.message || '保存失败',
          icon: 'none',
          duration: 2000
        });
      }

    } catch (error) {
      wx.hideLoading();
      console.error('【新增地址】保存异常:', error);
      wx.showToast({
        title: '保存失败，请重试',
        icon: 'none',
        duration: 2000
      });
    }
  }
});
