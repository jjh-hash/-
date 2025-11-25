// 骑手管理云函数
const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();

exports.main = async (event, context) => {
  const { action, data } = event;
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;

  console.log('【骑手管理】action:', action, 'openid:', openid);

  try {
    switch (action) {
      case 'getRiderSettings':
        return await getRiderSettings(openid);
      case 'saveRiderSettings':
        return await saveRiderSettings(openid, data);
      case 'getRiderStatus':
        return await getRiderStatus(openid);
      case 'getRiderList':
        return await getRiderList(data);
      case 'auditRider':
        return await auditRider(data);
      default:
        return {
          code: 400,
          message: '未知的操作类型',
          data: null
        };
    }
  } catch (error) {
    console.error('【骑手管理】错误:', error);
    return {
      code: 500,
      message: '操作失败: ' + error.message,
      data: null
    };
  }
};

// 获取骑手审核状态
async function getRiderStatus(openid) {
  try {
    // 查询骑手信息
    let riderResult;
    try {
      riderResult = await db.collection('riders')
        .where({ openid: openid })
        .get();
    } catch (queryError) {
      // 如果集合不存在，返回未注册状态
      if (queryError.errCode === -502005 || queryError.message.includes('collection not exist') || queryError.message.includes('not exist')) {
        return {
          code: 200,
          message: '获取成功',
          data: {
            status: 'not_registered', // 未注册
            canGrabOrder: false
          }
        };
      }
      throw queryError;
    }

    if (riderResult.data && riderResult.data.length > 0) {
      const rider = riderResult.data[0];
      const status = rider.status || 'pending';
      return {
        code: 200,
        message: '获取成功',
        data: {
          status: status, // pending, approved, rejected
          canGrabOrder: status === 'approved', // 只有审核通过才能接单
          riderInfo: {
            name: rider.name || '',
            phone: rider.phone || '',
            gender: rider.gender || '',
            vehicle: rider.vehicle || ''
          }
        }
      };
    } else {
      // 未注册
      return {
        code: 200,
        message: '获取成功',
        data: {
          status: 'not_registered',
          canGrabOrder: false
        }
      };
    }
  } catch (error) {
    console.error('获取骑手状态失败:', error);
    return {
      code: 500,
      message: '获取状态失败: ' + error.message,
      data: null
    };
  }
}

// 获取骑手设置
async function getRiderSettings(openid) {
  try {
    let result;
    try {
      // 查询骑手设置
      result = await db.collection('rider_settings')
        .where({
          riderOpenid: openid
        })
        .get();
    } catch (queryError) {
      // 如果集合不存在（错误码 -502005），返回默认值
      if (queryError.errCode === -502005 || queryError.message.includes('collection not exist') || queryError.message.includes('not exist')) {
        console.log('【获取骑手设置】集合不存在，返回默认值');
        return {
          code: 200,
          message: '获取成功',
          data: {
            autoRefresh: true,
            maxOrders: 6
          }
        };
      }
      throw queryError;
    }

    if (result.data && result.data.length > 0) {
      const settings = result.data[0];
      return {
        code: 200,
        message: '获取成功',
        data: {
          autoRefresh: settings.autoRefresh !== undefined ? settings.autoRefresh : true,
          maxOrders: settings.maxOrders || 6
        }
      };
    } else {
      // 如果没有设置，返回默认值
      return {
        code: 200,
        message: '获取成功',
        data: {
          autoRefresh: true,
          maxOrders: 6
        }
      };
    }
  } catch (error) {
    console.error('获取骑手设置失败:', error);
    return {
      code: 500,
      message: '获取设置失败: ' + error.message,
      data: null
    };
  }
}

