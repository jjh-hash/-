// 邀请码管理云函数
const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();

exports.main = async (event, context) => {
  console.log('邀请码管理请求:', event);
  
  const { action, data } = event;
  
  try {
    switch (action) {
      case 'create':
        return await createInviteCode(data);
      case 'getList':
        return await getInviteCodeList(data);
      case 'validate':
        return await validateInviteCode(data);
      case 'updateStatus':
        return await updateInviteCodeStatus(data);
      case 'delete':
        return await deleteInviteCode(data);
      default:
        return {
          code: 400,
          message: '未知操作',
          data: null
        };
    }
  } catch (error) {
    console.error('邀请码管理错误:', error);
    console.error('错误堆栈:', error.stack);
    return {
      code: 500,
      message: '系统异常: ' + error.message,
      data: {
        error: error.message,
        stack: error.stack
      }
    };
  }
};

/**
 * 创建邀请码
 */
async function createInviteCode(data) {
  const { code, maxUses = 1, description = '', expiredDays = 30 } = data;
  
  // 检查邀请码是否已存在
  const existResult = await db.collection('invite_codes')
    .where({ code: code })
    .get();
  
  if (existResult.data.length > 0) {
    return {
      code: 400,
      message: '邀请码已存在',
      data: null
    };
  }
  
  // 计算过期时间
  const expiredAt = new Date();
  expiredAt.setDate(expiredAt.getDate() + expiredDays);
  
  // 创建邀请码
  const result = await db.collection('invite_codes').add({
    data: {
      code: code,
      maxUses: maxUses,
      usedCount: 0,
      status: 'active',
      description: description,
      expiredAt: expiredAt,
      lastUsedAt: null,
      createdAt: db.serverDate(),
      updatedAt: db.serverDate()
    }
  });
  
  console.log('邀请码创建成功:', result._id);
  
  return {
    code: 200,
    message: '创建成功',
    data: {
      _id: result._id,
      code: code
    }
  };
}

/**
 * 获取邀请码列表
 */
async function getInviteCodeList(data) {
  const { page = 1, pageSize = 20, status } = data;
  
  let whereCondition = {};
  if (status) {
    whereCondition.status = status;
  }
  
  const result = await db.collection('invite_codes')
    .where(whereCondition)
    .orderBy('createdAt', 'desc')
    .skip((page - 1) * pageSize)
    .limit(pageSize)
    .get();
  
  const countResult = await db.collection('invite_codes')
    .where(whereCondition)
    .count();
  
  return {
    code: 200,
    message: '获取成功',
    data: {
      list: result.data,
      total: countResult.total,
      page: page,
      pageSize: pageSize
    }
  };
}

/**
 * 验证邀请码
 */
async function validateInviteCode(data) {
  const { code } = data;
  
  // 查询邀请码
  const result = await db.collection('invite_codes')
    .where({ code: code })
    .get();
  
  if (result.data.length === 0) {
    return {
      code: 404,
      message: '邀请码不存在',
      data: null
    };
  }
  
  const inviteCode = result.data[0];
  
  // 检查状态
  if (inviteCode.status !== 'active') {
    return {
      code: 400,
      message: '邀请码已失效',
      data: null
    };
  }
  
  // 检查过期时间
  if (inviteCode.expiredAt && new Date() > inviteCode.expiredAt) {
    return {
      code: 400,
      message: '邀请码已过期',
      data: null
    };
  }
  
  // 检查使用次数
  if (inviteCode.usedCount >= inviteCode.maxUses) {
    return {
      code: 400,
      message: '邀请码使用次数已达上限',
      data: null
    };
  }
  
  return {
    code: 200,
    message: '验证成功',
    data: {
      valid: true,
      inviteCodeId: inviteCode._id,
      inviteCode: inviteCode
    }
  };
}

/**
 * 更新邀请码状态
 */
async function updateInviteCodeStatus(data) {
  const { codeId, status } = data;
  
  await db.collection('invite_codes').doc(codeId).update({
    data: {
      status: status,
      updatedAt: db.serverDate()
    }
  });
  
  return {
    code: 200,
    message: '更新成功',
    data: null
  };
}

/**
 * 删除邀请码
 */
async function deleteInviteCode(data) {
  const { codeId } = data;
  
  if (!codeId) {
    return {
      code: 400,
      message: '缺少邀请码ID',
      data: null
    };
  }
  
  // 检查邀请码是否存在
  const inviteCode = await db.collection('invite_codes').doc(codeId).get();
  
  if (!inviteCode.data) {
    return {
      code: 404,
      message: '邀请码不存在',
      data: null
    };
  }
  
  // 删除邀请码
  await db.collection('invite_codes').doc(codeId).remove();
  
  console.log('邀请码删除成功:', codeId);
  
  return {
    code: 200,
    message: '删除成功',
    data: null
  };
}

