/**
 * 自定义导航 / 顶部 Tab 与刘海、打孔、状态栏的安全上边距（px）
 * 使用 wx.getWindowInfo().safeArea.top 与 statusBarHeight 取较大值，兼容各机型。
 */
function getContentTopInset() {
  try {
    if (typeof wx === 'undefined' || !wx.getWindowInfo) {
      return 20;
    }
    const win = wx.getWindowInfo();
    const safeTop =
      win.safeArea && typeof win.safeArea.top === 'number' ? win.safeArea.top : 0;
    const bar = Number(win.statusBarHeight) || 0;
    const inset = Math.max(safeTop, bar);
    return inset > 0 ? Math.ceil(inset) : 20;
  } catch (e) {
    return 20;
  }
}

/**
 * 订单页顶部分类栏：同时避让状态栏/刘海与右上角小程序胶囊按钮
 * - topInsetPx：内容从胶囊按钮下缘再下移若干像素
 * - capsuleRightPx：横向滚动 Tab 右侧留白，避免与胶囊重叠
 */
function getOrderCategoryBarInsets() {
  const fallbackTop = getContentTopInset();
  try {
    if (typeof wx === 'undefined' || !wx.getWindowInfo) {
      return { topInsetPx: fallbackTop, capsuleRightPx: 16 };
    }
    const win = wx.getWindowInfo();
    const W = Number(win.windowWidth || win.screenWidth) || 375;
    const safeTop =
      win.safeArea && typeof win.safeArea.top === 'number' ? win.safeArea.top : 0;
    const bar = Number(win.statusBarHeight) || 0;
    let topInset = Math.max(safeTop, bar, 20);

    let rightPad = 12;
    if (typeof wx.getMenuButtonBoundingClientRect === 'function') {
      const menu = wx.getMenuButtonBoundingClientRect();
      if (menu && typeof menu.bottom === 'number' && menu.bottom > 0) {
        topInset = Math.max(topInset, Math.ceil(menu.bottom) + 8);
      }
      if (menu && typeof menu.left === 'number' && menu.left > 0) {
        rightPad = Math.max(12, Math.ceil(W - menu.left + 8));
      }
    }

    return {
      topInsetPx: topInset,
      capsuleRightPx: rightPad
    };
  } catch (e) {
    return { topInsetPx: fallbackTop, capsuleRightPx: 16 };
  }
}

module.exports = {
  getContentTopInset,
  getOrderCategoryBarInsets
};
