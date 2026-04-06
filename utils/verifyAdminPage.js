/**
 * 管理端页面入口校验：无有效本地会话则引导至管理员登录页
 */
function verifyAdminPage() {
  const adminToken = wx.getStorageSync('adminToken');
  if (!adminToken) {
    wx.showModal({
      title: '访问受限',
      content: '请先使用管理员账号登录（商家注册页），或使用独立 Web 管理后台。',
      showCancel: false,
      success: () => {
        wx.reLaunch({ url: '/pages/merchant-register/index' });
      }
    });
    return false;
  }
  return true;
}

module.exports = {
  verifyAdminPage
};
