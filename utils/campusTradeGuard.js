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
    return !!wx.getStorageSync('userToken');
  } catch (e) {
    return false;
  }
}

function getUserBoundCampus() {
  try {
    const u = wx.getStorageSync('userInfo');
    return normalizeHomeCampus(u && u.campus);
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

module.exports = {
  TIP,
  TIP_NEED_CAMPUS,
  getUserBoundCampus,
  getBrowseCampusOrDefault,
  canTransactInCurrentBrowseCampus
};
