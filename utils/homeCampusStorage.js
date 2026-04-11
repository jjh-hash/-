/** 首页与子包共用的校区本地存储键，与云函数 campus 枚举一致 */
const CAMPUS_BAISHA = '白沙校区';
const CAMPUS_JINSHUI = '金水校区';
const STORAGE_KEY = 'homeCurrentCampus';

/**
 * 归一化校区字符串（trim + 合法枚举），避免各端存储读写类型/空白差异
 */
function normalizeHomeCampus(raw) {
  if (raw === undefined || raw === null) return '';
  const s = String(raw).trim();
  if (s === CAMPUS_JINSHUI || s === CAMPUS_BAISHA) return s;
  return '';
}

/** 仅在校验通过时写入，避免脏数据污染同步逻辑 */
function writeHomeCurrentCampus(raw) {
  const s = normalizeHomeCampus(raw);
  if (!s) return;
  try {
    wx.setStorageSync(STORAGE_KEY, s);
  } catch (e) {}
}

module.exports = {
  CAMPUS_BAISHA,
  CAMPUS_JINSHUI,
  STORAGE_KEY,
  normalizeHomeCampus,
  writeHomeCurrentCampus
};
