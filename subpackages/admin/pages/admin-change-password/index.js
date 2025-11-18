// pages/admin-change-password/index.js
const AdminAuth = require('../../utils/adminAuth.js');

Page({
  data: {
    statusBarHeight: wx.getWindowInfo().statusBarHeight || 20,
    oldPassword: '',
    newPassword: '',
    confirmPassword: '',
    showOldPassword: false,
    showNewPassword: false,
    showConfirmPassword: false,
    loading: false
  },

  onLoad() {
    // 验证管理员权限
    AdminAuth.checkAdminAuth().catch(() => {
      // 权限验证失败，会自动跳转
    });
  },

  // 输入旧密码
  onOldPasswordInput(e) {
    this.setData({
      oldPassword: e.detail.value
    });
  },

  // 输入新密码
  onNewPasswordInput(e) {
    this.setData({
      newPassword: e.detail.value
    });
  },

  // 输入确认密码
  onConfirmPasswordInput(e) {
    this.setData({
      confirmPassword: e.detail.value
    });
  },

  // 切换旧密码显示
  toggleOldPassword() {
    this.setData({
      showOldPassword: !this.data.showOldPassword
    });
  },

  // 切换新密码显示
  toggleNewPassword() {
    this.setData({
      showNewPassword: !this.data.showNewPassword
    });
  },

  // 切换确认密码显示
  toggleConfirmPassword() {
    this.setData({
      showConfirmPassword: !this.data.showConfirmPassword
    });
  },

  // 验证输入
  validateInput() {
    const { oldPassword, newPassword, confirmPassword } = this.data;

    if (!oldPassword.trim()) {
      wx.showToast({
        title: '请输入旧密码',
        icon: 'none'
      });
      return false;
    }

    if (!newPassword.trim()) {
      wx.showToast({
        title: '请输入新密码',
        icon: 'none'
      });
      return false;
    }

    if (newPassword.length > 10) {
      wx.showToast({
        title: '新密码不能超过10位',
        icon: 'none'
      });
      return false;
    }

    if (newPassword === oldPassword) {
      wx.showToast({
        title: '新密码不能与旧密码相同',
        icon: 'none'
      });
      return false;
    }

    if (newPassword !== confirmPassword) {
      wx.showToast({
        title: '两次输入的密码不一致',
        icon: 'none'
      });
      return false;
    }

    return true;
  },

  // 提交修改密码
  async onSubmit() {
    if (!this.validateInput()) {
      return;
    }

    if (this.data.loading) {
      return;
    }

    this.setData({ loading: true });

    try {
      wx.showLoading({ title: '修改中...' });

      // 获取当前管理员信息
      const adminInfo = AdminAuth.getCurrentAdmin();
      const username = adminInfo?.username || '3086099731'; // 如果没有用户名，使用默认值
      
      console.log('修改密码请求，当前管理员信息:', adminInfo);
      console.log('使用的用户名:', username);
      console.log('旧密码:', this.data.oldPassword);
      console.log('新密码:', this.data.newPassword);
      
      const res = await wx.cloud.callFunction({
        name: 'adminManage',
        data: {
          action: 'changePassword',
          data: {
            oldPassword: this.data.oldPassword,
            newPassword: this.data.newPassword,
            username: username
          }
        }
      });

      wx.hideLoading();

      console.log('修改密码返回:', res.result);
      console.log('返回码:', res.result?.code);
      console.log('返回消息:', res.result?.message);

      if (res.result && res.result.code === 200) {
        wx.showToast({
          title: '密码修改成功',
          icon: 'success',
          duration: 2000
        });

        // 延迟返回
        setTimeout(() => {
          wx.navigateBack();
        }, 2000);
      } else {
        wx.showToast({
          title: res.result?.message || '修改失败',
          icon: 'none',
          duration: 2000
        });
        this.setData({ loading: false });
      }
    } catch (error) {
      wx.hideLoading();
      console.error('修改密码异常:', error);
      wx.showToast({
        title: '修改失败：' + (error.message || '网络错误'),
        icon: 'none',
        duration: 2000
      });
      this.setData({ loading: false });
    }
  },

  // 返回
  onBack() {
    wx.navigateBack();
  }
});

