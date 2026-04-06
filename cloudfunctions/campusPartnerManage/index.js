// 校园兼职管理：申请、缴纳保证金、状态查询、申请退还（缴纳满 30 天后可退，保证金 25 元）
const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

const DEPOSIT_LOCK_DAYS = 30; // 缴纳满 30 天后可申请退还保证金
const DEPOSIT_LOCK_MS = DEPOSIT_LOCK_DAYS * 24 * 60 * 60 * 1000;

exports.main = async (event, context) => {
  const { action, data = {} } = event;
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;

  if (!openid) {
    return { code: 401, message: '请先登录', data: null };
  }

  try {
    switch (action) {
      case 'getStatus':
        return await getStatus(openid);
      case 'apply':
        return await apply(openid);
      case 'createDepositPayment':
        return await createDepositPayment(openid);
      case 'confirmDeposit':
        return await confirmDeposit(openid, data);
      case 'requestRefund':
        return await requestRefund(openid);
      default:
        return { code: 400, message: '无效操作', data: null };
    }
  } catch (err) {
    console.error('【校园兼职】', action, err);
    return {
      code: 500,
      message: err.message || '操作失败',
      data: null
    };
  }
};

// 获取平台保证金金额（分）
async function getDepositAmountFen() {
  const res = await db.collection('platform_config').limit(1).get();
  const config = (res.data && res.data[0]) || {};
  return config.depositAmount !== undefined ? config.depositAmount : 2500;
}

// 查询当前用户校园兼职状态
async function getStatus(openid) {
  const depositAmountFen = await getDepositAmountFen();
  const depositAmountYuan = (depositAmountFen / 100).toFixed(2);

  let record;
  try {
    const res = await db.collection('campus_partners').where({ openid }).limit(1).get();
    record = res.data && res.data[0] ? res.data[0] : null;
  } catch (e) {
    if (e.errCode === -502005 || (e.message && e.message.includes('not exist'))) {
      record = null;
    } else throw e;
  }

  if (!record) {
    return {
      code: 200,
      message: 'ok',
      data: {
        status: 'none',
        depositAmountFen,
        depositAmountYuan,
        canRefund: false,
        refundableAfter: null,
        depositPaidAt: null
      }
    };
  }

  const depositPaidAt = record.depositPaidAt;
  const status = record.status || 'pending_payment';
  let refundableAt = null;
  let canRefund = false;
  if (depositPaidAt && (status === 'active' || status === 'refund_requested')) {
    const d = depositPaidAt instanceof Date ? depositPaidAt : new Date(depositPaidAt);
    refundableAt = new Date(d.getTime() + DEPOSIT_LOCK_MS);
    canRefund = new Date() >= refundableAt;
  }

  return {
    code: 200,
    message: 'ok',
    data: {
      status,
      depositAmountFen,
      depositAmountYuan,
      depositPaidAt: depositPaidAt ? (depositPaidAt instanceof Date ? depositPaidAt.toISOString() : depositPaidAt) : null,
      canRefund,
      refundableAfter: refundableAt ? refundableAt.toISOString() : null
    }
  };
}

// 申请校园兼职（创建待缴纳记录，返回需缴金额；已退出 refuned 可重新申请）
async function apply(openid) {
  let res = await db.collection('campus_partners').where({ openid }).limit(1).get();
  if (res.data && res.data.length > 0) {
    const r = res.data[0];
    if (r.status === 'active' || r.status === 'refund_requested') {
      return { code: 400, message: '您已是校园兼职或已申请过', data: null };
    }
    if (r.status === 'pending_payment') {
      const depositAmountFen = await getDepositAmountFen();
      return {
        code: 200,
        message: 'ok',
        data: { status: 'pending_payment', depositAmountFen, depositAmountYuan: (depositAmountFen / 100).toFixed(2) }
      };
    }
    if (r.status === 'refunded') {
      const depositAmountFen = await getDepositAmountFen();
      await db.collection('campus_partners').doc(r._id).update({
        data: {
          status: 'pending_payment',
          depositPaidAt: null,
          depositOrderId: null,
          refundRequestedAt: null,
          updatedAt: db.serverDate()
        }
      });
      return {
        code: 200,
        message: 'ok',
        data: { status: 'pending_payment', depositAmountFen, depositAmountYuan: (depositAmountFen / 100).toFixed(2) }
      };
    }
  }

  const depositAmountFen = await getDepositAmountFen();
  await db.collection('campus_partners').add({
    data: {
      openid,
      status: 'pending_payment',
      createdAt: db.serverDate(),
      updatedAt: db.serverDate()
    }
  });

  return {
    code: 200,
    message: 'ok',
    data: {
      status: 'pending_payment',
      depositAmountFen,
      depositAmountYuan: (depositAmountFen / 100).toFixed(2)
    }
  };
}

