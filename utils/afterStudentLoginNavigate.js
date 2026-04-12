/**
 * 学生端登录 + 校区流程成功后：若同时存在商家/骑手身份，让用户选择进入用户端 / 商家端 / 骑手端。
 */
function navigateAfterStudentLogin(result) {
  if (!result || !result.ok || !result.userInfo) return;
  const hasMerchantPortal = !!result.hasMerchantPortal;
  const hasRiderPortal = !!result.hasRiderPortal;
  if (!hasMerchantPortal && !hasRiderPortal) {
    wx.switchTab({ url: '/pages/home/index' });
    return;
  }
  const openSheet = () => {
    const choices = [{ type: 'client', label: '用户端（点外卖）' }];
    if (hasMerchantPortal) choices.push({ type: 'merchant', label: '商家端' });
    if (hasRiderPortal) choices.push({ type: 'rider', label: '骑手端' });
    wx.showActionSheet({
      itemList: choices.map((c) => c.label),
      success(res) {
        const ch = choices[res.tapIndex];
        if (!ch || ch.type === 'client') {
          wx.switchTab({ url: '/pages/home/index' });
          return;
        }
        if (ch.type === 'merchant') {
          wx.reLaunch({ url: '/subpackages/merchant/pages/merchant/index' });
        } else if (ch.type === 'rider') {
          wx.reLaunch({ url: '/subpackages/rider/pages/rider-home/index' });
        }
      },
      fail() {
        wx.switchTab({ url: '/pages/home/index' });
      }
    });
  };
  // 紧跟在 showModal 选校之后时，略延迟再弹 ActionSheet，减少部分机型不弹窗
  setTimeout(openSheet, 280);
}

module.exports = {
  navigateAfterStudentLogin
};
