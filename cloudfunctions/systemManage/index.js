// 系统管理云函数
const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const _ = db.command;

exports.main = async (event, context) => {
  console.log('【系统管理】请求:', event);
  
  const { action, data } = event;
  
  try {
    switch (action) {
      case 'getSystemStatus':
        return await getSystemStatus();
      case 'getSystemInfo':
        return await getSystemInfo();
      case 'setMaintenanceMode':
        return await setMaintenanceMode(data);
      case 'getMaintenanceMode':
        return await getMaintenanceMode();
      case 'getSystemStats':
        return await getSystemStats(data);
      case 'cleanupOldData':
        return await cleanupOldData(data);
      case 'healthCheck':
        return await healthCheck();
      default:
        return {
          code: 400,
          message: '未知操作',
          data: null
        };
    }
  } catch (error) {
    console.error('【系统管理】错误:', error);
    return {
      code: 500,
      message: '系统异常: ' + error.message,
      data: null
    };
  }
};

/**
 * 获取系统状态
 */
async function getSystemStatus() {
  try {
    const status = {
      database: 'online',
      storage: 'online',
      cloudFunctions: 'online',
      timestamp: new Date().toISOString()
    };
    
    // 检查数据库连接
    try {
      await db.collection('platform_config').limit(1).get();
      status.database = 'online';
    } catch (error) {
      console.error('数据库连接检查失败:', error);
      status.database = 'offline';
    }
    
    return {
      code: 200,
      message: '获取成功',
      data: status
    };
  } catch (error) {
    console.error('获取系统状态失败:', error);
    return {
      code: 500,
      message: '获取失败: ' + error.message,
      data: null
    };
  }
}

/**
 * 获取系统信息
 */
async function getSystemInfo() {
  try {
    // 获取平台配置中的系统启动时间
    let systemStartTime = null;
    try {
      const configResult = await db.collection('platform_config')
        .limit(1)
        .get();
      
      if (configResult.data.length > 0) {
        const config = configResult.data[0];
        if (config.createdAt) {
          // 处理云数据库日期对象
          if (config.createdAt instanceof Date) {
            systemStartTime = config.createdAt.toISOString();
          } else if (typeof config.createdAt === 'object') {
            try {
              const date = new Date(config.createdAt);
              if (!isNaN(date.getTime())) {
                systemStartTime = date.toISOString();
              }
            } catch (e) {
              console.warn('日期转换失败:', e);
            }
          } else {
            systemStartTime = config.createdAt;
          }
        }
      }
    } catch (error) {
      console.warn('获取系统启动时间失败:', error);
    }
    
    // 获取各集合的数据统计
    const stats = await getCollectionStats();
    
    const systemInfo = {
      version: '1.0.0',
      environment: cloud.DYNAMIC_CURRENT_ENV || 'production',
      startTime: systemStartTime,
      uptime: systemStartTime ? calculateUptime(systemStartTime) : null,
      stats: stats,
      timestamp: new Date().toISOString()
    };
    
    return {
      code: 200,
      message: '获取成功',
      data: systemInfo
    };
  } catch (error) {
    console.error('获取系统信息失败:', error);
    return {
      code: 500,
      message: '获取失败: ' + error.message,
      data: null
    };
  }
}

/**
 * 获取集合统计信息
 */
async function getCollectionStats() {
  const collections = [
    'users',
    'merchants',
    'orders',
    'products',
    'stores',
    'admin_logs'
  ];
  
  const stats = {};
  
  for (const collectionName of collections) {
    try {
      const countResult = await db.collection(collectionName).count();
      stats[collectionName] = countResult.total || 0;
    } catch (error) {
      console.warn(`获取${collectionName}统计失败:`, error);
      stats[collectionName] = 0;
    }
  }
  
  return stats;
}

/**
 * 计算系统运行时长
 */
