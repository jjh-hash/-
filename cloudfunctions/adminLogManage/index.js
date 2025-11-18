// 管理员操作日志管理云函数
const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();

exports.main = async (event, context) => {
  console.log('管理员操作日志管理请求:', event);
  
  const { action, data } = event;
  
  try {
    switch (action) {
      case 'getList':
        return await getLogList(data);
      case 'getRecent':
        return await getRecentLogs(data);
      case 'create':
        return await createLog(data);
      case 'getStats':
        return await getLogStats(data);
      case 'cleanup':
        return await cleanupOldLogsAction();
      default:
        return {
          code: 400,
          message: '未知操作',
          data: null
        };
    }
  } catch (error) {
    console.error('管理员操作日志管理错误:', error);
    return {
      code: 500,
      message: '系统异常: ' + error.message,
      data: null
    };
  }
};

/**
 * 获取最近操作日志
 */
async function getRecentLogs(data) {
  const { limit = 10 } = data;
  
  try {
    // 先清理旧日志
    await cleanupOldLogs();
    
    const result = await db.collection('admin_logs')
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .get();
    
    console.log('获取最近操作日志:', result.data.length);
    
    // 格式化日志数据
    const logs = result.data.map(log => ({
      id: log._id,
      action: log.action,
      target: log.target,
      time: formatTime(log.createdAt),
      result: log.result
    }));
    
    return {
      code: 200,
      message: '获取成功',
      data: {
        logs: logs
      }
    };
  } catch (error) {
    console.error('获取最近操作日志失败:', error);
    return {
      code: 500,
      message: '获取失败: ' + error.message,
      data: {
        logs: []
      }
    };
  }
}

/**
 * 格式化时间
 */
function formatTime(date) {
  if (!date) return '';
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hour = String(d.getHours()).padStart(2, '0');
  const minute = String(d.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day} ${hour}:${minute}`;
}

/**
 * 获取日志列表
 */
async function getLogList(data) {
  const { page = 1, pageSize = 20, action, startDate, endDate } = data;
  
  // 先清理旧日志
  await cleanupOldLogs();
  
  let whereCondition = {};
  
  if (action) {
    whereCondition.action = action;
  }
  
  if (startDate && endDate) {
    whereCondition.createdAt = db.command.gte(new Date(startDate)).and(db.command.lte(new Date(endDate)));
  }
  
  const result = await db.collection('admin_logs')
    .where(whereCondition)
    .orderBy('createdAt', 'desc')
    .skip((page - 1) * pageSize)
    .limit(pageSize)
    .get();
  
  // 获取总数
  const countResult = await db.collection('admin_logs')
    .where(whereCondition)
    .count();
  
  // 格式化日志数据
  const logs = result.data.map(log => ({
    _id: log._id,
    action: log.action,
    target: log.target || '',
    targetType: log.targetType || 'system',
    result: log.result,
    details: log.details || {},
    createdAt: log.createdAt
  }));
  
  return {
    code: 200,
    message: '获取成功',
    data: {
      list: logs,
      total: countResult.total,
      page: page,
      pageSize: pageSize
    }
  };
}

/**
 * 创建日志
 */
async function createLog(data) {
  const { adminId, action, target, targetType, result, details } = data;
  
  if (!adminId || !action) {
    return {
      code: 400,
      message: '管理员ID和操作类型为必填项',
      data: null
    };
  }

  const logData = {
    adminId: adminId,
    action: action,
    target: target || '',
    targetType: targetType || 'system',
    result: result || 'success',
    details: details || {},
    createdAt: db.serverDate(),
    updatedAt: db.serverDate()
  };

  const result_data = await db.collection('admin_logs').add({
    data: logData
  });

  console.log('操作日志创建成功:', result_data._id);

  // 检查日志总数，如果超过30条，删除最旧的日志
  await cleanupOldLogs();

  return {
    code: 200,
    message: '创建成功',
    data: {
      _id: result_data._id
    }
  };
}

/**
 * 清理旧日志，只保留最新30条（内部函数）
 */
async function cleanupOldLogs() {
  try {
    const countResult = await db.collection('admin_logs').count();
    const total = countResult.total;
    
    if (total > 30) {
      // 获取最旧的日志（按创建时间升序，取前 total - 30 条）
      const deleteCount = total - 30;
      const oldLogs = await db.collection('admin_logs')
        .orderBy('createdAt', 'asc')
        .limit(deleteCount)
        .get();
      
      // 批量删除旧日志
      if (oldLogs.data.length > 0) {
        const deletePromises = oldLogs.data.map(log => 
          db.collection('admin_logs').doc(log._id).remove()
        );
        await Promise.all(deletePromises);
        console.log(`已删除 ${oldLogs.data.length} 条旧日志，保留最新30条`);
        return {
          deleted: oldLogs.data.length,
          remaining: 30
        };
      }
    }
    return {
      deleted: 0,
      remaining: total
    };
  } catch (error) {
    console.error('清理旧日志失败:', error);
    throw error;
  }
}

/**
 * 清理旧日志（对外接口）
 */
async function cleanupOldLogsAction() {
  try {
    const result = await cleanupOldLogs();
    return {
      code: 200,
      message: '清理成功',
      data: result
    };
  } catch (error) {
    return {
      code: 500,
      message: '清理失败: ' + error.message,
      data: null
    };
  }
}

/**
 * 获取日志统计
 */
async function getLogStats(data) {
  const { startDate, endDate } = data;
  
  let whereCondition = {};
  
  if (startDate && endDate) {
    whereCondition.createdAt = db.command.gte(new Date(startDate)).and(db.command.lte(new Date(endDate)));
  }
  
  // 统计操作类型
  const actionsResult = await db.collection('admin_logs')
    .where(whereCondition)
    .field({
      action: true
    })
    .get();
  
  const actionStats = {};
  actionsResult.data.forEach(log => {
    actionStats[log.action] = (actionStats[log.action] || 0) + 1;
  });
  
  // 统计操作结果
  const resultsResult = await db.collection('admin_logs')
    .where(whereCondition)
    .field({
      result: true
    })
    .get();
  
  const resultStats = {};
  resultsResult.data.forEach(log => {
    resultStats[log.result] = (resultStats[log.result] || 0) + 1;
  });
  
  // 获取总数
  const countResult = await db.collection('admin_logs')
    .where(whereCondition)
    .count();
  
  return {
    code: 200,
    message: '获取成功',
    data: {
      total: countResult.total,
      actionStats: actionStats,
      resultStats: resultStats
    }
  };
}

