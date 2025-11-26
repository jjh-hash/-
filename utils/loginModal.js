// utils/loginModal.js
/**
 * 登录弹窗工具类
 * 提供登录弹窗相关的功能
 */

const app = getApp();

class LoginModal {
  /**
   * 手动显示登录弹窗
   */
  static show() {
    app.showLoginModalManually();
  }

  /**
   * 检查是否需要登录
   * @param {Function} callback 需要登录时的回调
   * @param {Function} successCallback 已登录时的回调
   */
  static checkLogin(callback, successCallback) {
    if (app.globalData.isLoggedIn) {
      // 已登录，执行成功回调
      if (successCallback) {
        successCallback(app.globalData.userInfo);
      }
    } else {
      // 未登录，显示弹窗
      wx.showModal({
        title: '需要登录',
        content: '此功能需要登录后才能使用，是否立即登录？',
        confirmText: '立即登录',
        cancelText: '取消',
        success: (res) => {
          if (res.confirm) {
            // 用户选择登录
            if (callback) {
              callback();
            } else {
              this.show();
            }
          }
        }
      });
    }
  }

  /**
   * 强制登录（用于重要功能）
   * @param {string} message 提示信息
   * @param {Function} successCallback 登录成功回调
   */
  static forceLogin(message = '此功能需要登录', successCallback) {
    wx.showModal({
      title: '需要登录',
      content: message,
      confirmText: '立即登录',
      cancelText: '取消',
      success: (res) => {
        if (res.confirm) {
          this.show();
          
          // 监听登录成功
          const checkLogin = () => {
            if (app.globalData.isLoggedIn) {
              if (successCallback) {
                successCallback(app.globalData.userInfo);
              }
            } else {
              // 继续等待登录
              setTimeout(checkLogin, 1000);
            }
          };
          
          // 延迟检查登录状态
          setTimeout(checkLogin, 2000);
        }
      }
    });
  }

  /**
   * 静默登录（不显示弹窗）
   * @returns {Promise<Object>} 登录结果
   */
  static async silentLogin() {
    try {
      const result = await app.loginUser();
      return result;
    } catch (error) {
      console.error('静默登录失败:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 清除登录弹窗记录（用于测试）
   */
  static clearModalRecord() {
    wx.removeStorageSync('lastLoginModalTime');
  }

  /**
   * 设置弹窗显示间隔
   * @param {number} hours 间隔小时数
   */
  static setModalInterval(hours = 24) {
    wx.setStorageSync('loginModalInterval', hours);
  }

  /**
   * 获取弹窗显示间隔
   * @returns {number} 间隔小时数
   */
  static getModalInterval() {
    return wx.getStorageSync('loginModalInterval') || 24;
  }
}

module.exports = LoginModal;
