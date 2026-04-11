/**
 * 金额（元）输入规范化：仅保留数字与一个小数点，最多两位小数。
 * 用于替代部分 Android 上 type="digit" 无小数点键盘的问题（改用默认 input + 过滤）。
 */
function normalizeMoneyInput(raw) {
  if (raw === undefined || raw === null) return '';
  let s = String(raw).trim().replace(/。/g, '.');
  s = s.replace(/[^\d.]/g, '');
  const dot = s.indexOf('.');
  if (dot !== -1) {
    const intPart = s.slice(0, dot).replace(/\./g, '');
    let decPart = s.slice(dot + 1).replace(/\./g, '');
    decPart = decPart.slice(0, 2);
    s = intPart + '.' + decPart;
    if (s === '.') s = '0.';
    else if (s.startsWith('.')) s = '0' + s;
  } else {
    s = s.replace(/\./g, '');
  }
  return s;
}

module.exports = {
  normalizeMoneyInput
};
