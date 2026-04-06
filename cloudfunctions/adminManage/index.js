// 管理员管理云函数
const cloud = require('wx-server-sdk');
const crypto = require('crypto');
const {
  extractAdminSessionToken,
  verifyAdminSession,
  deny,
  newSessionToken,
  SESSION_TTL_MS,
  COLLECTION
} = require('./adminSession');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();

exports.main = async (event, context) => {
  console.log('管理员管理请求:', event);
  
  const { action, data } = event;
  
  try {
    switch (action) {
      case 'changePassword':
        return await changePassword(event);
      case 'getAdminInfo':
        return await getAdminInfo(event);
      case 'adminLogin':
        return await adminLogin(data);
      case 'adminLogout':
        return await adminLogout(event);
      case 'verifyAdminSession':
        return await verifyAdminSessionAction(event);
      default:
        return {
          code: 400,
          message: '未知操作',
          data: null
        };
    }
  } catch (error) {
    console.error('管理员管理错误:', error);
    return {
      code: 500,
      message: '系统异常: ' + error.message,
      data: null
    };
  }
};

/**
 * 修改管理员密码（须携带有效 adminSessionToken）
 */
async function changePassword(event) {
  const data = event.data || {};
  const { oldPassword, newPassword, username } = data;

  const sessCheck = await verifyAdminSession(db, extractAdminSessionToken(event));
  if (!sessCheck.ok) {
    return deny(sessCheck);
  }
  const admin = sessCheck.admin;
  if (username && username !== admin.username) {
    return { code: 403, message: '会话与账号不匹配', data: null };
  }
  
  // 参数验证
  if (!oldPassword || !newPassword) {
    return {
      code: 400,
      message: '参数不完整',
      data: null
    };
  }
  
  if (newPassword.length > 10) {
    return {
      code: 400,
      message: '新密码长度不能超过10位',
      data: null
    };
  }
  
  if (newPassword.length === 0) {
    return {
      code: 400,
      message: '新密码不能为空',
      data: null
    };
  }
  
  try {
    const adminDoc = await db.collection('admin_accounts').doc(admin._id).get();
    if (!adminDoc.data) {
      return { code: 404, message: '管理员不存在', data: null };
    }
    const adminRow = adminDoc.data;

    console.log('修改密码，管理员账号，ID:', adminRow._id, '用户名:', adminRow.username);
    
    // 验证旧密码
    const oldPasswordHash = crypto.createHash('sha256')
      .update(oldPassword)
      .digest('hex');
    
    console.log('验证旧密码，输入密码哈希:', oldPasswordHash);
    console.log('数据库中密码哈希:', adminRow.password);
    
    if (adminRow.password !== oldPasswordHash) {
      console.error('旧密码验证失败');
      return {
        code: 401,
        message: '旧密码错误',
        data: null
      };
    }
    
    console.log('旧密码验证成功');
    
    // 检查新密码是否与旧密码相同
    if (oldPasswordHash === crypto.createHash('sha256').update(newPassword).digest('hex')) {
      return {
        code: 400,
        message: '新密码不能与旧密码相同',
        data: null
      };
    }
    
    // 加密新密码
    const newPasswordHash = crypto.createHash('sha256')
      .update(newPassword)
      .digest('hex');
    
    console.log('准备更新密码，管理员ID:', adminRow._id, '用户名:', adminRow.username);
    console.log('旧密码哈希:', adminRow.password);
    console.log('新密码哈希:', newPasswordHash);
    
    // 更新密码
    const updateResult = await db.collection('admin_accounts').doc(adminRow._id).update({
      data: {
        password: newPasswordHash,
        updatedAt: db.serverDate()
      }
    });
    
    console.log('数据库更新结果:', updateResult);
    
    // 验证更新是否成功
    if (updateResult.stats && updateResult.stats.updated === 0) {
      console.error('密码更新失败：数据库更新返回0条记录');
      return {
        code: 500,
        message: '密码更新失败，请重试',
        data: null
      };
    }
    
    // 再次查询验证密码是否真的更新了
    const verifyQuery = await db.collection('admin_accounts').doc(adminRow._id).get();
    if (verifyQuery.data) {
      const updatedPasswordHash = verifyQuery.data.password;
      if (updatedPasswordHash !== newPasswordHash) {
        console.error('密码验证失败：数据库中的密码哈希与预期不符');
        console.error('预期哈希:', newPasswordHash);
        console.error('实际哈希:', updatedPasswordHash);
        return {
          code: 500,
          message: '密码更新验证失败，请重试',
          data: null
        };
      }
      console.log('密码更新验证成功');
    } else {
      console.error('密码验证失败：无法获取更新后的管理员信息');
      return {
        code: 500,
        message: '密码更新验证失败，请重试',
        data: null
      };
    }
    
    // 记录操作日志
    try {
      await db.collection('admin_logs').add({
        data: {
          adminId: adminRow._id,
          action: '修改密码',
          target: adminRow.username,
          targetType: 'admin',
          result: 'success',
          details: {
            operation: 'changePassword'
          },
          createdAt: db.serverDate(),
          updatedAt: db.serverDate()
        }
      });
      console.log('操作日志记录成功');
    } catch (logError) {
      console.warn('记录操作日志失败:', logError);
      // 不影响密码修改流程
    }
    
    console.log('管理员密码修改成功:', adminRow.username);
    
    return {
      code: 200,
      message: '密码修改成功',
      data: null
    };
    
  } catch (error) {
    console.error('修改密码失败:', error);
    return {
      code: 500,
      message: '修改密码失败: ' + error.message,
      data: null
    };
  }
}

