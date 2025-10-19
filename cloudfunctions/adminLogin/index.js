// cloudfunctions/adminLogin/index.js
const cloud = require('wx-server-sdk')
const crypto = require('crypto')

cloud.init({ env: process.env.TCB_ENV })
const db = cloud.database()
const _ = db.command

/**
 * 管理员登录云函数
 */
exports.main = async (event, context) => {
  const { username, password } = event

  try {
    // 1. 参数验证
    if (!username || !password) {
      return {
        code: 400,
        message: '用户名和密码不能为空'
      }
    }

    // 2. 查询管理员信息
    const adminResult = await db.collection('admin_accounts')
      .where({
        username: username,
        status: 'active'
      })
      .get()

    if (adminResult.data.length === 0) {
      return {
        code: 401,
        message: '管理员不存在或已被禁用'
      }
    }

    const admin = adminResult.data[0]

    // 3. 验证密码
    const hashedPassword = crypto.createHash('sha256').update(password).digest('hex')
    if (admin.password !== hashedPassword) {
      return {
        code: 401,
        message: '密码错误'
      }
    }

    // 4. 生成访问令牌
    const token = 'admin_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9)
    const expireTime = Date.now() + 24 * 60 * 60 * 1000 // 24小时过期

    // 5. 更新最后登录时间
    await db.collection('admin_accounts').doc(admin._id).update({
      data: {
        lastLoginAt: new Date(),
        updatedAt: new Date()
      }
    })

    // 6. 记录登录日志
    await db.collection('admin_logs').add({
      data: {
        adminId: admin._id,
        action: 'login',
        target: 'system',
        description: `管理员 ${username} 登录系统`,
        ip: context.CLIENTIP || 'unknown',
        createdAt: new Date()
      }
    })

    // 7. 返回登录成功信息
    return {
      code: 200,
      message: '登录成功',
      data: {
        token: token,
        adminInfo: {
          _id: admin._id,
          username: admin.username,
          role: admin.role,
          permissions: admin.permissions,
          lastLoginAt: admin.lastLoginAt
        },
        expireTime: expireTime
      }
    }

  } catch (error) {
    console.error('管理员登录失败:', error)
    return {
      code: 500,
      message: '系统异常，登录失败',
      data: error.message
    }
  }
}
