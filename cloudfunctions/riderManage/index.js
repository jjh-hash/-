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
      
      // 格式化日期
      const formatDate = (date) => {
        if (!date) return '';
        try {
          const d = new Date(date);
          const year = d.getFullYear();
          const month = String(d.getMonth() + 1).padStart(2, '0');
          const day = String(d.getDate()).padStart(2, '0');
          const hour = String(d.getHours()).padStart(2, '0');
          const minute = String(d.getMinutes()).padStart(2, '0');
          return `${year}-${month}-${day} ${hour}:${minute}`;
        } catch (e) {
          return '';
        }
      };
      
      // 格式化骑手数据
      const formattedRiders = (riders || []).map(rider => ({
        _id: rider._id,
        openid: rider.openid || '',
        name: rider.name || '',
        phone: rider.phone || '',
        gender: rider.gender || '',
        vehicle: rider.vehicle || '',
        status: rider.status || 'pending',
        createdAt: formatDate(rider.createdAt),
        updatedAt: formatDate(rider.updatedAt)
      }));
      
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
    
    // 更新骑手状态
    try {
      await db.collection('riders').doc(riderId).update({
        data: {
          status: status,
          updatedAt: db.serverDate()
        }
      });
      
      console.log('【审核骑手】更新成功');
      
      return {
        code: 200,
        message: '审核成功',
        data: {
          success: true
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

