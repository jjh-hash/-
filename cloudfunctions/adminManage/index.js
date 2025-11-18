// 管理员管理云函数
const cloud = require('wx-server-sdk');
const crypto = require('crypto');

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
        return await changePassword(data);
      case 'getAdminInfo':
        return await getAdminInfo(data);
      case 'adminLogin':
        return await adminLogin(data);
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
 * 修改管理员密码
 */
async function changePassword(data) {
  const { oldPassword, newPassword, username } = data;
  
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
    // 查找管理员账号
    // 优先使用提供的username，否则查找第一个活跃的管理员账号
    let adminQuery;
    
    console.log('开始查找管理员账号，username:', username);
    
    // 尝试查询管理员账号
    let querySuccess = false;
    try {
      if (username) {
        console.log('使用username查询管理员账号:', username);
        adminQuery = await db.collection('admin_accounts')
          .where({ 
            username: username,
            status: 'active'
          })
          .get();
        console.log('查询结果，找到', adminQuery.data.length, '个管理员账号');
      } else {
        // 如果没有提供username，查找第一个活跃的管理员账号
        // 适用于单管理员系统
        console.log('未提供username，查找第一个活跃的管理员账号');
        adminQuery = await db.collection('admin_accounts')
          .where({ status: 'active' })
          .limit(1)
          .get();
        console.log('查询结果，找到', adminQuery.data.length, '个管理员账号');
      }
      querySuccess = true;
    } catch (queryError) {
      // 如果集合不存在，查询会失败
      console.log('查询管理员账号失败（可能是集合不存在）:', queryError.message);
      querySuccess = false;
      adminQuery = null;
    }
    
    // 如果查询失败或账号不存在，创建默认管理员账号
    if (!querySuccess || !adminQuery || !adminQuery.data || adminQuery.data.length === 0) {
      console.log('管理员账号不存在，创建默认账号（username:', username || '3086099731', '）');
      
      const defaultPasswordHash = crypto.createHash('sha256')
        .update('1')
        .digest('hex');
      
      try {
        // 使用 add 方法会自动创建集合（如果不存在）
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
        
        console.log('管理员账号创建成功，ID:', createResult._id);
        
        // 获取刚创建的管理员账号
        const adminDoc = await db.collection('admin_accounts').doc(createResult._id).get();
        if (adminDoc && adminDoc.data) {
          adminQuery = { data: [adminDoc.data] };
          console.log('获取新创建的管理员账号成功');
        } else {
          // 如果获取失败，尝试重新查询
          console.log('直接获取失败，尝试重新查询');
          adminQuery = await db.collection('admin_accounts')
            .where({ username: username || '3086099731' })
            .get();
          
          if (!adminQuery.data || adminQuery.data.length === 0) {
            return {
              code: 500,
              message: '创建管理员账号失败，请稍后重试',
              data: null
            };
          }
        }
      } catch (createError) {
        console.error('创建管理员账号失败:', createError);
        return {
          code: 500,
          message: '创建管理员账号失败: ' + createError.message,
          data: null
        };
      }
    }
    
    // 确保 admin 存在
    if (!adminQuery || !adminQuery.data || adminQuery.data.length === 0) {
      return {
        code: 404,
        message: '管理员账号不存在，请先创建管理员账号',
        data: null
      };
    }
    
    const admin = adminQuery.data[0];
    
    if (!admin) {
      return {
        code: 404,
        message: '管理员账号数据异常',
        data: null
      };
    }
    
    console.log('找到管理员账号，ID:', admin._id, '用户名:', admin.username);
    
    // 验证旧密码
    const oldPasswordHash = crypto.createHash('sha256')
      .update(oldPassword)
      .digest('hex');
    
    console.log('验证旧密码，输入密码哈希:', oldPasswordHash);
    console.log('数据库中密码哈希:', admin.password);
    
    if (admin.password !== oldPasswordHash) {
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
    
    console.log('准备更新密码，管理员ID:', admin._id, '用户名:', admin.username);
    console.log('旧密码哈希:', admin.password);
    console.log('新密码哈希:', newPasswordHash);
    
    // 更新密码
    const updateResult = await db.collection('admin_accounts').doc(admin._id).update({
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
    const verifyQuery = await db.collection('admin_accounts').doc(admin._id).get();
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
          adminId: admin._id,
          action: '修改密码',
          target: admin.username,
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
    
    console.log('管理员密码修改成功:', admin.username);
    
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
 * 获取管理员信息
 */
async function getAdminInfo(data) {
  const { adminId, username } = data;
  
  try {
    let adminQuery;
    
    if (adminId) {
      const adminDoc = await db.collection('admin_accounts').doc(adminId).get();
      adminQuery = { data: adminDoc.data ? [adminDoc.data] : [] };
    } else if (username) {
      adminQuery = await db.collection('admin_accounts')
        .where({ username: username })
        .get();
    } else {
      return {
        code: 400,
        message: '缺少管理员标识',
        data: null
      };
    }
    
    if (!adminQuery.data || adminQuery.data.length === 0) {
      return {
        code: 404,
        message: '管理员不存在',
        data: null
      };
    }
    
    const admin = adminQuery.data[0];
    
    // 不返回密码字段
    const { password, ...adminInfo } = admin;
    
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
    
    return {
      code: 200,
      message: '登录成功',
      data: {
        admin: {
          id: admin._id,
          username: admin.username,
          role: admin.role
        }
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

