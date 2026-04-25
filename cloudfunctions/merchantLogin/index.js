// 商家登录云函数
const cloud = require('wx-server-sdk');
const crypto = require('crypto');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();

function generateSessionToken() {
  return crypto.randomBytes(32).toString('hex');
}

function sha256(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

async function createMerchantSession(merchantInfo, meta = {}) {
  const sessionToken = generateSessionToken();
  const tokenHash = sha256(sessionToken);
  const ttlDays = 7;
  const now = Date.now();
  const expiresAt = new Date(now + ttlDays * 24 * 60 * 60 * 1000);
  const { loginType = 'unknown' } = meta;

  await db.collection('merchant_sessions').add({
    data: {
      merchantId: merchantInfo._id,
      tokenHash,
      loginType,
      status: 'active',
      createdAt: db.serverDate(),
      updatedAt: db.serverDate(),
      lastSeenAt: db.serverDate(),
      expiresAt
    }
  });

  return sessionToken;
}

exports.main = async (event, context) => {
  console.log('商家登录请求:', event);

  const { loginType = 'wx', account, password, merchantId } = event;

  try {
    if (loginType === 'account') {
      return await accountLogin(account, password);
    }

    return await wxLogin(merchantId);
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
  if (!account || !password) {
    return {
      code: 400,
      message: '请输入账号和密码',
      data: null
    };
  }

  try {
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

    let userInfo = null;
    if (merchantInfo.openid) {
      const userQuery = await db.collection('users')
        .where({ openid: merchantInfo.openid })
        .get();

      if (userQuery.data.length > 0) {
        userInfo = userQuery.data[0];
      }
    }

    return await buildMerchantLoginResponse(merchantInfo, userInfo, { loginType: 'account' });
  } catch (error) {
    console.error('账户登录失败:', error);
    return {
      code: 500,
      message: '登录失败，请重试',
      data: null
    };
  }
}

function lastLoginTimeMs(v) {
  if (!v) return 0;
  try {
    if (v instanceof Date) return v.getTime();
    if (typeof v === 'object' && v.getTime) return v.getTime();
    const n = new Date(v).getTime();
    return Number.isNaN(n) ? 0 : n;
  } catch (e) {
    return 0;
  }
}

/**
 * 微信一键登录：同一 openid 可绑定多个商家；多个时返回 code 201 供前端选择。
 * @param {string} [merchantId] 用户在多账号列表中选定后回传
 */
async function wxLogin(merchantId) {
  const wxContext = cloud.getWXContext();
  const { OPENID } = wxContext;

  console.log('当前用户OpenID:', OPENID);

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

  if (userInfo.role !== 'merchant') {
    return {
      code: 403,
      message: '您还不是商家，请先注册',
      data: null
    };
  }

  if (merchantId) {
    const doc = await db.collection('merchants').doc(merchantId).get();
    if (!doc.data || doc.data.openid !== OPENID) {
      return {
        code: 403,
        message: '无权登录该商家账号',
        data: null
      };
    }
    return await buildMerchantLoginResponse(doc.data, userInfo, { loginType: 'wx' });
  }

  const merchantQuery = await db.collection('merchants')
    .where({ openid: OPENID })
    .field({
      _id: true,
      openid: true,
      merchantName: true,
      contactPhone: true,
      avatar: true,
      status: true,
      role: true,
      account: true,
      storeId: true,
      lastLoginAt: true
    })
    .get();

  if (merchantQuery.data.length === 0) {
    return {
      code: 404,
      message: '商家信息不存在',
      data: null
    };
  }

  if (merchantQuery.data.length === 1) {
    return await buildMerchantLoginResponse(merchantQuery.data[0], userInfo, { loginType: 'wx' });
  }

  const sorted = merchantQuery.data.slice().sort((a, b) => {
    return lastLoginTimeMs(b.lastLoginAt) - lastLoginTimeMs(a.lastLoginAt);
  });

  let maxT = 0;
  let lastLoginMerchantId = '';
  sorted.forEach((m) => {
    const t = lastLoginTimeMs(m.lastLoginAt);
    if (t > maxT) {
      maxT = t;
      lastLoginMerchantId = m._id;
    }
  });

  const merchants = sorted.map((m) => ({
    _id: m._id,
    merchantName: m.merchantName || '商家',
    account: m.account || '',
    status: m.status,
    isLastLogin: maxT > 0 && m._id === lastLoginMerchantId
  }));

  return {
    code: 201,
    message: '请选择商家账号',
    data: {
      merchants,
      user: {
        _id: userInfo._id,
        openid: userInfo.openid,
        nickname: userInfo.nickname,
        avatar: userInfo.avatar,
        role: userInfo.role,
        campus: userInfo.campus
      }
    }
  };
}

/**
 * 更新最后登录时间并返回与账户登录一致的数据结构
 */
async function buildMerchantLoginResponse(merchantInfo, userInfo, meta = {}) {
  const sessionToken = await createMerchantSession(merchantInfo, meta);
  await db.collection('merchants').doc(merchantInfo._id).update({
    data: {
      lastLoginAt: db.serverDate(),
      updatedAt: db.serverDate()
    }
  });

  let storeId = merchantInfo.storeId || null;
  if (!storeId) {
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

  console.log('商家登录成功:', merchantInfo.merchantName);

  return {
    code: 200,
    message: '登录成功',
    data: {
      merchant: {
        _id: merchantInfo._id,
        merchantName: merchantInfo.merchantName || '商家',
        contactPhone: merchantInfo.contactPhone || '',
        avatar: merchantInfo.avatar || '',
        status: merchantInfo.status,
        role: merchantInfo.role || 'owner',
        account: merchantInfo.account,
        storeId: storeId,
        openid: merchantInfo.openid,
        sessionToken
      },
      sessionToken,
      user: userInfo
        ? {
            _id: userInfo._id,
            openid: userInfo.openid,
            nickname: userInfo.nickname,
            avatar: userInfo.avatar,
            role: userInfo.role,
            campus: userInfo.campus
          }
        : null
    }
  };
}
