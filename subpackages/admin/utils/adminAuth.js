// utils/adminAuth.js
// 管理员权限控制工具类

/**
 * 检查管理员权限
 * @returns {Promise<Object>} 返回管理员信息或错误
 */
async function checkAdminAuth() {
  return new Promise((resolve, reject) => {
    try {
      // 获取管理员token和信息
      const adminToken = wx.getStorageSync('adminToken');
      const adminInfo = wx.getStorageSync('adminInfo');
      
      // 检查是否登录
      if (!adminToken || !adminInfo) {
        wx.showModal({
          title: '访问受限',
          content: '您没有管理员权限，请重新登录',
          showCancel: false,
          success: () => {
            wx.reLaunch({
              url: '/subpackages/admin/pages/admin-dashboard/index'
            });
          }
        });
        reject(new Error('未登录'));
        return;
      }
      
      // 检查token过期
      if (adminInfo.expireTime && Date.now() > adminInfo.expireTime) {
        // 清除过期信息
        wx.removeStorageSync('adminToken');
        wx.removeStorageSync('adminInfo');
        
        wx.showModal({
          title: '登录已过期',
          content: '您的登录已过期，请重新登录',
          showCancel: false,
          success: () => {
            wx.reLaunch({
              url: '/subpackages/admin/pages/admin-dashboard/index'
            });
          }
        });
        reject(new Error('登录已过期'));
        return;
      }
      
      // 权限验证通过
      resolve(adminInfo);
      
    } catch (error) {
      console.error('权限检查失败:', error);
      reject(error);
    }
  });
}

/**
 * 检查特定权限
 * @param {string} permission 权限名称
 * @returns {Promise<boolean>} 是否有权限
 */
async function checkPermission(permission) {
  try {
    const adminInfo = await checkAdminAuth();
    
    // 超级管理员拥有所有权限
    if (adminInfo.role === 'super_admin') {
      return true;
    }
    
    // 检查具体权限
    return adminInfo.permissions && adminInfo.permissions.includes(permission);
    
  } catch (error) {
    console.error('权限检查失败:', error);
    return false;
  }
}

/**
 * 设置管理员登录信息
 * @param {Object} adminInfo 管理员信息
 * @param {string} token 访问令牌
 */
function setAdminAuth(adminInfo, token) {
  // 设置过期时间（24小时）
  const expireTime = Date.now() + 24 * 60 * 60 * 1000;
  
  wx.setStorageSync('adminToken', token);
  wx.setStorageSync('adminInfo', {
    ...adminInfo,
    expireTime
  });
}

/**
 * 清除管理员登录信息
 */
function clearAdminAuth() {
  wx.removeStorageSync('adminToken');
  wx.removeStorageSync('adminInfo');
}

/**
 * 获取当前管理员信息
 * @returns {Object|null} 管理员信息
 */
function getCurrentAdmin() {
  try {
    return wx.getStorageSync('adminInfo');
  } catch (error) {
    console.error('获取管理员信息失败:', error);
    return null;
  }
}

/**
 * 权限装饰器 - 用于页面方法
 * @param {string} permission 所需权限
 * @param {Function} method 原方法
 * @returns {Function} 装饰后的方法
 */
function requirePermission(permission, method) {
  return async function(...args) {
    const hasPermission = await checkPermission(permission);
    
    if (!hasPermission) {
      wx.showModal({
        title: '权限不足',
        content: '您没有执行此操作的权限',
        showCancel: false
      });
      return;
    }
    
    return method.apply(this, args);
  };
}

/**
 * 页面权限检查中间件
 * @param {string} requiredPermission 所需权限
 */
function pageAuthMiddleware(requiredPermission) {
  return function(target, propertyKey, descriptor) {
    const originalMethod = descriptor.value;
    
    descriptor.value = async function(...args) {
      try {
        await checkAdminAuth();
        
        if (requiredPermission) {
          const hasPermission = await checkPermission(requiredPermission);
          if (!hasPermission) {
            wx.showModal({
              title: '权限不足',
              content: '您没有访问此页面的权限',
              showCancel: false,
              success: () => {
                wx.navigateBack();
              }
            });
            return;
          }
        }
        
        return originalMethod.apply(this, args);
        
      } catch (error) {
        console.error('页面权限检查失败:', error);
        return;
      }
    };
    
    return descriptor;
  };
}

module.exports = {
  checkAdminAuth,
  checkPermission,
  setAdminAuth,
  clearAdminAuth,
  getCurrentAdmin,
  requirePermission,
  pageAuthMiddleware
};
