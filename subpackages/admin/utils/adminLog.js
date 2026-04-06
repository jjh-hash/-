// 管理员操作日志工具
/**
 * 记录管理员操作日志
 * @param {String} action - 操作类型（如：商家审核、订单处理、数据导出等）
 * @param {String} target - 操作目标（如：商家名称、订单号等）
 * @param {String} targetType - 目标类型（如：merchant、order、system等）
 * @param {String} result - 操作结果（如：success、failed、approved、rejected等）
 * @param {Object} details - 详细信息（可选）
 */
async function recordAdminLog(action, target, targetType, result, details = {}) {
  try {
    const adminInfo = wx.getStorageSync('adminInfo') || {};
    const adminId = adminInfo.username || 'admin';
    
    // 调用云函数记录日志
    await wx.cloud.callFunction({
      name: 'adminLogManage',
      data: {
        action: 'create',
        data: {
          adminId: adminId,
          action: action,
          target: target,
          targetType: targetType,
          result: result,
          details: details
        }
      }
    });
    
    console.log('操作日志记录成功:', action, target, result);
  } catch (error) {
    console.error('记录操作日志失败:', error);
    // 记录失败不影响主要业务，只记录错误日志
  }
}

/**
 * 记录商家审核操作
 * @param {String} merchantName - 商家名称
 * @param {String} result - 审核结果（approved/rejected/suspended）
 */
async function recordMerchantReview(merchantName, result) {
  await recordAdminLog(
    '商家审核',
    merchantName,
    'merchant',
    result,
    { merchantName: merchantName }
  );
}

/**
 * 记录订单处理操作
 * @param {String} orderNo - 订单号
 * @param {String} action - 处理操作（completed/cancelled/refunded）
 * @param {String} result - 处理结果
 */
async function recordOrderProcess(orderNo, action, result) {
  await recordAdminLog(
    '订单处理',
    orderNo,
    'order',
    result,
    { orderNo: orderNo, action: action }
  );
}

/**
 * 记录数据导出操作
 * @param {String} reportType - 报表类型
 * @param {String} result - 导出结果
 */
async function recordDataExport(reportType, result) {
  await recordAdminLog(
    '数据导出',
    reportType,
    'system',
    result,
    { reportType: reportType }
  );
}

/**
 * 记录系统设置操作
 * @param {String} settingType - 设置类型
 * @param {String} action - 操作（create/update/delete）
 * @param {String} result - 操作结果
 */
async function recordSystemSetting(settingType, action, result) {
  await recordAdminLog(
    '系统设置',
    settingType,
    'system',
    result,
    { settingType: settingType, action: action }
  );
}

/**
 * 记录公告管理操作
 * @param {String} action - 操作（create/update/delete）
 * @param {String} result - 操作结果
 */
async function recordAnnouncementManage(action, result) {
  await recordAdminLog(
    '公告管理',
    '系统公告',
    'system',
    result,
    { action: action }
  );
}

/**
 * 记录邀请码管理操作
 * @param {String} action - 操作（create/delete）
 * @param {String} code - 邀请码
 * @param {String} result - 操作结果
 */
async function recordInviteCodeManage(action, code, result) {
  await recordAdminLog(
    '邀请码管理',
    code,
    'system',
    result,
    { action: action, code: code }
  );
}

/**
 * 记录轮播图管理操作
 * @param {String} action - 操作（create/update/delete）
 * @param {String} result - 操作结果
 */
async function recordBannerManage(action, result) {
  await recordAdminLog(
    '轮播图管理',
    '首页轮播图',
    'system',
    result,
    { action: action }
  );
}

module.exports = {
  recordAdminLog,
  recordMerchantReview,
  recordOrderProcess,
  recordDataExport,
  recordSystemSetting,
  recordAnnouncementManage,
  recordInviteCodeManage,
  recordBannerManage
};

