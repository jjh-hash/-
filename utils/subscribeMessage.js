/**
 * 订阅消息工具：在支付成功等时机请求用户订阅「订单状态通知」，便于后续发送服务通知
 * 真机要求 requestSubscribeMessage 必须在「同一次点击」的同步链路里调用，若先 await 云函数再调会判定手势失效不弹窗，
 * 因此需在页面 onLoad/onShow 时预拉模板 ID，点击时直接用缓存 tid 调起弹窗。
 */

/**
 * 预拉取所有订阅模板 ID 并写入 globalData（订单状态、退款结果、评价提醒）
 * 仅在已缓存「订单+退款+评价」三个 ID 时才跳过请求，否则每次进入结算页会拉取最新配置，便于在 platform_config 中新增退款/评价模板 ID 后生效。
 */
function preloadOrderStatusTemplateId() {
  const g = getApp().globalData;
  const hasAll = g.subscribeMessageOrderStatusTemplateId && g.subscribeMessageRefundTemplateId && g.subscribeMessageReviewTemplateId;
  if (hasAll) return;
  wx.cloud
    .callFunction({ name: 'platformConfig', data: { action: 'getConfig' } })
    .then((r) => {
      const d = (r.result && r.result.data) || {};
      if (d.subscribeMessageOrderStatusTemplateId) g.subscribeMessageOrderStatusTemplateId = d.subscribeMessageOrderStatusTemplateId;
      g.subscribeMessageRefundTemplateId = d.subscribeMessageRefundTemplateId !== undefined ? (d.subscribeMessageRefundTemplateId || '') : (g.subscribeMessageRefundTemplateId || '');
      g.subscribeMessageReviewTemplateId = d.subscribeMessageReviewTemplateId !== undefined ? (d.subscribeMessageReviewTemplateId || '') : (g.subscribeMessageReviewTemplateId || '');
    })
    .catch(() => {});
}

/**
 * 请求用户订阅订单状态类订阅消息（静默失败）
 * 依赖 globalData 或先调用 preloadOrderStatusTemplateId；点击时若已有 tid 则同步调起弹窗，否则先拉配置再调（真机可能不弹）
 */
function requestOrderStatusSubscribe() {
  return new Promise((resolve) => {
    let tid = getApp().globalData.subscribeMessageOrderStatusTemplateId;
    if (tid) {
      wx.requestSubscribeMessage({ tmplIds: [tid] }).then(resolve).catch(resolve);
      return;
    }
    wx.cloud
      .callFunction({ name: 'platformConfig', data: { action: 'getConfig' } })
      .then((r) => {
        tid = (r.result && r.result.data && r.result.data.subscribeMessageOrderStatusTemplateId) || '';
        if (tid) getApp().globalData.subscribeMessageOrderStatusTemplateId = tid;
        if (tid) return wx.requestSubscribeMessage({ tmplIds: [tid] });
      })
      .then(resolve)
      .catch(resolve);
  });
}

// 防重入：上一次 requestSubscribeMessage 未结束时不再发起新调用，避免 "last call has not ended"
let _subscribePending = null;

/**
 * 在用户点击时同步调起订阅弹窗（满足真机「同一次点击」）
 * @param {string|string[]} tidOrTmplIds - 单个模板 ID 或模板 ID 数组
 */
function triggerSubscribeSync(tidOrTmplIds) {
  const ids = Array.isArray(tidOrTmplIds)
    ? tidOrTmplIds.filter(Boolean)
    : (tidOrTmplIds ? [tidOrTmplIds] : []);
  if (ids.length === 0) return Promise.resolve();
  if (_subscribePending) {
    return _subscribePending.then(() => triggerSubscribeSync(tidOrTmplIds));
  }
  const p = wx.requestSubscribeMessage({ tmplIds: ids })
    .then((res) => { _subscribePending = null; return res; })
    .catch((err) => { _subscribePending = null; throw err; });
  _subscribePending = p;
  return p;
}

/** 获取结算页一次请求的模板 ID 列表。微信限制：一次多模板仅展示第一个，故结算页仅请求「订单状态」；退款、评价在申请退款/点击评价时分别请求 */
function getCheckoutTemplateIds() {
  const g = getApp().globalData;
  const tid = g.subscribeMessageOrderStatusTemplateId;
  return tid ? [tid] : [];
}

/** 获取订单状态模板 ID（结算页用） */
function getOrderStatusTemplateId() {
  return getApp().globalData.subscribeMessageOrderStatusTemplateId || '';
}

/** 获取退款进度模板 ID（申请退款时用） */
function getRefundTemplateId() {
  return getApp().globalData.subscribeMessageRefundTemplateId || '';
}

/** 获取评价提醒模板 ID（点击评价时用） */
function getReviewTemplateId() {
  return getApp().globalData.subscribeMessageReviewTemplateId || '';
}

/** 预拉取商家新订单提醒模板 ID（商家端进入订单页时调用）；返回 Promise，便于点击时等待 */
function preloadMerchantNewOrderTemplateId() {
  const g = getApp().globalData;
  if (g.subscribeMessageNewOrderTemplateId) return Promise.resolve(g.subscribeMessageNewOrderTemplateId);
  return wx.cloud
    .callFunction({ name: 'platformConfig', data: { action: 'getConfig' } })
    .then((r) => {
      const d = (r.result && r.result.data) || {};
      const tid = d.subscribeMessageNewOrderTemplateId || '';
      if (tid) g.subscribeMessageNewOrderTemplateId = tid;
      return tid;
    })
    .catch(() => '');
}

/** 获取商家新订单提醒模板 ID（商家端点击「开启新订单提醒」时用） */
function getNewOrderTemplateId() {
  return getApp().globalData.subscribeMessageNewOrderTemplateId || '';
}

module.exports = {
  preloadOrderStatusTemplateId,
  requestOrderStatusSubscribe,
  triggerSubscribeSync,
  getCheckoutTemplateIds,
  getOrderStatusTemplateId,
  getRefundTemplateId,
  getReviewTemplateId,
  preloadMerchantNewOrderTemplateId,
  getNewOrderTemplateId
};
