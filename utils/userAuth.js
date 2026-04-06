/**
 * 用户认证工具类
 * 提供用户登录、登出、状态检查等功能
 */

class UserAuth {
  constructor() {
    this.app = getApp();
  }

  /**
   * 检查用户是否已登录
   * @returns {boolean} 是否已登录
   */
  isLoggedIn() {
    return this.app.globalData.isLoggedIn;
  }

  /**
   * 获取用户信息
   * @returns {Object|null} 用户信息
   */
  getUserInfo() {
    return this.app.globalData.userInfo;
  }

  /**
   * 获取用户OpenID
   * @returns {string|null} 用户OpenID
   */
  getOpenId() {
    return this.app.globalData.openid;
  }

  /**
   * 获取用户Token
   * @returns {string|null} 用户Token
   */
  getUserToken() {
    return this.app.globalData.userToken;
  }

  /**
   * 用户登录
   * @param {boolean} showLoading 是否显示加载提示
   * @returns {Promise<Object>} 登录结果
   */
  async login(showLoading = true) {
    try {
      if (showLoading) {
        wx.showLoading({
          title: '登录中...',
          mask: true
        });
      }

      const result = await this.app.loginUser();
      
      if (showLoading) {
        wx.hideLoading();
      }

      return result;
    } catch (error) {
      if (showLoading) {
        wx.hideLoading();
      }
      
      console.error('用户登录失败:', error);
      return {
        success: false,
        error: error.message || '登录失败'
      };
    }
  }

  /**
   * 确保用户已登录（如果未登录则自动登录）
   * @param {boolean} showLoading 是否显示加载提示
   * @returns {Promise<Object|null>} 用户信息或null
   */
  async ensureLogin(showLoading = true) {
    if (this.isLoggedIn()) {
      return this.getUserInfo();
    }

    const loginResult = await this.login(showLoading);
    if (loginResult.success) {
      return loginResult.userInfo;
    } else {
      return null;
    }
  }

  /**
   * 更新用户信息
   * @param {Object} newUserInfo 新的用户信息
   */
  updateUserInfo(newUserInfo) {
    if (this.isLoggedIn()) {
      // 更新本地存储
      wx.setStorageSync('userInfo', newUserInfo);
      
      // 更新全局数据
      this.app.globalData.userInfo = newUserInfo;
      
      console.log('用户信息已更新:', newUserInfo);
    }
  }

  /**
   * 检查用户角色
   * @param {string} role 角色名称
   * @returns {boolean} 是否具有该角色
   */
  hasRole(role) {
    const userInfo = this.getUserInfo();
    return userInfo && userInfo.role === role;
  }

  /**
   * 检查用户状态
   * @param {string} status 状态名称
   * @returns {boolean} 是否具有该状态
   */
  hasStatus(status) {
    const userInfo = this.getUserInfo();
    return userInfo && userInfo.status === status;
  }

  /**
   * 检查用户是否为活跃状态
   * @returns {boolean} 是否为活跃用户
   */
  isActive() {
    return this.hasStatus('active');
  }

  /**
   * 获取用户昵称
   * @returns {string} 用户昵称
   */
  getNickname() {
    const userInfo = this.getUserInfo();
    return userInfo ? userInfo.nickname : '未登录用户';
  }

  /**
   * 获取用户头像
   * @returns {string} 用户头像URL
   */
  getAvatar() {
    const userInfo = this.getUserInfo();
    return userInfo ? userInfo.avatar : '';
  }

  /**
   * 获取用户手机号
   * @returns {string} 用户手机号
   */
  getPhone() {
    const userInfo = this.getUserInfo();
    return userInfo ? userInfo.phone : '';
  }

  /**
   * 获取用户邮箱
   * @returns {string} 用户邮箱
   */
  getEmail() {
    const userInfo = this.getUserInfo();
    return userInfo ? userInfo.email : '';
  }

  /**
   * 获取用户校区
   * @returns {string} 用户校区
   */
  getCampus() {
    const userInfo = this.getUserInfo();
    return userInfo ? userInfo.campus : '';
  }

  /**
   * 显示登录弹窗
   */
  showLoginModal() {
    this.app.showLoginModalManually();
  }

  /**
   * 需要登录的操作包装器
   * @param {Function} callback 需要登录后执行的回调函数
   * @param {Object} options 选项
   */
  async requireLogin(callback, options = {}) {
    const { 
      showLoading = true, 
      showModal = true,
      modalTitle = '需要登录',
      modalContent = '请先登录后再进行操作'
    } = options;

    if (this.isLoggedIn()) {
      return await callback();
    }

    if (showModal) {
      const res = await new Promise((resolve) => {
        wx.showModal({
          title: modalTitle,
          content: modalContent,
          confirmText: '立即登录',
          cancelText: '取消',
          success: (result) => {
            resolve(result.confirm);
          },
          fail: () => {
            resolve(false);
          }
        });
      });

      if (res) {
        const userInfo = await this.ensureLogin(showLoading);
        if (userInfo) {
          return await callback();
        }
      }
    } else {
      const userInfo = await this.ensureLogin(showLoading);
      if (userInfo) {
        return await callback();
      }
    }

    return null;
  }
}

// 创建单例实例
const userAuth = new UserAuth();

module.exports = userAuth;