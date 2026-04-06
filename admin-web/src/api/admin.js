import { callAdminFunction } from '../cloud'

export const statistics = {
  getDashboardStats: (data = {}) =>
    callAdminFunction('statistics', { action: 'getDashboardStats', data }),
  getAdminOverviewStats: (data = {}) =>
    callAdminFunction('statistics', { action: 'getAdminOverviewStats', data }),
  getAdminOrderStats: (data) =>
    callAdminFunction('statistics', { action: 'getAdminOrderStats', data }),
  getAdminUserStats: (data) =>
    callAdminFunction('statistics', { action: 'getAdminUserStats', data }),
  getAdminMerchantStats: (data) =>
    callAdminFunction('statistics', { action: 'getAdminMerchantStats', data }),
  getAdminFinanceStats: (data) =>
    callAdminFunction('statistics', { action: 'getAdminFinanceStats', data })
}

export const orderManage = {
  getAdminOrderList: (data) =>
    callAdminFunction('orderManage', { action: 'getAdminOrderList', data }),
  cancelOrder: (data) => callAdminFunction('orderManage', { action: 'cancelOrder', data }),
  completeOrder: (data) => callAdminFunction('orderManage', { action: 'completeOrder', data })
}

export const refundManage = {
  getRefundDetail: (data) =>
    callAdminFunction('refundManage', { action: 'getRefundDetail', data })
}

export const merchantManage = {
  getList: (data) => callAdminFunction('merchantManage', { action: 'getList', data }),
  getDetail: (data) => callAdminFunction('merchantManage', { action: 'getDetail', data }),
  approve: (merchantId) =>
    callAdminFunction('merchantManage', { action: 'approve', data: { merchantId } }),
  reject: (merchantId) =>
    callAdminFunction('merchantManage', { action: 'reject', data: { merchantId } }),
  suspend: (merchantId) =>
    callAdminFunction('merchantManage', { action: 'suspend', data: { merchantId } }),
  resume: (merchantId) =>
    callAdminFunction('merchantManage', { action: 'resume', data: { merchantId } }),
  delete: (merchantId) =>
    callAdminFunction('merchantManage', { action: 'delete', data: { merchantId } })
}

export const userManage = {
  getList: (data) => callAdminFunction('userManage', { action: 'getList', data }),
  getDetail: (data) => callAdminFunction('userManage', { action: 'getDetail', data }),
  banUser: (data) => callAdminFunction('userManage', { action: 'banUser', data }),
  unbanUser: (data) => callAdminFunction('userManage', { action: 'unbanUser', data })
}

export const riderManage = {
  getRiderList: (data) => callAdminFunction('riderManage', { action: 'getRiderList', data }),
  auditRider: (data) => callAdminFunction('riderManage', { action: 'auditRider', data })
}

export const platformConfig = {
  getConfig: (data = {}) =>
    callAdminFunction('platformConfig', { action: 'getConfig', data }),
  updateConfig: (data) =>
    callAdminFunction('platformConfig', { action: 'updateConfig', data })
}

export const inviteCodeManage = {
  getList: (data = {}) =>
    callAdminFunction('inviteCodeManage', { action: 'getList', data }),
  create: (data) => callAdminFunction('inviteCodeManage', { action: 'create', data }),
  delete: (codeId) =>
    callAdminFunction('inviteCodeManage', { action: 'delete', data: { codeId } })
}

export const bannerManage = {
  getList: (data = {}) => callAdminFunction('bannerManage', { action: 'getList', data }),
  create: (data) => callAdminFunction('bannerManage', { action: 'create', data }),
  update: (data) => callAdminFunction('bannerManage', { action: 'update', data }),
  delete: (bannerId) =>
    callAdminFunction('bannerManage', { action: 'delete', data: { bannerId } })
}

export const announcementManage = {
  getList: (data = {}) =>
    callAdminFunction('announcementManage', { action: 'getList', data }),
  create: (data) => callAdminFunction('announcementManage', { action: 'create', data }),
  update: (data) => callAdminFunction('announcementManage', { action: 'update', data }),
  delete: (announcementId) =>
    callAdminFunction('announcementManage', {
      action: 'delete',
      data: { announcementId }
    })
}

export const productManage = {
  getProductsForAudit: (data) =>
    callAdminFunction('productManage', { action: 'getProductsForAudit', data }),
  batchAuditProducts: (data) =>
    callAdminFunction('productManage', { action: 'batchAuditProducts', data })
}

export const adminLogManage = {
  getList: (data) => callAdminFunction('adminLogManage', { action: 'getList', data })
}

export const adminManage = {
  changePassword: (data) =>
    callAdminFunction('adminManage', { action: 'changePassword', data })
}
