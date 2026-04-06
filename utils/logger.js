/**
 * 统一日志工具：正式版不输出，减少主线程占用与日志体积
 * 使用方式：const log = require('../../utils/logger.js'); log.log('xxx');
 */
const isDev = (function () {
  try {
    const account = wx.getAccountInfoSync();
    return account.miniProgram.envVersion !== 'release';
  } catch (e) {
    return true;
  }
})();

module.exports = {
  log: isDev ? (...args) => console.log(...args) : () => {},
  warn: isDev ? (...args) => console.warn(...args) : () => {},
  error: isDev ? (...args) => console.error(...args) : () => {},
  info: isDev ? (...args) => console.info(...args) : () => {}
};
