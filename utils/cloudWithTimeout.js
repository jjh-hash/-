/**
 * 云函数调用 + 超时控制，弱网时避免长时间挂起
 * @param {Object} options - 同 wx.cloud.callFunction
 * @param {number} ms - 超时毫秒数，默认 15000
 * @returns {Promise}
 */
function callFunctionWithTimeout(options, ms = 15000) {
  return Promise.race([
    wx.cloud.callFunction(options),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('请求超时，请检查网络后重试')), ms)
    )
  ]);
}

module.exports = { callFunctionWithTimeout };
