// utils/imageHelper.js
// 图片URL处理工具

/**
 * 处理图片URL，支持云存储fileID和HTTP URL
 * @param {string} imageUrl - 图片URL或云存储fileID
 * @param {string} defaultUrl - 默认图片URL
 * @returns {string} 处理后的图片URL
 */
function getImageUrl(imageUrl, defaultUrl = '') {
  // 如果没有图片URL，返回默认图片
  if (!imageUrl || imageUrl.trim() === '' || imageUrl === 'undefined' || imageUrl === 'null') {
    return defaultUrl || '/pages/小标/商家.png';
  }
  
  // 如果已经是HTTP/HTTPS URL，直接返回
  if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
    return imageUrl;
  }
  
  // 如果是云存储fileID（cloud://开头），直接返回（小程序会自动处理）
  if (imageUrl.startsWith('cloud://')) {
    return imageUrl;
  }
  
  // 其他情况（可能是相对路径或云存储fileID），直接返回
  return imageUrl;
}

/**
 * 获取商家/店铺默认头像
 */
function getDefaultStoreAvatar() {
  return '/pages/小标/商家.png';
}

/**
 * 获取用户默认头像
 */
function getDefaultUserAvatar() {
  return '/pages/小标/wode.png';
}

/**
 * 图片加载错误处理
 * @param {object} event - 图片加载错误事件
 * @param {object} context - 页面上下文
 * @param {string} defaultUrl - 默认图片URL
 */
function handleImageError(event, context, defaultUrl) {
  const { dataset } = event.currentTarget || {};
  const imageKey = dataset.imageKey || 'avatar';
  const defaultImage = defaultUrl || getDefaultStoreAvatar();
  
  console.warn('图片加载失败，使用默认图片:', {
    originalUrl: event.detail.errMsg,
    imageKey: imageKey,
    defaultImage: defaultImage
  });
  
  // 更新页面数据，使用默认图片
  if (context && context.setData) {
    const updateData = {};
    updateData[imageKey] = defaultImage;
    context.setData(updateData);
  }
}

module.exports = {
  getImageUrl,
  getDefaultStoreAvatar,
  getDefaultUserAvatar,
  handleImageError
};