function calculateUptime(startTime) {
  try {
    const start = new Date(startTime);
    const now = new Date();
    const diff = now - start;
    
    if (diff < 0) return null;
    
    const days = Math.floor(diff / (24 * 60 * 60 * 1000));
    const hours = Math.floor((diff % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
    const minutes = Math.floor((diff % (60 * 60 * 1000)) / (60 * 1000));
    
    if (days > 0) {
      return `${days}天${hours}小时`;
    } else if (hours > 0) {
      return `${hours}小时${minutes}分钟`;
    } else {
      return `${minutes}分钟`;
    }
  } catch (error) {
    console.error('计算运行时长失败:', error);
    return null;
  }
}

/**
 * 设置维护模式
 */
async function setMaintenanceMode(data) {
  try {
    const { enabled, message } = data;
    
    if (typeof enabled !== 'boolean') {
      return {
        code: 400,
        message: 'enabled参数必须是布尔值',
        data: null
      };
    }
    
    // 查询或创建系统配置
    let configResult;
    try {
      configResult = await db.collection('system_config')
        .limit(1)
        .get();
    } catch (error) {
      // 集合不存在，创建新配置
      configResult = { data: [] };
    }
    
    const maintenanceConfig = {
      enabled: enabled,
      message: message || '系统维护中，请稍后再试',
      updatedAt: db.serverDate()
    };
    
    if (configResult.data.length === 0) {
      // 创建新配置
      await db.collection('system_config').add({
        data: {
          ...maintenanceConfig,
          createdAt: db.serverDate()
        }
      });
    } else {
      // 更新现有配置
      await db.collection('system_config')
        .doc(configResult.data[0]._id)
        .update({
          data: maintenanceConfig
        });
    }
    
    return {
      code: 200,
      message: enabled ? '维护模式已开启' : '维护模式已关闭',
      data: maintenanceConfig
    };
  } catch (error) {
    console.error('设置维护模式失败:', error);
    return {
      code: 500,
      message: '设置失败: ' + error.message,
      data: null
    };
  }
}

/**
 * 获取维护模式状态
 */
async function getMaintenanceMode() {
  try {
    let configResult;
    try {
      configResult = await db.collection('system_config')
        .limit(1)
        .get();
    } catch (error) {
      // 集合不存在，返回默认值
      return {
        code: 200,
        message: '获取成功',
        data: {
          enabled: false,
          message: ''
        }
      };
    }
    
    if (configResult.data.length === 0) {
      return {
        code: 200,
        message: '获取成功',
        data: {
          enabled: false,
          message: ''
        }
      };
    }
    
    const config = configResult.data[0];
    return {
      code: 200,
      message: '获取成功',
      data: {
        enabled: config.enabled || false,
        message: config.message || ''
      }
    };
  } catch (error) {
    console.error('获取维护模式失败:', error);
    return {
      code: 500,
      message: '获取失败: ' + error.message,
      data: null
    };
  }
}

/**
 * 获取系统统计信息
 */
async function getSystemStats(data) {
  try {
    const { startDate, endDate } = data || {};
    
    const stats = {
      totalUsers: 0,
      totalMerchants: 0,
      totalOrders: 0,
      totalProducts: 0,
      activeMerchants: 0,
      todayOrders: 0,
      todayRevenue: 0
    };
    
    // 获取用户总数
    try {
      const userCount = await db.collection('users').count();
      stats.totalUsers = userCount.total || 0;
    } catch (error) {
      console.warn('获取用户统计失败:', error);
    }
    
    // 获取商家总数
    try {
      const merchantCount = await db.collection('merchants').count();
      stats.totalMerchants = merchantCount.total || 0;
    } catch (error) {
      console.warn('获取商家统计失败:', error);
    }
    
    // 获取订单总数
    try {
      const orderCount = await db.collection('orders').count();
      stats.totalOrders = orderCount.total || 0;
    } catch (error) {
      console.warn('获取订单统计失败:', error);
    }
    
    // 获取商品总数
    try {
      const productCount = await db.collection('products').count();
      stats.totalProducts = productCount.total || 0;
    } catch (error) {
      console.warn('获取商品统计失败:', error);
    }
    
    // 获取活跃商家数（有订单的商家）
    try {
      const activeMerchantResult = await db.collection('orders')
        .field({ merchantId: true })
        .get();
      const uniqueMerchants = new Set(activeMerchantResult.data.map(o => o.merchantId));
      stats.activeMerchants = uniqueMerchants.size;
    } catch (error) {
      console.warn('获取活跃商家统计失败:', error);
    }
    
    // 获取今日订单数
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayOrders = await db.collection('orders')
        .where({
          createdAt: _.gte(today)
        })
        .count();
      stats.todayOrders = todayOrders.total || 0;
    } catch (error) {
      console.warn('获取今日订单统计失败:', error);
    }
    
    return {
      code: 200,
      message: '获取成功',
      data: stats
    };
  } catch (error) {
    console.error('获取系统统计失败:', error);
    return {
      code: 500,
      message: '获取失败: ' + error.message,
      data: null
    };
  }
}

/**
 * 清理旧数据
 */
async function cleanupOldData(data) {
  try {
    const { collection, days = 90 } = data;
    
    if (!collection) {
      return {
        code: 400,
        message: '请指定要清理的集合名称',
        data: null
      };
    }
    
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    
    // 查询要删除的数据
    const queryResult = await db.collection(collection)
      .where({
        createdAt: _.lt(cutoffDate)
      })
      .get();
    
    const count = queryResult.data.length;
    
    if (count === 0) {
      return {
        code: 200,
        message: '没有需要清理的数据',
        data: {
          deletedCount: 0
        }
      };
    }
    
    // 批量删除（注意：云数据库批量删除有限制，可能需要分批处理）
    const batchSize = 20;
    let deletedCount = 0;
    
    for (let i = 0; i < queryResult.data.length; i += batchSize) {
      const batch = queryResult.data.slice(i, i + batchSize);
      const ids = batch.map(item => item._id);
      
      await db.collection(collection)
        .where({
          _id: _.in(ids)
        })
        .remove();
      
      deletedCount += ids.length;
    }
    
    return {
      code: 200,
      message: '清理完成',
      data: {
        deletedCount: deletedCount,
        collection: collection,
        days: days
      }
    };
  } catch (error) {
    console.error('清理旧数据失败:', error);
    return {
      code: 500,
      message: '清理失败: ' + error.message,
      data: null
    };
  }
}

/**
 * 系统健康检查
 */
async function healthCheck() {
  try {
    const checks = {
      database: false,
      storage: false,
      timestamp: new Date().toISOString()
    };
    
    // 检查数据库连接
    try {
      await db.collection('platform_config').limit(1).get();
      checks.database = true;
    } catch (error) {
      console.error('数据库健康检查失败:', error);
      checks.database = false;
      checks.databaseError = error.message;
    }
    
    // 检查云存储（通过尝试获取文件列表）
    try {
      const fileList = await cloud.getTempFileURL({
        fileList: []
      });
      checks.storage = true;
    } catch (error) {
      console.error('存储健康检查失败:', error);
      checks.storage = false;
      checks.storageError = error.message;
    }
    
    const isHealthy = checks.database && checks.storage;
    
    return {
      code: isHealthy ? 200 : 503,
      message: isHealthy ? '系统健康' : '系统异常',
      data: checks
    };
  } catch (error) {
    console.error('健康检查失败:', error);
    return {
      code: 500,
      message: '健康检查失败: ' + error.message,
      data: null
    };
  }
}

