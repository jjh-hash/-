// 用户管理云函数（管理端）
const cloud = require('wx-server-sdk');

// 兼容性辅助函数：padStart的替代方案
function padStart(str, targetLength, padString) {
  str = String(str);
  padString = padString || ' ';
  if (str.length >= targetLength) {
    return str;
  }
  const padLength = targetLength - str.length;
  let padding = '';
  for (let i = 0; i < padLength; i++) {
    padding += padString;
  }
  return padding + str;
}

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const { extractAdminSessionToken, verifyAdminSession, deny } = require('./adminSession');

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext();
  const { action, data } = event;
  
  console.log('【用户管理】请求:', { action, data });
  
  try {
    const v = await verifyAdminSession(db, extractAdminSessionToken(event));
    if (!v.ok) {
      return deny(v);
    }
    // 根据action执行不同操作
    switch (action) {
      case 'getList':
        return await getUserList(OPENID, data);
      case 'getDetail':
        return await getUserDetail(OPENID, data);
      case 'banUser':
        return await banUser(OPENID, data);
      case 'unbanUser':
        return await unbanUser(OPENID, data);
      default:
        return {
          code: 400,
          message: '无效的操作类型'
        };
    }
  } catch (error) {
    console.error('【用户管理】失败:', error);
    return {
      code: 500,
      message: '系统异常',
      error: error.message
    };
  }
};

/**
 * 获取用户列表
 */
async function getUserList(openid, data) {
  const { page = 1, pageSize = 20, status, keyword, campus } = data || {};
  
  console.log('【获取用户列表】参数:', { page, pageSize, status, keyword, campus });
  
  // 构建查询条件
  const whereCondition = {};
  const andConditions = [];
  
  // 状态筛选
  if (status) {
    whereCondition.status = status;
  }
  
  // 校区筛选
  if (campus) {
    if (campus === 'unset') {
      // 筛选未设置校区的用户（campus为空字符串、null或不存在）
      andConditions.push({
        $or: [
          { campus: '' },
          { campus: db.command.eq(null) },
          { campus: db.command.exists(false) }
        ]
      });
    } else {
      whereCondition.campus = campus;
    }
  }
  
  // 关键词搜索
  if (keyword) {
    andConditions.push({
      $or: [
        { nickname: db.RegExp({ regexp: keyword, options: 'i' }) },
        { phone: db.RegExp({ regexp: keyword, options: 'i' }) },
        { email: db.RegExp({ regexp: keyword, options: 'i' }) }
      ]
    });
  }
  
  // 组合所有条件
  if (andConditions.length > 0) {
    // 如果有其他条件，需要合并
    if (Object.keys(whereCondition).length > 0) {
      // 将其他条件也加入 $and
      const baseCondition = Object.assign({}, whereCondition);
      whereCondition.$and = [baseCondition].concat(andConditions);
      // 清除基础条件，因为它们已经在 $and 中
      Object.keys(baseCondition).forEach(key => {
        delete whereCondition[key];
      });
    } else {
      // 如果只有 $or 条件，直接使用第一个，如果有多个则用 $and
      if (andConditions.length === 1) {
        Object.assign(whereCondition, andConditions[0]);
      } else {
        whereCondition.$and = andConditions;
      }
    }
  }
  
  console.log('【获取用户列表】查询条件:', whereCondition);
  
  // 查询用户列表
  const result = await db.collection('users')
    .where(whereCondition)
    .orderBy('createdAt', 'desc')
    .skip((page - 1) * pageSize)
    .limit(pageSize)
    .get();
  
  // 获取总数
  const countResult = await db.collection('users')
    .where(whereCondition)
    .count();
  
  console.log('【获取用户列表】查询结果:', result.data.length, '条');
  
  // 格式化用户数据
  const userList = result.data.map(user => ({
    _id: user._id,
    openid: user.openid,
    nickname: user.nickname || '未设置昵称',
    avatar: user.avatar || '',
    phone: user.phone || '未绑定',
    email: user.email || '未绑定',
    campus: user.campus || '未设置',
    role: user.role || 'user',
    status: user.status || 'active',
    createdAt: formatDate(user.createdAt),
    updatedAt: formatDate(user.updatedAt),
    lastLoginAt: formatDate(user.lastLoginAt)
  }));
  
  return {
    code: 200,
    message: 'ok',
    data: {
      list: userList,
      total: countResult.total,
      page: page,
      pageSize: pageSize
    }
  };
}

/**
 * 获取用户详情
 */
