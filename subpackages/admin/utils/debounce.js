/**
 * 防抖函数：在 delay 毫秒内多次调用只执行最后一次
 * @param {Function} fn 要防抖的函数
 * @param {number} delay 延迟毫秒数，默认 300
 * @returns {Function} 防抖后的函数
 */
function debounce(fn, delay = 300) {
  let timer = null;
  return function (...args) {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      fn.apply(this, args);
      timer = null;
    }, delay);
  };
}

module.exports = {
  debounce
};
