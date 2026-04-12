/**
 * 用户取消选择头像或基础库返回失败时，不应再走下载/上传逻辑（Windows 开发者工具常见 chooseAvatar:fail cancel）
 */
function shouldIgnoreChooseAvatarDetail(detail) {
  const d = detail || {};
  const msg = String(d.errMsg || d.errorMessage || '');
  if (/cancel|fail\s+cancel/i.test(msg)) return true;
  const url = d.avatarUrl;
  if (url === undefined || url === null) return true;
  if (typeof url === 'string' && url.trim() === '') return true;
  return false;
}

module.exports = {
  shouldIgnoreChooseAvatarDetail
};