async function getUserDetail(openid, data) {
  const { userId, openid: queryOpenid } = data;
  
  console.log('【获取用户详情】用户ID:', userId, 'openid:', queryOpenid);
  
  let user = null;
  
  // 如果提供了 openid，优先通过 openid 查询
  if (queryOpenid) {
    console.log('【获取用户详情】通过 openid 查询:', queryOpenid);
    const userQuery = await db.collection('users')
      .where({ openid: queryOpenid })
      .get();
    
    if (userQuery.data && userQuery.data.length > 0) {
      user = { data: userQuery.data[0] };
    }
  }
  
  // 如果没有通过 openid 找到，且提供了 userId，尝试通过 _id 查询
  if (!user && userId) {
    console.log('【获取用户详情】通过 userId 查询:', userId);
    try {
      user = await db.collection('users').doc(userId).get();
    } catch (error) {
      // 如果 userId 不是有效的文档 ID，尝试作为 openid 查询
      console.log('【获取用户详情】userId 不是有效文档ID，尝试作为 openid 查询');
      const userQuery = await db.collection('users')
        .where({ openid: userId })
        .get();
      
      if (userQuery.data && userQuery.data.length > 0) {
        user = { data: userQuery.data[0] };
      }
    }
  }
  
  if (!user || !user.data) {
    return {
      code: 404,
      message: '用户不存在'
    };
  }
  
  const userIdForStats = user.data._id;
  const userOpenid = user.data.openid;
  
  // 获取用户订单统计
  const orderStats = await db.collection('orders')
    .where({ userId: userIdForStats })
    .count();
  
  // 查询骑手信息
  let riderInfo = {
    isRider: false
  };
  
  try {
    // 尝试查询 riders 集合
    const riderQuery = await db.collection('riders')
      .where({ openid: userOpenid })
      .get();
    
    if (riderQuery.data && riderQuery.data.length > 0) {
      const rider = riderQuery.data[0];
      riderInfo = {
        isRider: true,
        name: rider.name || '',
        phone: rider.phone || '',
        gender: rider.gender || '',
        vehicle: rider.vehicle || '',
        status: rider.status || 'pending',
        createdAt: formatDate(rider.createdAt),
        updatedAt: formatDate(rider.updatedAt)
      };
      console.log('【获取用户详情】从 riders 集合获取骑手信息:', riderInfo);
    } else {
      // 如果没有找到 riders 记录，尝试通过订单判断是否注册了骑手
      console.log('【获取用户详情】未找到 riders 记录，尝试通过订单判断');
      try {
        const riderOrderCheck = await db.collection('orders')
          .where({ riderOpenid: userOpenid })
          .limit(1)
          .get();
        
        if (riderOrderCheck.data && riderOrderCheck.data.length > 0) {
          // 用户有作为骑手的订单，说明注册了骑手，但信息可能不完整
          riderInfo = {
            isRider: true,
            name: '已注册（信息不完整）',
            phone: '',
            idNumber: '',
            vehicle: '',
            serviceArea: '',
            status: 'unknown',
            createdAt: '',
            updatedAt: ''
          };
          console.log('【获取用户详情】通过订单判断：用户已注册骑手');
        } else {
          riderInfo = {
            isRider: false
          };
          console.log('【获取用户详情】用户未注册骑手');
        }
      } catch (orderError) {
        console.error('【获取用户详情】通过订单判断骑手信息失败:', orderError);
        riderInfo = {
          isRider: false
        };
      }
    }
  } catch (error) {
    // 如果 riders 集合不存在，尝试通过订单判断
    console.log('【获取用户详情】查询 riders 集合失败，尝试通过订单判断:', error.message);
    try {
      const riderOrderCheck = await db.collection('orders')
        .where({ riderOpenid: userOpenid })
        .limit(1)
        .get();
      
      if (riderOrderCheck.data && riderOrderCheck.data.length > 0) {
        riderInfo = {
          isRider: true,
          name: '已注册（信息不完整）',
          phone: '',
          gender: '',
          vehicle: '',
          status: 'unknown',
          createdAt: '',
          updatedAt: ''
        };
        console.log('【获取用户详情】通过订单判断：用户已注册骑手');
      } else {
        riderInfo = {
          isRider: false
        };
        console.log('【获取用户详情】用户未注册骑手');
      }
    } catch (orderError) {
      console.error('【获取用户详情】通过订单判断骑手信息失败:', orderError);
      riderInfo = {
        isRider: false
      };
    }
  }
  
  return {
    code: 200,
    message: 'ok',
    data: {
      user: {
        _id: user.data._id,
        openid: user.data.openid,
        nickname: user.data.nickname || '未设置昵称',
        avatar: user.data.avatar || '',
        phone: user.data.phone || '未绑定',
        campus: user.data.campus || '未设置',
        college: user.data.college || '未设置',
        major: user.data.major || '未设置',
        role: user.data.role || 'user',
        status: user.data.status || 'active',
        banReason: user.data.banReason || '',
        bannedAt: formatDate(user.data.bannedAt),
        createdAt: formatDate(user.data.createdAt),
        updatedAt: formatDate(user.data.updatedAt),
        lastLoginAt: formatDate(user.data.lastLoginAt)
      },
      orderCount: orderStats.total,
      riderInfo: riderInfo
    }
  };
}

