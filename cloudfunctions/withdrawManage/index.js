// 商家提现管理云函数
const cloud = require('wx-server-sdk');
const crypto = require('crypto');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();

// 最低提现金额（分），1 元
const MIN_WITHDRAW_AMOUNT = 100;

function sha256(value) {
  return crypto.createHash('sha256').update(String(value || '')).digest('hex');
}

async function validateMerchantSession(merchantId, sessionToken) {
  if (!merchantId || !sessionToken) return false;
  try {
    const now = new Date();
    const sessionQuery = await db.collection('merchant_sessions')
      .where({
        merchantId,
        tokenHash: sha256(sessionToken),
        status: 'active'
      })
      .orderBy('createdAt', 'desc')
      .limit(1)
      .get();
    if (!sessionQuery.data || sessionQuery.data.length === 0) return false;
    const session = sessionQuery.data[0];
    const expiresAt = session.expiresAt ? new Date(session.expiresAt) : null;
    if (!expiresAt || Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() <= now.getTime()) return false;
    await db.collection('merchant_sessions').doc(session._id).update({
      data: { lastSeenAt: db.serverDate(), updatedAt: db.serverDate() }
    });
    return true;
  } catch (e) {
    console.error('校验商家会话失败:', e);
    return false;
  }
}

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext();
  const { action, data } = event;

  try {
    if (!action) {
      return { code: 400, message: '缺少 action 参数' };
    }
    switch (action) {
      case 'submitWithdrawal':
        return await submitWithdrawal(OPENID, data);
      case 'getWithdrawalList':
        return await getWithdrawalList(OPENID, data);
      case 'getAvailableBalance':
        return await getAvailableBalance(OPENID, data);
      default:
        return { code: 400, message: '无效的操作类型' };
    }
  } catch (err) {
    console.error('【提现管理】异常:', err);
    return {
      code: 500,
      message: '系统异常',
      error: err.message
    };
  }
};

/**
 * 计算商家可提现余额（分）
 * 逻辑与 statistics.getAccountBalance 一致：总收益 - 已同意/已完成退款 - 已成功提现 - 待处理提现
 */
async function computeAvailableBalance(merchantInfo) {
  const targetStoreId = merchantInfo.storeId || merchantInfo._id;
  const merchantId = merchantInfo._id;

  // 1. 总收益：已支付且未取消订单的商品金额
  const ordersRes = await db.collection('orders')
    .where({
      storeId: targetStoreId,
      payStatus: 'paid',
      orderStatus: db.command.neq('cancelled')
    })
    .get();
  let totalRevenue = (ordersRes.data || []).reduce((sum, o) => sum + (o.amountGoods || 0), 0);

  // 2. 扣除已同意/已完成的退款
  try {
    const refundsRes = await db.collection('refunds')
      .where({
        storeId: targetStoreId,
        status: db.command.in(['approved', 'completed']),
        processed: true
      })
      .get();
    if (refundsRes.data && refundsRes.data.length > 0) {
      const deduct = refundsRes.data.reduce((s, r) => {
        const amt = r.refundGoodsAmount || (r.refundAmount ? Math.round(r.refundAmount * 100) : 0);
        return s + amt;
      }, 0);
      totalRevenue = totalRevenue - deduct;
    }
  } catch (e) {
    console.warn('【提现】查询退款失败:', e);
  }

  // 3. 已成功提现
  let totalSuccess = 0;
  try {
    const successRes = await db.collection('withdrawals')
      .where({ merchantId, status: 'success' })
      .get();
    totalSuccess = (successRes.data || []).reduce((s, w) => s + (w.amount || 0), 0);
  } catch (e) {
    console.warn('【提现】查询已成功提现失败:', e);
  }

  // 4. 待处理提现（pending）
  let totalPending = 0;
  try {
    const pendingRes = await db.collection('withdrawals')
      .where({ merchantId, status: 'pending' })
      .get();
    totalPending = (pendingRes.data || []).reduce((s, w) => s + (w.amount || 0), 0);
  } catch (e) {
    console.warn('【提现】查询待处理提现失败:', e);
  }

  const available = totalRevenue - totalSuccess - totalPending;
  return { available: Math.max(0, available), totalRevenue, totalSuccess, totalPending };
}

/**
 * 获取可提现余额（供前端展示/校验）
 */
async function getAvailableBalance(openid, data) {
  const merchantInfo = await getMerchantInfo(openid, data && data.merchantId, data && data.sessionToken);
  if (!merchantInfo) {
    return { code: 403, message: '商家不存在' };
  }
  const { available } = await computeAvailableBalance(merchantInfo);
  return {
    code: 200,
    message: 'ok',
    data: {
      availableBalanceFen: available,
      availableBalanceYuan: (available / 100).toFixed(2),
      minWithdrawFen: MIN_WITHDRAW_AMOUNT,
      minWithdrawYuan: (MIN_WITHDRAW_AMOUNT / 100).toFixed(2)
    }
  };
}

/**
 * 提交提现申请
 */
