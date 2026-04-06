// pages/admin-profile/index.js
const log = require('../../../../utils/logger.js');
const { verifyAdminPage } = require('../../utils/verifyAdminPage.js');

Page({
  data: {
    statusBarHeight: wx.getWindowInfo().statusBarHeight || 20,
    
    // 管理员信息
    adminInfo: {
      username: '超级管理员',
      role: 'super_admin',
      lastLoginTime: '2025-01-03 18:43',
      loginCount: 156,
      permissions: ['all']
    },
    
    // 系统信息
    systemInfo: {
      version: '加载中...',
      buildTime: '加载中...',
      environment: '云环境',
      uptime: '计算中...',
      startTime: null // 系统启动时间（时间戳）
    },
    
    // 操作日志（全部）
    operationLogs: [],
    // 显示的日志（前5条）
    displayLogs: [],
    
    // 运行时长定时器
    uptimeTimer: null
  },

  onLoad() {
    if (!verifyAdminPage()) return;
    log.log('管理员信息页面加载');
    this.loadRecentLogs();
    this.initUptime();
    this.initSystemInfo();
  },

  onShow() {
    // 页面显示时刷新操作日志
    this.loadRecentLogs();
    // 重新计算运行时长
    this.updateUptime();
  },

  onUnload() {
    if (this._uptimeTimer) {
      clearInterval(this._uptimeTimer);
      this._uptimeTimer = null;
    }
  },

  onBack() {
    wx.navigateBack();
  },

  // 初始化系统信息
  async initSystemInfo() {
    let version = 'v0.7.0'; // 默认版本号
    let buildTime = '';
    const environment = '云环境';

    try {
      // 1. 尝试从微信 API 获取版本号（仅在正式版有效）
      try {
        const accountInfo = wx.getAccountInfoSync();
        if (accountInfo && accountInfo.miniProgram && accountInfo.miniProgram.version) {
          version = `v${accountInfo.miniProgram.version}`;
          log.log('【系统信息】从微信API获取版本号:', version);
        } else {
          log.log('【系统信息】微信API未返回版本号（可能是开发版/体验版），使用默认值 v0.7.0');
        }
      } catch (error) {
        log.warn('【系统信息】获取微信版本号失败:', error);
      }

      // 2. 从云配置获取系统信息
      const res = await wx.cloud.callFunction({
        name: 'platformConfig',
        data: {
          action: 'getConfig'
        }
      });

      if (res.result && res.result.code === 200 && res.result.data) {
        const config = res.result.data;
        
        // 如果微信API没有获取到版本号，尝试从云配置读取
        if (version === 'v0.7.0' && config.appVersion) {
          version = config.appVersion.startsWith('v') ? config.appVersion : `v${config.appVersion}`;
          log.log('【系统信息】从云配置获取版本号:', version);
        }
        
        // 格式化构建时间（使用部署时间或当前时间）
        if (config.deploymentTime) {
          const deployDate = new Date(config.deploymentTime);
          if (!isNaN(deployDate.getTime())) {
            buildTime = this.formatDate(deployDate);
            log.log('【系统信息】从云配置获取构建时间:', buildTime);
          }
        }
      }
      
      // 如果没有构建时间，使用当前时间
      if (!buildTime) {
        buildTime = this.formatDate(new Date());
        log.log('【系统信息】使用当前时间作为构建时间:', buildTime);
      }

      this.setData({
        'systemInfo.version': version,
        'systemInfo.buildTime': buildTime,
        'systemInfo.environment': environment
      });
    } catch (error) {
      log.error('【系统信息】获取配置失败:', error);
      // 失败时使用默认值
      this.setData({
        'systemInfo.version': version,
        'systemInfo.buildTime': this.formatDate(new Date()),
        'systemInfo.environment': environment
      });
    }
  },

  // 格式化日期为 YYYY-MM-DD
  formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  },

  // 初始化运行时长
  async initUptime() {
    let startTime = null;
    
    try {
      // 尝试从云函数获取系统启动时间
      const res = await wx.cloud.callFunction({
        name: 'platformConfig',
        data: {
          action: 'getConfig'
        }
      });

      log.log('【运行时长】云函数返回结果:', res.result);

      if (res.result && res.result.code === 200 && res.result.data) {
        const config = res.result.data;
        log.log('【运行时长】配置数据:', config);
        log.log('【运行时长】systemStartTime类型:', typeof config.systemStartTime, config.systemStartTime);
        log.log('【运行时长】deploymentTime类型:', typeof config.deploymentTime, config.deploymentTime);
        
        // 尝试获取系统启动时间
        if (config.systemStartTime) {
          startTime = this.parseDate(config.systemStartTime);
          log.log('【运行时长】解析systemStartTime结果:', startTime);
        }
        
        if (!startTime && config.deploymentTime) {
          startTime = this.parseDate(config.deploymentTime);
          log.log('【运行时长】解析deploymentTime结果:', startTime);
        }
      }
    } catch (error) {
      log.error('【运行时长】获取配置失败:', error);
    }
    
    // 如果仍然没有获取到启动时间，使用构建时间
    if (!startTime || isNaN(startTime) || startTime <= 0) {
      log.log('【运行时长】使用构建时间作为后备方案');
      const buildTimeStr = this.data.systemInfo.buildTime + ' 00:00:00';
      const buildTime = new Date(buildTimeStr).getTime();
      if (!isNaN(buildTime) && buildTime > 0) {
        startTime = buildTime;
        log.log('【运行时长】使用构建时间:', startTime, new Date(startTime));
      } else {
        // 如果构建时间也无效，使用当前时间减去15天8小时（模拟数据）
        startTime = Date.now() - (15 * 24 + 8) * 60 * 60 * 1000;
        log.log('【运行时长】使用模拟时间:', startTime, new Date(startTime));
      }
    }

    // 最终验证：确保startTime是有效的时间戳
    if (!startTime || isNaN(startTime) || startTime <= 0) {
      log.error('【运行时长】所有方案都失败，使用默认值');
      startTime = Date.now() - (15 * 24 + 8) * 60 * 60 * 1000;
    }

    log.log('【运行时长】最终启动时间:', startTime, new Date(startTime));

    // 直接设置startTime并立即更新
    this.setData({
      'systemInfo.startTime': startTime
    });
    
    // 立即更新一次显示
    this.updateUptime();
    
    // 设置定时器，每分钟更新一次（存于实例，onUnload 时清理）
    this._uptimeTimer = setInterval(() => {
      this.updateUptime();
    }, 60000);
  },

  // 解析日期（处理各种日期格式）
  parseDate(dateValue) {
    if (!dateValue) {
      log.log('【运行时长】parseDate: dateValue为空');
      return null;
    }
    
    log.log('【运行时长】parseDate: 输入类型:', typeof dateValue, '值:', dateValue);
    
    try {
      // 如果是Date对象
      if (dateValue instanceof Date) {
        const timestamp = dateValue.getTime();
        log.log('【运行时长】parseDate: Date对象，返回:', timestamp);
        return timestamp;
      }
      
      // 如果是对象且有getTime方法
      if (typeof dateValue === 'object' && typeof dateValue.getTime === 'function') {
        const timestamp = dateValue.getTime();
        log.log('【运行时长】parseDate: 对象有getTime方法，返回:', timestamp);
        return timestamp;
      }
      
      // 如果是数字（时间戳）
      if (typeof dateValue === 'number') {
        log.log('【运行时长】parseDate: 数字类型，返回:', dateValue);
        return dateValue;
      }
      
      // 如果是字符串
      if (typeof dateValue === 'string') {
        const parsed = new Date(dateValue);
        if (!isNaN(parsed.getTime())) {
          log.log('【运行时长】parseDate: 字符串解析成功，返回:', parsed.getTime());
          return parsed.getTime();
        } else {
          log.warn('【运行时长】parseDate: 字符串解析失败:', dateValue);
        }
      }
      
      // 如果是对象，尝试多种方式转换
      if (typeof dateValue === 'object') {
        // 尝试直接构造Date对象
        try {
          const date = new Date(dateValue);
          if (!isNaN(date.getTime())) {
            log.log('【运行时长】parseDate: 对象直接转换成功，返回:', date.getTime());
            return date.getTime();
          }
        } catch (e) {
          log.warn('【运行时长】parseDate: 对象直接转换失败:', e);
        }
        
        // 尝试JSON序列化后再解析
        try {
          const dateStr = JSON.stringify(dateValue);
          const parsed = new Date(dateStr);
          if (!isNaN(parsed.getTime())) {
            log.log('【运行时长】parseDate: JSON序列化后解析成功，返回:', parsed.getTime());
            return parsed.getTime();
          }
        } catch (e) {
          log.warn('【运行时长】parseDate: JSON序列化后解析失败:', e);
        }
        
        // 尝试访问可能的日期字段
        if (dateValue.$date) {
          const timestamp = this.parseDate(dateValue.$date);
          if (timestamp) {
            log.log('【运行时长】parseDate: 访问$date字段成功，返回:', timestamp);
            return timestamp;
          }
        }
      }
      
      log.warn('【运行时长】parseDate: 所有解析方式都失败，返回null');
      return null;
    } catch (error) {
      log.error('【运行时长】日期解析异常:', error, dateValue);
      return null;
    }
  },

  // 更新运行时长显示
  updateUptime() {
    const startTime = this.data.systemInfo.startTime;
    
    log.log('【运行时长】updateUptime被调用，startTime:', startTime);
    
    if (!startTime || isNaN(startTime) || startTime <= 0) {
      log.warn('【运行时长】startTime无效，显示"计算中..."');
      this.setData({
        'systemInfo.uptime': '计算中...'
      });
      return;
    }

    const now = Date.now();
    const diff = now - startTime; // 时间差（毫秒）

    if (diff < 0) {
      log.warn('【运行时长】时间差为负数，使用默认值');
      this.setData({
        'systemInfo.uptime': '计算中...'
      });
      return;
    }

    // 计算天数
    const days = Math.floor(diff / (24 * 60 * 60 * 1000));
    // 计算小时数（剩余时间）
    const hours = Math.floor((diff % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
    // 计算分钟数（可选，如果需要更精确）
    const minutes = Math.floor((diff % (60 * 60 * 1000)) / (60 * 1000));

    // 格式化显示
    let uptimeText = '';
    if (days > 0) {
      uptimeText = `${days}天${hours}小时`;
    } else if (hours > 0) {
      uptimeText = `${hours}小时${minutes}分钟`;
    } else {
      uptimeText = `${minutes}分钟`;
    }

    log.log('【运行时长】计算完成:', uptimeText, '时间差:', diff, '毫秒');

    this.setData({
      'systemInfo.uptime': uptimeText
    });
  },

  // 加载最近操作日志
  async loadRecentLogs() {
    try {
      const res = await wx.cloud.callFunction({
        name: 'adminLogManage',
        data: {
          action: 'getRecent',
          data: { limit: 10 }
        }
      });

      log.log('日志接口返回:', res.result);

      if (res.result && res.result.code === 200 && res.result.data && res.result.data.logs) {
        const logs = res.result.data.logs.map(log => ({
          id: log.id,
          action: log.action,
          target: log.target,
          time: log.time,
          result: this.formatResult(log.result)
        }));
        
        // 只显示前5条
        this.setData({
          operationLogs: logs,
          displayLogs: logs.slice(0, 5)
        });
        
        log.log('加载操作日志成功，共', logs.length, '条，显示前5条');
      } else {
        log.log('使用模拟数据');
        // 即使是模拟数据也限制显示
        const mockLogs = this.data.operationLogs.length > 0 ? this.data.operationLogs : [
          {
            id: 1,
            action: '商家审核',
            target: '河工零食',
            time: '2025-01-03 18:30',
            result: '通过'
          },
          {
            id: 2,
            action: '订单处理',
            target: '订单#202501030001',
            time: '2025-01-03 18:25',
            result: '完成'
          },
          {
            id: 3,
            action: '数据导出',
            target: '销售报表',
            time: '2025-01-03 18:20',
            result: '成功'
          }
        ];
        this.setData({
          operationLogs: mockLogs,
          displayLogs: mockLogs.slice(0, 5)
        });
      }
    } catch (error) {
      log.error('加载操作日志失败:', error);
      // 失败时使用模拟数据
      const mockLogs = [
        {
          id: 1,
          action: '商家审核',
          target: '河工零食',
          time: '2025-01-03 18:30',
          result: '通过'
        },
        {
          id: 2,
          action: '订单处理',
          target: '订单#202501030001',
          time: '2025-01-03 18:25',
          result: '完成'
        },
        {
          id: 3,
          action: '数据导出',
          target: '销售报表',
          time: '2025-01-03 18:20',
          result: '成功'
        }
      ];
      this.setData({
        operationLogs: mockLogs,
        displayLogs: mockLogs.slice(0, 5)
      });
    }
  },

  // 格式化操作结果
  formatResult(result) {
    const resultMap = {
      'success': '成功',
      'failed': '失败',
      'approved': '通过',
      'rejected': '拒绝',
      'completed': '完成',
      'cancelled': '取消'
    };
    return resultMap[result] || result;
  },



  // 修改密码 - 跳转到修改密码页面
  onChangePassword() {
    wx.navigateTo({
      url: '/subpackages/admin/pages/admin-change-password/index'
    });
  },

  // 查看操作日志 - 跳转到操作日志列表页面
  onViewLogs() {
    wx.navigateTo({
      url: '/subpackages/admin/pages/admin-log-list/index'
    });
  },

  // 关于我们
  onAbout() {
    const version = this.data.systemInfo.version || 'v0.7.0';
    const buildTime = this.data.systemInfo.buildTime || this.formatDate(new Date());
    
    wx.showModal({
      title: '关于校园外卖管理端',
      content: `版本：${version}\n开发团队：校园外卖项目组\n更新时间：${buildTime}`,
      showCancel: false
    });
  },


});