// 创建保证金支付单并返回调起支付参数（真实支付）
// 若该用户已有 status=pending 的支付单则复用，避免重复插入（deposit_orders 不要对 openid 建唯一索引，同一用户可有多条记录：多次缴纳）
async function createDepositPayment(openid) {
  const res = await db.collection('campus_partners').where({ openid }).limit(1).get();
  if (!res.data || res.data.length === 0) {
    return { code: 400, message: '请先申请校园兼职', data: null };
  }
  const doc = res.data[0];
  if (doc.status !== 'pending_payment') {
    return { code: 400, message: '当前状态不允许缴纳', data: null };
  }

  const amountFen = await getDepositAmountFen();
  if (amountFen <= 0) {
    return { code: 400, message: '保证金金额未配置', data: null };
  }

  let depositOrderId;
  let outTradeNo;
  const existingRes = await db.collection('deposit_orders').where({ openid, status: 'pending' }).limit(1).get();
  if (existingRes.data && existingRes.data.length > 0) {
    const existing = existingRes.data[0];
    depositOrderId = existing._id;
    outTradeNo = existing.outTradeNo || ('DEP' + Date.now() + '_' + Math.random().toString(36).substr(2, 9));
  } else {
    outTradeNo = 'DEP' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    const addRes = await db.collection('deposit_orders').add({
      data: {
        openid,
        amountFen,
        status: 'pending',
        outTradeNo,
        createdAt: db.serverDate(),
        updatedAt: db.serverDate()
      }
    });
    depositOrderId = addRes._id;
  }

  const payRes = await cloud.callFunction({
    name: 'paymentManage',
    data: {
      action: 'unifiedOrderDeposit',
      data: {
        openid,
        totalFee: amountFen,
        outTradeNo,
        description: '校园兼职保证金'
      }
    }
  });
  const payResult = (payRes.result && payRes.result.data) ? payRes.result : payRes.result;
  if (!payResult || payResult.code !== 200 || !payResult.data) {
    return {
      code: 500,
      message: payResult && payResult.message ? payResult.message : '获取支付参数失败',
      data: null
    };
  }

  return {
    code: 200,
    message: 'ok',
    data: {
      depositOrderId,
      payment: payResult.data
    }
  };
}

// 确认已缴纳保证金（需传入 depositOrderId，校验微信支付成功后开通）
async function confirmDeposit(openid, data) {
  const depositOrderId = data && data.depositOrderId;
  if (!depositOrderId) {
    return { code: 400, message: '请先完成支付并传入支付单号', data: null };
  }

  const res = await db.collection('campus_partners').where({ openid }).limit(1).get();
  if (!res.data || res.data.length === 0) {
    return { code: 400, message: '请先申请校园兼职', data: null };
  }
  const doc = res.data[0];
  if (doc.status !== 'pending_payment') {
    return { code: 400, message: '当前状态不允许缴纳', data: null };
  }

  let depositOrder;
  try {
    const dRes = await db.collection('deposit_orders').doc(depositOrderId).get();
    depositOrder = dRes.data;
  } catch (e) {
    return { code: 404, message: '支付单不存在', data: null };
  }
  if (!depositOrder || depositOrder.openid !== openid) {
    return { code: 403, message: '支付单与当前用户不匹配', data: null };
  }
  if (depositOrder.status === 'paid') {
    return { code: 400, message: '该笔支付已确认，请勿重复提交', data: null };
  }
  if (depositOrder.status !== 'pending') {
    return { code: 400, message: '支付单状态异常', data: null };
  }

  const queryRes = await cloud.callFunction({
    name: 'paymentManage',
    data: { action: 'queryOrderByOutTradeNo', data: { outTradeNo: depositOrder.outTradeNo } }
  });
  const queryResult = (queryRes.result && queryRes.result.data) ? queryRes.result : queryRes.result;
  if (!queryResult || queryResult.code !== 200 || !queryResult.data) {
    return { code: 500, message: queryResult && queryResult.message ? queryResult.message : '查询支付结果失败', data: null };
  }
  if (queryResult.data.trade_state !== 'SUCCESS') {
    return { code: 400, message: '支付未完成或已关闭，请完成支付后再确认', data: null };
  }

  const now = new Date();
  await db.collection('deposit_orders').doc(depositOrderId).update({
    data: {
      status: 'paid',
      transactionId: queryResult.data.transaction_id || '',
      updatedAt: now
    }
  });
  await db.collection('campus_partners').doc(doc._id).update({
    data: {
      status: 'active',
      depositPaidAt: now,
      depositOrderId,
      updatedAt: now
    }
  });

  return {
    code: 200,
    message: '开通成功，可前往任务大厅或接单端接单',
    data: { status: 'active' }
  };
}

