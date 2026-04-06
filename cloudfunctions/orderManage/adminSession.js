/**
 * 管理端会话校验（与 admin_accounts 关联）
 * 各云函数目录下各有一份副本，部署时随函数上传。
 */
const crypto = require('crypto');

const SESSION_TTL_MS = 24 * 60 * 60 * 1000;
const COLLECTION = 'admin_sessions';

function extractAdminSessionToken(event) {
  if (!event) return null;
  const d = event.data;
  if (d && typeof d.adminSessionToken === 'string' && d.adminSessionToken) {
    return d.adminSessionToken;
  }
  if (typeof event.adminSessionToken === 'string' && event.adminSessionToken) {
    return event.adminSessionToken;
  }
  return null;
}

async function verifyAdminSession(db, token) {
  if (!token || typeof token !== 'string') {
    return { ok: false, code: 401, message: '缺少管理员会话，请重新登录' };
  }
  try {
    const now = new Date();
    const res = await db
      .collection(COLLECTION)
      .where({
        token,
        expiresAt: db.command.gt(now)
      })
      .limit(1)
      .get();

    if (!res.data || res.data.length === 0) {
      return { ok: false, code: 403, message: '管理员会话无效或已过期，请重新登录' };
    }

    const sess = res.data[0];
    const adminDoc = await db.collection('admin_accounts').doc(sess.adminId).get();
    if (!adminDoc.data || adminDoc.data.status !== 'active') {
      return { ok: false, code: 403, message: '管理员账号不可用' };
    }

    const raw = adminDoc.data;
    const admin = Object.assign({}, raw);
    delete admin.password;
    return { ok: true, admin, session: sess };
  } catch (e) {
    console.error('verifyAdminSession error:', e);
    return { ok: false, code: 500, message: '会话校验失败' };
  }
}

function deny(v) {
  return { code: v.code, message: v.message, data: null };
}

function newSessionToken() {
  return crypto.randomBytes(32).toString('hex');
}

module.exports = {
  SESSION_TTL_MS,
  COLLECTION,
  extractAdminSessionToken,
  verifyAdminSession,
  deny,
  newSessionToken
};