// 保存骑手设置
async function saveRiderSettings(openid, data) {
  const { autoRefresh, maxOrders } = data;

  try {
    let existingResult = null;
    
    // 尝试查询是否已存在设置
    try {
      existingResult = await db.collection('rider_settings')
        .where({
          riderOpenid: openid
        })
        .get();
    } catch (queryError) {
      // 如果集合不存在（错误码 -502005），直接创建新设置
      if (queryError.errCode === -502005 || queryError.message.includes('collection not exist') || queryError.message.includes('not exist')) {
        console.log('【保存骑手设置】集合不存在，创建新设置');
        existingResult = { data: [] }; // 设置为空数组，走创建流程
      } else {
        throw queryError;
      }
    }

    const settingsData = {
      riderOpenid: openid,
      autoRefresh: autoRefresh !== undefined ? autoRefresh : true,
      maxOrders: maxOrders || 6,
      updatedAt: db.serverDate()
    };

    if (existingResult && existingResult.data && existingResult.data.length > 0) {
      // 更新现有设置
      const settingId = existingResult.data[0]._id;
      await db.collection('rider_settings').doc(settingId).update({
        data: settingsData
      });
      console.log('【保存骑手设置】更新成功，设置ID:', settingId);
    } else {
      // 创建新设置（如果集合不存在，add 方法会自动创建集合）
      settingsData.createdAt = db.serverDate();
      const result = await db.collection('rider_settings').add({
        data: settingsData
      });
      console.log('【保存骑手设置】创建成功，设置ID:', result._id);
    }

    return {
      code: 200,
      message: '设置保存成功',
      data: {
        success: true
      }
    };
  } catch (error) {
    console.error('保存骑手设置失败:', error);
    return {
      code: 500,
      message: '保存设置失败: ' + error.message,
      data: null
    };
  }
}