// 申请退还保证金（满 N 分钟后可申请），并立即执行原路退款
async function requestRefund(openid) {
  const res = await db.collection('campus_partners').where({ openid }).limit(1).get();
  if (!res.data || res.data.length === 0) {
    return { code: 400, message: '未查询到校园兼职记录', data: null };
  }
  const doc = res.data[0];
  if (doc.status !== 'active') {
    return { code: 400, message: '当前状态不允许申请退款', data: null };
  }

  const depositPaidAt = doc.depositPaidAt;
  if (!depositPaidAt) {
    return { code: 400, message: '数据异常，无法校验退款时间', data: null };
  }
  const paid = depositPaidAt instanceof Date ? depositPaidAt : new Date(depositPaidAt);
  const refundableAt = new Date(paid.getTime() + DEPOSIT_LOCK_MS);
  if (new Date() < refundableAt) {
    return {
      code: 400,
      message: `缴纳满 ${DEPOSIT_LOCK_DAYS} 天后可申请退还，请稍后再试`,
      data: null
    };
  }

  await db.collection('campus_partners').doc(doc._id).update({
    data: {
      status: 'refund_requested',
      refundRequestedAt: db.serverDate(),
      updatedAt: db.serverDate()
    }
  });

  const depositOrderId = doc.depositOrderId;
  if (depositOrderId) {
    let depositOrder;
    try {
      const dRes = await db.collection('deposit_orders').doc(depositOrderId).get();
      depositOrder = dRes.data;
    } catch (e) {
      depositOrder = null;
    }
    if (depositOrder && depositOrder.status === 'paid' && depositOrder.outTradeNo && depositOrder.amountFen != null) {
      const refundRes = await cloud.callFunction({
        name: 'paymentManage',
        data: {
          action: 'refundByOutTradeNo',
          data: {
            outTradeNo: depositOrder.outTradeNo,
            totalFeeFen: depositOrder.amountFen
          }
        }
      });
      const raw = refundRes.result != null ? refundRes.result : refundRes;
      const refundResult = (raw && raw.data != null) ? raw : raw;
      if (refundResult && refundResult.code === 200) {
        const now = new Date();
        await db.collection('deposit_orders').doc(depositOrderId).update({
          data: { status: 'refunded', refundedAt: now, updatedAt: now }
        });
        await db.collection('campus_partners').doc(doc._id).update({
          data: { status: 'refunded', updatedAt: db.serverDate() }
        });
        return {
          code: 200,
          message: '保证金已原路退回，校园兼职身份已解除',
          data: { status: 'refunded' }
        };
      }
      let errMsg = refundResult && refundResult.message ? refundResult.message : '退款请求失败';
      if (errMsg === 'OK' || !errMsg || errMsg.trim() === '') errMsg = '退款失败，请确认商户证书与退款配置或稍后重试';
      await db.collection('campus_partners').doc(doc._id).update({
        data: { status: 'active', updatedAt: db.serverDate() }
      });
      return { code: 500, message: errMsg, data: null };
    }
  }

  await db.collection('campus_partners').doc(doc._id).update({
    data: { status: 'refunded', updatedAt: db.serverDate() }
  });
  return {
    code: 200,
    message: '已解除校园兼职身份（该笔保证金无支付记录，未执行原路退）',
    data: { status: 'refunded' }
  };
}
