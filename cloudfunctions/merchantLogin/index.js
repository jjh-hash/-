// 商家登录云函数
const cloud = require('wx-server-sdk');
const crypto = require('crypto');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();

exports.main = async (event, context) => {
  console.log('商家登录请求:', event);
  
  const { loginType = 'wx', account, password } = event;
  
  try {
    // 账户密码登录
    if (loginType === 'account') {
      return await accountLogin(account, password);
    }
    
    // 微信登录（原有逻辑）
    return await wxLogin();
    
  } catch (error) {
    console.error('商家登录失败:', error);
    return {
      code: 500,
      message: '系统异常',
      data: null
    };
  }
};

/**
 * 账户密码登录
 */
async function accountLogin(account, password) {
  // 参数验证
  if (!account || !password) {
    return {
      code: 400,
      message: '请输入账号和密码',
      data: null
    };
  }

  try {
    // 根据账号查找商家
    const merchantQuery = await db.collection('merchants')
      .where({
        account: account.trim()
      })
      .get();
    
    if (merchantQuery.data.length === 0) {
      return {
        code: 401,
        message: '账号或密码错误',
        data: null
      };
    }
    
    const merchantInfo = merchantQuery.data[0];
    
    // 验证密码
    const passwordHash = crypto.createHash('sha256')
      .update(password.trim())
      .digest('hex');
    
    if (merchantInfo.password !== passwordHash) {
      return {
        code: 401,
        message: '账号或密码错误',
        data: null
      };
    }
    
    // 检查商家状态
    if (merchantInfo.status === 'pending') {
      return {
        code: 403,
        message: '商家账号待审核，请等待审核通过',
        data: null
      };
    }
    
    if (merchantInfo.status === 'rejected' || merchantInfo.status === 'suspended') {
      return {
        code: 403,
        message: '商家账号已被禁用，请联系管理员',
        data: null
      };
    }
    
    // 更新最后登录时间
    await db.collection('merchants').doc(merchantInfo._id).update({
      data: {
        lastLoginAt: db.serverDate(),
        updatedAt: db.serverDate()
      }
    });
    
    console.log('商家账户登录成功:', merchantInfo.merchantName);
    
    // 获取用户信息（如果存在）
    let userInfo = null;
    if (merchantInfo.openid) {
      const userQuery = await db.collection('users')
        .where({ openid: merchantInfo.openid })
        .get();
      
      if (userQuery.data.length > 0) {
        userInfo = userQuery.data[0];
      }
    }
    
    // 获取店铺ID（如果存在）
    let storeId = merchantInfo.storeId || null;
    if (!storeId) {
      // 如果没有storeId，尝试查询店铺
      try {
        const storeQuery = await db.collection('stores')
          .where({ merchantId: merchantInfo._id })
          .limit(1)
          .get();
        if (storeQuery.data && storeQuery.data.length > 0) {
          storeId = storeQuery.data[0]._id;
        }
      } catch (err) {
        console.warn('查询店铺ID失败:', err);
      }
    }
    
    return {
      code: 200,
      message: '登录成功',
      data: {
        merchant: {
          _id: merchantInfo._id,
          merchantName: merchantInfo.merchantName || '商家',
          contactPhone: merchantInfo.contactPhone || '',
          avatar: merchantInfo.avatar || '',
          status: merchantInfo.status || 'active',
          role: merchantInfo.role || 'owner',
          account: merchantInfo.account,
          storeId: storeId, // 添加 storeId
          openid: merchantInfo.openid // 添加 openid，用于后续验证
        },
        user: userInfo ? {
          _id: userInfo._id,
          nickname: userInfo.nickname,
          avatar: userInfo.avatar,
          role: userInfo.role
        } : null
      }
    };
  } catch (error) {
    console.error('账户登录失败:', error);
    return {
      code: 500,
      message: '登录失败，请重试',
      data: null
    };
  }
}

/**
 * 微信登录（原有逻辑）
 */
async function wxLogin() {
  // 获取微信用户信息
  const wxContext = cloud.getWXContext();
  const { OPENID } = wxContext;
  
  console.log('当前用户OpenID:', OPENID);
  
  // 1. 检查用户是否存在
  const userQuery = await db.collection('users')
    .where({ openid: OPENID })
    .get();
  
  if (userQuery.data.length === 0) {
    return {
      code: 404,
      message: '用户不存在',
      data: null
    };
  }
  
  const userInfo = userQuery.data[0];
  
  // 2. 检查用户是否是商家
  if (userInfo.role !== 'merchant') {
    return {
      code: 403,
      message: '您还不是商家，请先注册',
      data: null
    };
  }
  
  // 3. 查询商家信息
  const merchantQuery = await db.collection('merchants')
    .where({ openid: OPENID })
    .get();
  
  if (merchantQuery.data.length === 0) {
    return {
      code: 404,
      message: '商家信息不存在',
      data: null
    };
  }
  
  const merchantInfo = merchantQuery.data[0];
  
  // 4. 更新最后登录时间
  await db.collection('merchants').doc(merchantInfo._id).update({
    data: {
      lastLoginAt: db.serverDate(),
      updatedAt: db.serverDate()
    }
  });
  
  console.log('商家登录成功:', merchantInfo.merchantName);
  console.log('商家头像:', merchantInfo.avatar);
  
  return {
    code: 200,
    message: '登录成功',
    data: {
      merchant: {
        _id: merchantInfo._id,
        merchantName: merchantInfo.merchantName,
        contactPhone: merchantInfo.contactPhone || '',
        avatar: merchantInfo.avatar || '',
        status: merchantInfo.status,
        role: merchantInfo.role
      },
      user: {
        _id: userInfo._id,
        nickname: userInfo.nickname,
        avatar: userInfo.avatar,
        role: userInfo.role
      }
    }
  };
}