async function submitWithdrawal(openid, data) {
  const { amountYuan, remark, merchantId: clientMerchantId, sessionToken } = data || {};
  const amountFen = amountYuan != null ? Math.round(parseFloat(amountYuan) * 100) : 0;

  if (!amountFen || amountFen < MIN_WITHDRAW_AMOUNT) {
    return {
      code: 400,
      message: '提现金额不能低于 ' + (MIN_WITHDRAW_AMOUNT / 100) + ' 元'
    };
  }

  const merchantInfo = await getMerchantInfo(openid, clientMerchantId, sessionToken);
  if (!merchantInfo) {
    return { code: 403, message: '商家不存在' };
  }

  const { available } = await computeAvailableBalance(merchantInfo);
  if (amountFen > available) {
    return {
      code: 400,
      message: '可提现余额不足，当前可提现 ' + (available / 100).toFixed(2) + ' 元'
    };
  }

  const storeId = merchantInfo.storeId || merchantInfo._id;
  const now = new Date();
  const record = {
    merchantId: merchantInfo._id,
    storeId,
    amount: amountFen,
    status: 'pending',
    payType: 'wechat',
    remark: remark || '',
    adminRemark: '',
    processedAt: null,
    createdAt: now,
    updatedAt: now
  };

  if (!merchantInfo.openid) {
    return { code: 400, message: '无法打款：商家未绑定微信 openid，请使用当前微信登录商家端' };
  }

  const addRes = await db.collection('withdrawals').add({ data: record });
  const withdrawalId = addRes._id;
  const partnerTradeNo = 'WD' + String(withdrawalId).replace(/[^a-zA-Z0-9]/g, '').substring(0, 24);

  try {
    const payRes = await cloud.callFunction({
      name: 'paymentManage',
      data: {
        action: 'transferToBalance',
        data: {
          openid: merchantInfo.openid,
          amount: amountFen,
          partnerTradeNo,
          desc: '商家提现'
        }
      }
    });
    const result = payRes.result || {};
    const now2 = new Date();
    if (result.code === 200) {
      await db.collection('withdrawals').doc(withdrawalId).update({
        data: {
          status: 'success',
          processedAt: now2,
          updatedAt: now2
        }
      });
      return {
        code: 200,
        message: '提现成功，款项将到账微信零钱',
        data: {
          amountYuan: (amountFen / 100).toFixed(2),
          status: 'success'
        }
      };
    }
    const errMsg = result.message || '打款失败';
    await db.collection('withdrawals').doc(withdrawalId).update({
      data: {
        status: 'failed',
        adminRemark: errMsg,
        processedAt: now2,
        updatedAt: now2
      }
    });
    return {
      code: 500,
      message: errMsg,
      data: { amountYuan: (amountFen / 100).toFixed(2), status: 'failed' }
    };
  } catch (err) {
    const errMsg = err.message || '打款请求异常';
    const now2 = new Date();
    await db.collection('withdrawals').doc(withdrawalId).update({
      data: {
        status: 'failed',
        adminRemark: errMsg,
        processedAt: now2,
        updatedAt: now2
      }
    });
    return {
      code: 500,
      message: errMsg,
      data: { amountYuan: (amountFen / 100).toFixed(2), status: 'failed' }
    };
  }
}

/**
 * 提现记录列表（分页）
 */
async function getWithdrawalList(openid, data) {
  const merchantInfo = await getMerchantInfo(openid, data && data.merchantId, data && data.sessionToken);
  if (!merchantInfo) {
    return { code: 403, message: '商家不存在' };
  }

  const page = Math.max(1, parseInt(data && data.page, 10) || 1);
  const pageSize = Math.min(20, Math.max(1, parseInt(data && data.pageSize, 10) || 10));
  const skip = (page - 1) * pageSize;

  const coll = db.collection('withdrawals').where({ merchantId: merchantInfo._id });
  const [countRes, listRes] = await Promise.all([
    coll.count(),
    coll.orderBy('createdAt', 'desc').skip(skip).limit(pageSize).get()
  ]);

  const total = countRes.total || 0;
  const list = (listRes.data || []).map(w => ({
    _id: w._id,
    amount: w.amount,
    amountYuan: (w.amount / 100).toFixed(2),
    status: w.status,
    statusText: getStatusText(w.status),
    remark: w.remark,
    adminRemark: w.adminRemark,
    createdAt: w.createdAt,
    processedAt: w.processedAt
  }));

  return {
    code: 200,
    message: 'ok',
    data: {
      list,
      total,
      page,
      pageSize,
      hasMore: skip + list.length < total
    }
  };
}

function getStatusText(status) {
  const map = {
    pending: '待打款',
    success: '已打款',
    failed: '打款失败',
    rejected: '已拒绝'
  };
  return map[status] || status;
}

/**
 * 根据 openid 或传入的 merchantId 解析商家信息
 */
async function getMerchantInfo(openid, clientMerchantId, sessionToken) {
  if (clientMerchantId) {
    const doc = await db.collection('merchants').doc(clientMerchantId).get();
    if (doc.data) {
      if (doc.data.openid === openid) return doc.data;
      const tokenOk = await validateMerchantSession(doc.data._id, sessionToken);
      if (tokenOk) return doc.data;
      return null;
    }
  }
  const list = await db.collection('merchants').where({ openid }).get();
  if (list.data && list.data.length > 0) return list.data[0];
  return null;
}