/**
 * 封禁用户
 */
async function banUser(openid, data) {
  const { userId, reason } = data;
  
  console.log('【封禁用户】用户ID:', userId, '原因:', reason);
  
  if (!userId) {
    return {
      code: 400,
      message: '缺少用户ID'
    };
  }
  
  // 查询用户信息
  const user = await db.collection('users').doc(userId).get();
  
  if (!user.data) {
    return {
      code: 404,
      message: '用户不存在'
    };
  }
  
  // 更新用户状态
  await db.collection('users').doc(userId).update({
    data: {
      status: 'banned',
      banReason: reason || '违规操作',
      bannedAt: db.serverDate(),
      updatedAt: db.serverDate()
    }
  });
  
  return {
    code: 200,
    message: '封禁成功'
  };
}

/**
 * 解封用户
 */
async function unbanUser(openid, data) {
  const { userId } = data;
  
  console.log('【解封用户】用户ID:', userId);
  
  if (!userId) {
    return {
      code: 400,
      message: '缺少用户ID'
    };
  }
  
  // 查询用户信息
  const user = await db.collection('users').doc(userId).get();
  
  if (!user.data) {
    return {
      code: 404,
      message: '用户不存在'
    };
  }
  
  // 更新用户状态
  await db.collection('users').doc(userId).update({
    data: {
      status: 'active',
      banReason: '',
      bannedAt: null,
      updatedAt: db.serverDate()
    }
  });
  
  return {
    code: 200,
    message: '解封成功'
  };
}

/**
 * 格式化日期 - 转换为中国时区（UTC+8）
 */
function formatDate(date) {
  if (!date) return '';
  
  let d;
  
  // 处理云数据库的Date对象（有getTime方法）
  if (date.getTime && typeof date.getTime === 'function') {
    d = new Date(date.getTime());
  } else if (date instanceof Date) {
    d = date;
  } else if (typeof date === 'string') {
    // 处理字符串格式的日期
    let dateString = date;
    // 兼容ISO格式和空格格式
    if (dateString.includes(' ') && !dateString.includes('T')) {
      // 检查是否有时区信息（Z结尾或包含时区偏移如+08:00）
      const hasTimezone = dateString.endsWith('Z') || 
                         /[+-]\d{2}:?\d{2}$/.test(dateString) ||
                         dateString.match(/[+-]\d{4}$/);
      
      if (!hasTimezone) {
        // 如果没有时区信息，假设是UTC时间（云数据库通常返回UTC时间），添加Z后缀
        dateString = dateString.replace(' ', 'T') + 'Z';
      } else {
        dateString = dateString.replace(' ', 'T');
      }
    }
    d = new Date(dateString);
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
  
  // 验证日期是否有效
  if (isNaN(d.getTime())) {
    console.warn('【格式化日期】无效的日期:', date);
    return '';
  }
  
  // 云函数运行在UTC时区，需要手动转换为中国时区（UTC+8）
  // 获取UTC时间戳，然后加上8小时（8 * 60 * 60 * 1000 毫秒）
  const chinaTimeOffset = 8 * 60 * 60 * 1000; // 8小时的毫秒数
  const chinaTime = new Date(d.getTime() + chinaTimeOffset);
  
  // 使用UTC方法获取时间组件（因为我们已经手动加上了时区偏移）
  const year = chinaTime.getUTCFullYear();
  const month = padStart(chinaTime.getUTCMonth() + 1, 2, '0');
  const day = padStart(chinaTime.getUTCDate(), 2, '0');
  const hours = padStart(chinaTime.getUTCHours(), 2, '0');
  const minutes = padStart(chinaTime.getUTCMinutes(), 2, '0');
  
  return `${year}-${month}-${day} ${hours}:${minutes}`;
}
