/**
 * 学生端：微信登录 + 校区登记 + 同步 homeCurrentCampus（与「我的」点头像流程一致）
 * - 未登记校区：必选白沙/金水。
 * - 已登记校区：可「保持」或「更换」；首页仍可自由切换校区浏览，仅影响下单归属。
 */
const {
  normalizeHomeCampus,
  writeHomeCurrentCampus,
  CAMPUS_BAISHA,
  CAMPUS_JINSHUI
} = require('./homeCampusStorage');

function pickCampusActionSheet() {
  return new Promise((resolve) => {
    wx.showActionSheet({
      itemList: [CAMPUS_BAISHA, CAMPUS_JINSHUI],
      success: (r) => resolve(r.tapIndex === 0 ? CAMPUS_BAISHA : CAMPUS_JINSHUI),
      fail: () => resolve('')
    });
  });
}

function portalsFrom(loginRes) {
  return {
    hasMerchantPortal: !!(loginRes && loginRes.hasMerchantPortal),
    hasRiderPortal: !!(loginRes && loginRes.hasRiderPortal)
  };
}

/** @param {any} app getApp() */
async function runLoginAndCampus(app) {
  wx.showLoading({ title: '登录中...', mask: true });
  try {
    const res = await app.loginUser();
    wx.hideLoading();
    if (!res || !res.success || !res.userInfo) {
      return {
        ok: false,
        code: 'login',
        message: (res && res.error) || '登录失败，请重试'
      };
    }
    let portalMeta = portalsFrom(res);
    let userInfo = res.userInfo;
    const existing = normalizeHomeCampus(userInfo.campus);
    if (!existing) {
      const picked = await pickCampusActionSheet();
      if (!picked) {
        return Object.assign({ ok: false, code: 'needCampus', userInfo }, portalMeta);
      }
      wx.showLoading({ title: '保存校区...', mask: true });
      try {
        const r2 = await app.loginUser({ campus: picked });
        wx.hideLoading();
        if (!r2 || !r2.success || !r2.userInfo) {
          return Object.assign({ ok: false, code: 'campusSave', userInfo }, portalMeta);
        }
        userInfo = r2.userInfo;
        portalMeta = portalsFrom(r2);
      } catch (e) {
        wx.hideLoading();
        return Object.assign({ ok: false, code: 'campusSave', userInfo }, portalMeta);
      }
    } else {
      await new Promise((r) => setTimeout(r, 200));
      const wantChange = await new Promise((resolve) => {
        wx.showModal({
          title: '所在校区',
          content:
            `当前登记：${existing}。可按「更换」重新选择登记校区；首页仍可自由切换校区浏览，不影响查看其他校区商品。`,
          confirmText: '更换',
          cancelText: '保持',
          success: (m) => resolve(!!m.confirm),
          fail: () => resolve(false)
        });
      });
      if (!wantChange) {
        writeHomeCurrentCampus(existing);
        return Object.assign({ ok: true, userInfo }, portalMeta);
      }
      const picked = await pickCampusActionSheet();
      if (!picked) {
        writeHomeCurrentCampus(existing);
        return Object.assign({ ok: true, userInfo }, portalMeta);
      }
      wx.showLoading({ title: '保存校区...', mask: true });
      try {
        const r2 = await app.loginUser({ campus: picked });
        wx.hideLoading();
        if (!r2 || !r2.success || !r2.userInfo) {
          return Object.assign({ ok: false, code: 'campusSave', userInfo }, portalMeta);
        }
        userInfo = r2.userInfo;
        portalMeta = portalsFrom(r2);
      } catch (e) {
        wx.hideLoading();
        return Object.assign({ ok: false, code: 'campusSave', userInfo }, portalMeta);
      }
    }
    const c = normalizeHomeCampus(userInfo.campus);
    if (c) writeHomeCurrentCampus(c);
    return Object.assign({ ok: true, userInfo }, portalMeta);
  } catch (e) {
    wx.hideLoading();
    return { ok: false, code: 'exception', message: '登录失败，请重试' };
  }
}

module.exports = {
  pickCampusActionSheet,
  runLoginAndCampus
};