// 获取骑手列表（管理员功能）
async function getRiderList(data) {
  try {
    const { page = 1, pageSize = 20, status = '', keyword = '' } = data;
    
    console.log('【获取骑手列表】参数:', { page, pageSize, status, keyword });
    
    // 构建查询条件
    let whereCondition = {};
    
    // 状态筛选
    if (status) {
      whereCondition.status = status;
    }
    
    // 查询骑手列表
    let ridersResult;
    try {
      let query = db.collection('riders');
      
      // 状态筛选
      if (status) {
        query = query.where({ status: status });
      }
      
      // 关键词搜索（先查询所有，然后在内存中过滤）
      ridersResult = await query
        .orderBy('createdAt', 'desc')
        .get();
      
      let riders = ridersResult.data || [];
      
      // 关键词过滤（在内存中过滤）
      if (keyword) {
        const keywordLower = keyword.toLowerCase();
        riders = riders.filter(rider => {
          const name = (rider.name || '').toLowerCase();
          const phone = (rider.phone || '').toLowerCase();
          return name.includes(keywordLower) || phone.includes(keywordLower);
        });
      }
      
      // 分页处理
      const total = riders.length;
      const startIndex = (page - 1) * pageSize;
      const endIndex = startIndex + pageSize;
      riders = riders.slice(startIndex, endIndex);
      
      // 格式化日期为中国时间（UTC+8）
      const formatDate = (date) => {
        if (!date) return '';
        try {
          let d;
          
          // 处理云数据库的Date对象（有getTime方法）
          if (date && typeof date === 'object' && date.getTime && typeof date.getTime === 'function') {
            d = new Date(date.getTime());
          } else if (date && typeof date === 'object' && date.getFullYear) {
            d = date;
          } else if (typeof date === 'string') {
            // 处理字符串格式的日期
            let dateStr = date;
            // 兼容ISO格式和空格格式
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
          
          // 云函数运行在UTC时区，需要手动转换为中国时区（UTC+8）
          const chinaTimeOffset = 8 * 60 * 60 * 1000; // 8小时的毫秒数
          const chinaTime = new Date(d.getTime() + chinaTimeOffset);
          
          // 使用UTC方法获取时间组件（因为我们已经手动加上了时区偏移）
          const year = chinaTime.getUTCFullYear();
          const month = String(chinaTime.getUTCMonth() + 1).padStart(2, '0');
          const day = String(chinaTime.getUTCDate()).padStart(2, '0');
          const hour = String(chinaTime.getUTCHours()).padStart(2, '0');
          const minute = String(chinaTime.getUTCMinutes()).padStart(2, '0');
          return `${year}-${month}-${day} ${hour}:${minute}`;
        } catch (e) {
          return '';
        }
      };
      
      // 格式化骑手数据
      const formattedRiders = (riders || []).map(rider => {
        const formatted = {
          _id: rider._id,
          openid: rider.openid || '',
          name: rider.name || '',
          phone: rider.phone || '',
          gender: rider.gender || '', // 确保性别值正确传递
          vehicle: rider.vehicle || '',
          status: rider.status || 'pending',
          createdAt: formatDate(rider.createdAt),
          updatedAt: formatDate(rider.updatedAt)
        };
        
        // 记录性别值用于调试
        if (rider.name) {
          console.log('【获取骑手列表】骑手性别:', { 
            name: rider.name, 
            gender: rider.gender, 
            formattedGender: formatted.gender 
          });
        }
        
        return formatted;
      });
      
      return {
        code: 200,
        message: '获取成功',
        data: {
          riders: formattedRiders,
          total: total,
          page: page,
          pageSize: pageSize
        }
      };
    } catch (queryError) {
      // 如果 riders 集合不存在，返回空列表
      if (queryError.errCode === -502005 || queryError.message.includes('collection not exist') || queryError.message.includes('not exist')) {
        console.log('【获取骑手列表】集合不存在，返回空列表');
        return {
          code: 200,
          message: '获取成功',
          data: {
            riders: [],
            total: 0,
            page: page,
            pageSize: pageSize
          }
        };
      }
      throw queryError;
    }
  } catch (error) {
    console.error('【获取骑手列表】失败:', error);
    return {
      code: 500,
      message: '获取骑手列表失败: ' + error.message,
      data: null
    };
  }
}

// 审核骑手（管理员功能）
async function auditRider(data) {
  try {
    const { riderId, status } = data;
    
    if (!riderId) {
      return {
        code: 400,
        message: '缺少骑手ID'
      };
    }
    
    if (!status || !['approved', 'rejected'].includes(status)) {
      return {
        code: 400,
        message: '无效的审核状态'
      };
    }
    
    console.log('【审核骑手】骑手ID:', riderId, '状态:', status);
    
    // 先查询骑手信息
    let riderDoc;
    try {
      const riderResult = await db.collection('riders').doc(riderId).get();
      if (!riderResult.data) {
        return {
          code: 404,
          message: '骑手记录不存在'
        };
      }
      riderDoc = riderResult.data;
    } catch (queryError) {
      if (queryError.errCode === -502005 || queryError.message.includes('collection not exist') || queryError.message.includes('not exist')) {
        return {
          code: 404,
          message: '骑手记录不存在'
        };
      }
      throw queryError;
    }
    
    // 准备更新数据
    const updateData = {
      status: status,
      updatedAt: db.serverDate()
    };
    
    // 如果审核通过，记录审核通过时间
    if (status === 'approved') {
      updateData.approvedAt = db.serverDate();
      console.log('【审核骑手】审核通过，记录审核时间');
    }
    
    // 如果审核拒绝，记录审核拒绝时间（允许重新提交）
    if (status === 'rejected') {
      updateData.rejectedAt = db.serverDate();
      console.log('【审核骑手】审核拒绝，记录拒绝时间（可重新提交）');
    }
    
    // 更新骑手状态
    try {
      await db.collection('riders').doc(riderId).update({
        data: updateData
      });
      
      console.log('【审核骑手】更新成功，状态:', status);
      
      return {
        code: 200,
        message: status === 'approved' ? '审核通过，骑手可以接单' : '审核拒绝，骑手可以重新提交申请',
        data: {
          success: true,
          status: status
        }
      };
    } catch (updateError) {
      // 如果 riders 集合不存在
      if (updateError.errCode === -502005 || updateError.message.includes('collection not exist') || updateError.message.includes('not exist')) {
        return {
          code: 404,
          message: '骑手记录不存在'
        };
      }
      throw updateError;
    }
  } catch (error) {
    console.error('【审核骑手】失败:', error);
    return {
      code: 500,
      message: '审核失败: ' + error.message,
      data: null
    };
  }
}

