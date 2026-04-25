// 更新商家信息云函数
const cloud = require('wx-server-sdk');
const crypto = require('crypto');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();

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

async function resolveAuthorizedMerchant(openid, merchantId, sessionToken) {
  if (merchantId) {
    const doc = await db.collection('merchants').doc(merchantId).get();
    if (!doc.data) return null;
    if (doc.data.openid === openid) return doc.data;
    const tokenOk = await validateMerchantSession(doc.data._id, sessionToken);
    if (tokenOk) return doc.data;
    return null;
  }
  const list = await db.collection('merchants').where({ openid }).limit(1).get();
  if (list.data && list.data.length > 0) return list.data[0];
  return null;
}

exports.main = async (event, context) => {
  console.log('更新商家信息请求:', event);
  
  // 如果是修改密码操作
  if (event.action === 'changePassword') {
    return await changePassword(event);
  }
  
  console.log('接收到的头像参数:', event.avatar);
  
  try {
    const { merchantName, contactPhone, avatar, merchantId, sessionToken } = event;
    
    console.log('解析后的参数 - merchantName:', merchantName);
    console.log('解析后的参数 - contactPhone:', contactPhone);
    console.log('解析后的参数 - avatar:', avatar);
    
    // 获取微信用户信息
    const wxContext = cloud.getWXContext();
    const { OPENID } = wxContext;
    
    console.log('当前用户OpenID:', OPENID);
    
    // 1. 检查商家是否存在并校验权限
    const merchantInfo = await resolveAuthorizedMerchant(OPENID, merchantId, sessionToken);
    if (!merchantInfo) {
      return {
        code: 403,
        message: '无权操作该商家账号',
        data: null
      };
    }
    
    // 2. 构建更新数据
    const updateData = {
      updatedAt: db.serverDate()
    };
    
    // 只更新传入的字段
    if (merchantName !== undefined && merchantName) {
      updateData.merchantName = merchantName.trim();
      console.log('将更新商家名称:', updateData.merchantName);
    }
    
    if (contactPhone !== undefined && contactPhone) {
      updateData.contactPhone = contactPhone.trim();
      console.log('将更新联系方式:', updateData.contactPhone);
    }
    
    if (avatar !== undefined && avatar && avatar.trim() !== '') {
      updateData.avatar = avatar;
      console.log('将更新头像:', updateData.avatar);
    } else {
      console.log('头像参数为空或无效，跳过更新');
    }
    
    console.log('更新数据对象:', updateData);
    
    // 3. 更新商家信息
    await db.collection('merchants').doc(merchantInfo._id).update({
      data: updateData
    });
    
    console.log('商家信息更新成功');
    
    // 4. 返回更新后的商家信息
    const updatedMerchant = await db.collection('merchants')
      .doc(merchantInfo._id)
      .get();
    
    console.log('更新后的商家信息:', updatedMerchant.data);
    console.log('商家头像字段:', updatedMerchant.data.avatar);
    
    return {
      code: 200,
      message: '更新成功',
      data: {
        merchant: {
          _id: updatedMerchant.data._id,
          merchantName: updatedMerchant.data.merchantName,
          contactPhone: updatedMerchant.data.contactPhone,
          avatar: updatedMerchant.data.avatar || '',
          status: updatedMerchant.data.status,
          role: updatedMerchant.data.role
        }
      }
    };
    
  } catch (error) {
    console.error('更新商家信息失败:', error);
    return {
      code: 500,
      message: '系统异常',
      data: null
    };
  }
};

/**
 * 修改商家密码
 */
async function changePassword(event) {
  const { oldPassword, newPassword, merchantId, sessionToken } = event;
  
  // 参数验证
  if (!oldPassword || !newPassword) {
    return {
      code: 400,
      message: '参数不完整',
      data: null
    };
  }
  
  if (newPassword.length < 6) {
    return {
      code: 400,
      message: '新密码至少需要6位',
      data: null
    };
  }
  
  if (newPassword.length > 20) {
    return {
      code: 400,
      message: '新密码不能超过20位',
      data: null
    };
  }
  
  try {
    // 获取微信用户信息
    const wxContext = cloud.getWXContext();
    const { OPENID } = wxContext;
    
    console.log('修改密码请求，OpenID:', OPENID);
    
    // 查找商家账号并校验权限
    const merchant = await resolveAuthorizedMerchant(OPENID, merchantId, sessionToken);
    if (!merchant) {
      return {
        code: 403,
        message: '无权操作该商家账号',
        data: null
      };
    }
    
    console.log('找到商家账号，ID:', merchant._id, '账号:', merchant.account);
    
    // 验证旧密码
    const oldPasswordHash = crypto.createHash('sha256')
      .update(oldPassword.trim())
      .digest('hex');
    
    console.log('验证旧密码，输入密码哈希:', oldPasswordHash);
    console.log('数据库中密码哈希:', merchant.password);
    
    if (merchant.password !== oldPasswordHash) {
      console.error('旧密码验证失败');
      return {
        code: 401,
        message: '旧密码错误',
        data: null
      };
    }
    
    console.log('旧密码验证成功');
    
    // 检查新密码是否与旧密码相同
    const newPasswordHash = crypto.createHash('sha256')
      .update(newPassword.trim())
      .digest('hex');
    
    if (merchant.password === newPasswordHash) {
      return {
        code: 400,
        message: '新密码不能与旧密码相同',
        data: null
      };
    }
    
    console.log('准备更新密码，商家ID:', merchant._id);
    console.log('旧密码哈希:', merchant.password);
    console.log('新密码哈希:', newPasswordHash);
    
    // 更新密码
    const updateResult = await db.collection('merchants').doc(merchant._id).update({
      data: {
        password: newPasswordHash,
        updatedAt: db.serverDate()
      }
    });
    
    console.log('数据库更新结果:', updateResult);
    
    // 验证更新是否成功
    if (updateResult.stats && updateResult.stats.updated === 0) {
      console.error('密码更新失败：数据库更新返回0条记录');
      return {
        code: 500,
        message: '密码更新失败，请重试',
        data: null
      };
    }
    
    // 再次查询验证密码是否真的更新了
    const verifyQuery = await db.collection('merchants').doc(merchant._id).get();
    if (verifyQuery.data) {
      const updatedPasswordHash = verifyQuery.data.password;
      if (updatedPasswordHash !== newPasswordHash) {
        console.error('密码验证失败：数据库中的密码哈希与预期不符');
        console.error('预期哈希:', newPasswordHash);
        console.error('实际哈希:', updatedPasswordHash);
        return {
          code: 500,
          message: '密码更新验证失败，请重试',
          data: null
        };
      }
      console.log('密码更新验证成功');
    } else {
      console.error('密码验证失败：无法获取更新后的商家信息');
      return {
        code: 500,
        message: '密码更新验证失败，请重试',
        data: null
      };
    }
    
    console.log('商家密码修改成功:', merchant.merchantName);
    
    return {
      code: 200,
      message: '密码修改成功',
      data: null
    };
    
  } catch (error) {
    console.error('修改密码失败:', error);
    return {
      code: 500,
      message: '修改密码失败: ' + error.message,
      data: null
    };
  }
}

