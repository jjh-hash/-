/**
 * 用户登记校区（users.campus）与当前首页浏览校区（homeCurrentCampus）不一致时，禁止下单等交易。
 */
const {
  CAMPUS_BAISHA,
  normalizeHomeCampus,
  STORAGE_KEY
} = require('./homeCampusStorage');

const TIP = '请在您所对应的校区购买商品';
const TIP_NEED_CAMPUS = '请先完善所在校区后再下单，可在「我的」页补选';

function isLoggedInClient() {
  try {
    if (wx.getStorageSync('userToken')) return true;
    const u = wx.getStorageSync('userInfo');
    return !!(u && (u.openid || u._id));
  } catch (e) {
    return false;
  }
}

/** 先读本地缓存，再读 App 全局（避免个别机型/时序下存储与内存短暂不一致） */
function getUserBoundCampus() {
  try {
    const u = wx.getStorageSync('userInfo');
    const fromStore = normalizeHomeCampus(u && u.campus);
    if (fromStore) return fromStore;
  } catch (e) {}
  try {
    const app = typeof getApp === 'function' ? getApp() : null;
    const g = app && app.globalData && app.globalData.userInfo;
    return normalizeHomeCampus(g && g.campus);
  } catch (e) {
    return '';
  }
}

/** 与首页默认一致：无存储时视为白沙校区 */
function getBrowseCampusOrDefault() {
  try {
    const s = normalizeHomeCampus(wx.getStorageSync(STORAGE_KEY));
    return s || CAMPUS_BAISHA;
  } catch (e) {
    return CAMPUS_BAISHA;
  }
}

/**
 * 已登录用户须登记白沙/金水校区方可下单；登记后与当前浏览校区不一致也不可下单。
 * 未登录时不拦截（各页应先 ensureLogin）。
 * @returns {{ ok: boolean, message?: string }}
 */
function canTransactInCurrentBrowseCampus() {
  const bound = getUserBoundCampus();
  if (isLoggedInClient() && !bound) {
    return { ok: false, message: TIP_NEED_CAMPUS };
  }
  if (!bound) return { ok: true };
  const browse = getBrowseCampusOrDefault();
  if (bound !== browse) return { ok: false, message: TIP };
  return { ok: true };
}

/** 长文案在窄屏上需足够展示时间（各端统一用 none 图标，避免 icon 兼容问题） */
function showTransactBlockedToast(gate) {
  if (!gate || gate.ok) return;
  const msg = gate.message || '暂时无法下单';
  const duration = msg.length > 20 ? 3500 : 2600;
  try {
    wx.showToast({ title: msg, icon: 'none', duration });
  } catch (e) {}
}

module.exports = {
  TIP,
  TIP_NEED_CAMPUS,
  getUserBoundCampus,
  getBrowseCampusOrDefault,
  canTransactInCurrentBrowseCampus,
  showTransactBlockedToast
};
