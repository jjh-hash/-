/** 与小程序管理端一致：订单类常为 code 0，其余多为 200 */
export function isAdminOk(res) {
  return !!(res && (res.code === 200 || res.code === 0))
}