/**
 * 获取管理员信息（须有效 adminSessionToken）
 */
async function getAdminInfo(event) {
  try {
    const v = await verifyAdminSession(db, extractAdminSessionToken(event));
    if (!v.ok) {
      return deny(v);
    }
    const adminInfo = Object.assign({}, v.admin);
    return {
      code: 200,
      message: '获取成功',
      data: {
        admin: adminInfo
      }
    };
  } catch (error) {
    console.error('获取管理员信息失败:', error);
    return {
      code: 500,
      message: '获取失败: ' + error.message,
      data: null
    };
  }
}

async function adminLogout(event) {
  const token = extractAdminSessionToken(event);
  if (!token) {
    return { code: 400, message: '缺少会话', data: null };
  }
  try {
    const res = await db.collection(COLLECTION).where({ token }).get();
    if (res.data && res.data.length) {
      for (const doc of res.data) {
        await db.collection(COLLECTION).doc(doc._id).remove();
      }
    }
    return { code: 200, message: '已退出', data: null };
  } catch (e) {
    console.error('adminLogout', e);
    return { code: 500, message: '退出失败', data: null };
  }
}

async function verifyAdminSessionAction(event) {
  const v = await verifyAdminSession(db, extractAdminSessionToken(event));
  if (!v.ok) {
    return deny(v);
  }
  return {
    code: 200,
    message: 'ok',
    data: {
      admin: v.admin
    }
  };
}

/**
 * 管理员登录（带密码验证）
 */
async function adminLogin(data) {
  const { password, username } = data;
  
  // 参数验证
  if (!password) {
    return {
      code: 400,
      message: '请输入密码',
      data: null
    };
  }
  
  try {
    // 查找管理员账号
    let adminQuery;
    
    if (username) {
      adminQuery = await db.collection('admin_accounts')
        .where({ 
          username: username,
          status: 'active'
        })
        .get();
    } else {
      // 如果没有提供username，查找第一个活跃的管理员账号
      adminQuery = await db.collection('admin_accounts')
        .where({ status: 'active' })
        .limit(1)
        .get();
    }
    
    // 如果账号不存在，创建默认管理员账号（初始密码为"1"）
    if (!adminQuery.data || adminQuery.data.length === 0) {
      console.log('管理员账号不存在，创建默认账号');
      
      const defaultPasswordHash = crypto.createHash('sha256')
        .update('1')
        .digest('hex');
      
      const createResult = await db.collection('admin_accounts').add({
        data: {
          username: username || '3086099731',
          password: defaultPasswordHash,
          role: 'super_admin',
          permissions: ['all'],
          status: 'active',
          createdAt: db.serverDate(),
          updatedAt: db.serverDate()
        }
      });
      
      const adminDoc = await db.collection('admin_accounts').doc(createResult._id).get();
      adminQuery = { data: [adminDoc.data] };
    }
    
    const admin = adminQuery.data[0];
    
    // 验证密码
    const passwordHash = crypto.createHash('sha256')
      .update(password)
      .digest('hex');
    
    if (admin.password !== passwordHash) {
      return {
        code: 401,
        message: '密码错误',
        data: null
      };
    }
    
    // 更新最后登录时间
    await db.collection('admin_accounts').doc(admin._id).update({
      data: {
        lastLoginAt: db.serverDate(),
        updatedAt: db.serverDate()
      }
    });
    
    console.log('管理员登录成功:', admin.username);

    const sessionToken = newSessionToken();
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
    await db.collection(COLLECTION).add({
      data: {
        token: sessionToken,
        adminId: admin._id,
        createdAt: db.serverDate(),
        expiresAt
      }
    });

    let customLoginTicket = null;
    try {
      const tcb = require('@cloudbase/node-sdk');
      const app = tcb.init({
        env: tcb.SYMBOL_CURRENT_ENV
      });
      customLoginTicket = await app.auth().createTicket(`admin_${admin._id}`);
    } catch (ticketErr) {
      console.warn('自定义登录 ticket 签发跳过（Web 端可仅用 sessionToken）:', ticketErr.message);
    }
    
    return {
      code: 200,
      message: '登录成功',
      data: {
        admin: {
          id: admin._id,
          username: admin.username,
          role: admin.role,
          permissions: admin.permissions || []
        },
        sessionToken,
        expiresAt: expiresAt.getTime(),
        customLoginTicket
      }
    };
    
  } catch (error) {
    console.error('管理员登录失败:', error);
    return {
      code: 500,
      message: '登录失败: ' + error.message,
      data: null
    };
  }
}

