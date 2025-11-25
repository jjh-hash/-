/**
 * 日期时间格式化工具函数
 * 统一使用中国时区（UTC+8）
 */

/**
 * 格式化日期为中国时间（UTC+8）
 * @param {Date|String|Object} date - 日期对象、字符串或云数据库日期对象
 * @param {String} format - 格式类型：'datetime' | 'date' | 'time' | 'full'
 * @returns {String} 格式化后的日期时间字符串
 */
function formatDateChina(date, format = 'datetime') {
  if (!date) return '';
  
  let d;
  
  // 处理云数据库的Date对象（有getTime方法）
  if (date && typeof date === 'object' && date.getTime && typeof date.getTime === 'function') {
    d = new Date(date.getTime());
  } else if (date && typeof date === 'object' && date.getFullYear) {
    d = date;
  } else if (typeof date === 'string') {
    // 处理字符串日期
    let dateStr = date;
    // 兼容 "2025-11-01 07:32" 格式，转换为 ISO 格式
    if (dateStr.includes(' ') && !dateStr.includes('T')) {
      // 检查是否有时区信息
      const hasTimezone = dateStr.endsWith('Z') || 
                         /[+-]\d{2}:?\d{2}$/.test(dateStr) ||
                         dateStr.match(/[+-]\d{4}$/);
      
      if (!hasTimezone) {
        // 如果没有时区信息，假设是UTC时间（云数据库通常返回UTC时间），添加Z后缀
        dateStr = dateStr.replace(' ', 'T') + 'Z';
      } else {
        dateStr = dateStr.replace(' ', 'T');
      }
    }
    // 兼容 iOS 格式
    if (dateStr.includes('-') && !dateStr.includes('T') && !dateStr.includes('Z')) {
      dateStr = dateStr.replace(/(\d{4})-(\d{2})-(\d{2})/, '$1/$2/$3');
    }
    d = new Date(dateStr);
  } else if (typeof date === 'object' && date.type === 'date') {
    // 处理云数据库的特殊日期对象格式 { type: 'date', date: '2025-11-11T14:53:00.000Z' }
    if (date.date) {
      d = new Date(date.date);
    } else {
      d = new Date(date);
    }
  } else {
    d = new Date(date);
  }
  
  if (isNaN(d.getTime())) {
    console.warn('【格式化日期】无效的日期:', date);
    return '';
  }
  
  // 云数据库返回的日期通常是UTC时间，需要转换为中国时间（UTC+8）
  // 获取UTC时间戳，然后加上8小时
  const chinaTimeOffset = 8 * 60 * 60 * 1000; // 8小时的毫秒数
  const chinaTime = new Date(d.getTime() + chinaTimeOffset);
  
  // 使用UTC方法获取时间组件（因为我们已经手动加上了时区偏移）
  const year = chinaTime.getUTCFullYear();
  const month = String(chinaTime.getUTCMonth() + 1).padStart(2, '0');
  const day = String(chinaTime.getUTCDate()).padStart(2, '0');
  const hour = String(chinaTime.getUTCHours()).padStart(2, '0');
  const minute = String(chinaTime.getUTCMinutes()).padStart(2, '0');
  const second = String(chinaTime.getUTCSeconds()).padStart(2, '0');
  
  switch(format) {
    case 'date':
      return `${year}-${month}-${day}`;
    case 'time':
      return `${hour}:${minute}`;
    case 'full':
      return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
    case 'datetime':
    default:
      return `${year}-${month}-${day} ${hour}:${minute}`;
  }
}

/**
 * 获取当前中国时间（UTC+8）
 * @returns {Date} 中国时间的Date对象
 */
function getChinaTime() {
  const now = new Date();
  const chinaTimeOffset = 8 * 60 * 60 * 1000; // 8小时的毫秒数
  return new Date(now.getTime() + chinaTimeOffset);
}

/**
 * 获取今天的日期字符串（中国时区，格式：YYYY-MM-DD）
 * @returns {String} 今天的日期字符串
 */
function getTodayDateStr() {
  const chinaTime = getChinaTime();
  const year = chinaTime.getUTCFullYear();
  const month = String(chinaTime.getUTCMonth() + 1).padStart(2, '0');
  const day = String(chinaTime.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * 获取当前月份字符串（中国时区，格式：YYYY-MM）
 * @returns {String} 当前月份字符串
 */
function getCurrentMonthStr() {
  const chinaTime = getChinaTime();
  const year = chinaTime.getUTCFullYear();
  const month = String(chinaTime.getUTCMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

/**
 * 格式化日期为中国时间（简短格式：YYYY.MM.DD）
 */
function formatDateShort(date) {
  if (!date) return '';
  
  let d;
  
  if (date && typeof date === 'object' && date.getTime && typeof date.getTime === 'function') {
    d = new Date(date.getTime());
  } else if (date && typeof date === 'object' && date.getFullYear) {
    d = date;
  } else if (typeof date === 'string') {
    let dateStr = date;
    if (dateStr.includes(' ') && !dateStr.includes('T')) {
      const hasTimezone = dateStr.endsWith('Z') || 
                         /[+-]\d{2}:?\d{2}$/.test(dateStr) ||
                         dateStr.match(/[+-]\d{4}$/);
      if (!hasTimezone) {
        dateStr = dateStr.replace(' ', 'T') + 'Z';
      } else {
        dateStr = dateStr.replace(' ', 'T');
      }
    }
    if (dateStr.includes('-') && !dateStr.includes('T') && !dateStr.includes('Z')) {
      dateStr = dateStr.replace(/(\d{4})-(\d{2})-(\d{2})/, '$1/$2/$3');
    }
    d = new Date(dateStr);
  } else if (typeof date === 'object' && date.type === 'date') {
    if (date.date) {
      d = new Date(date.date);
    } else {
      d = new Date(date);
    }
  } else {
    d = new Date(date);
  }
  
  if (isNaN(d.getTime())) {
    return '';
  }
  
  const chinaTimeOffset = 8 * 60 * 60 * 1000;
  const chinaTime = new Date(d.getTime() + chinaTimeOffset);
  
  const year = chinaTime.getUTCFullYear();
  const month = String(chinaTime.getUTCMonth() + 1).padStart(2, '0');
  const day = String(chinaTime.getUTCDate()).padStart(2, '0');
  
  return `${year}.${month}.${day}`;
}

module.exports = {
  formatDateChina,
  formatDateShort,
  getChinaTime,
  getTodayDateStr,
  getCurrentMonthStr
};
