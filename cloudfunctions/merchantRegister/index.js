// 云函数：商家注册
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const { shopName, inviteCode } = event
  const { OPENID } = cloud.getWXContext()
  
  try {
    // 1. 参数校验
    if (!shopName || !inviteCode) {
      return {
        code: 2001,
        message: '参数不完整',
        data: null
      }
    }
    
    // 2. 验证邀请码
    const inviteCodeResult = await validateInviteCode(inviteCode)
    if (!inviteCodeResult.valid) {
      return {
        code: 2002,
        message: inviteCodeResult.message,
        data: null
      }
    }
    
    // 3. 检查是否已注册
    const existingMerchant = await db.collection('merchants')
      .where({ openid: OPENID })
      .get()
    
    if (existingMerchant.data.length > 0) {
      return {
        code: 2003,
        message: '您已经注册过商家账号',
        data: null
      }
    }
    
    // 4. 创建商家记录
    const merchantData = {
      openid: OPENID,
      account: '', // 后续设置
      password: '', // 后续设置
      merchantName: shopName,
      contactPhone: '',
      role: 'owner',
      status: 'pending', // 待审核
      storeId: '', // 后续创建店铺时设置
      inviteCodeId: inviteCodeResult.inviteCodeId,
      subMchId: '', // 后续微信支付设置
      contractStatus: 'unsigned',
      bankAccount: {},
      qualificationStatus: 'pending',
      createdAt: new Date(),
      updatedAt: new Date()
    }
    
    const result = await db.collection('merchants').add({
      data: merchantData
    })
    
    // 5. 更新邀请码使用次数
    await updateInviteCodeUsage(inviteCodeResult.inviteCodeId)
    
    // 6. 记录操作日志
    await db.collection('merchant_logs').add({
      data: {
        merchantId: result._id,
        action: 'register',
        details: {
          shopName: shopName,
          inviteCode: inviteCode
        },
        ip: context.source,
        createdAt: new Date()
      }
    })
    
    return {
      code: 0,
      message: '注册申请提交成功，等待审核',
      data: {
        merchantId: result._id,
        status: 'pending'
      }
    }
    
  } catch (error) {
    console.error('商家注册失败:', error)
    return {
      code: 5000,
      message: '系统异常',
      data: error.message
    }
  }
}

// 验证邀请码
async function validateInviteCode(inviteCode) {
  try {
    // 查询邀请码
    const inviteCodeResult = await db.collection('invite_codes')
      .where({ 
        code: inviteCode,
        status: 'active'
      })
      .get()
    
    if (inviteCodeResult.data.length === 0) {
      return {
        valid: false,
        message: '邀请码不存在或已失效'
      }
    }
    
    const inviteCodeData = inviteCodeResult.data[0]
    
    // 检查是否过期
    if (inviteCodeData.expiredAt && new Date() > inviteCodeData.expiredAt) {
      return {
        valid: false,
        message: '邀请码已过期'
      }
    }
    
    // 检查使用次数
    if (inviteCodeData.usedCount >= inviteCodeData.maxUses) {
      return {
        valid: false,
        message: '邀请码使用次数已达上限'
      }
    }
    
    return {
      valid: true,
      inviteCodeId: inviteCodeData._id
    }
    
  } catch (error) {
    console.error('验证邀请码失败:', error)
    return {
      valid: false,
      message: '邀请码验证失败'
    }
  }
}

// 更新邀请码使用次数
async function updateInviteCodeUsage(inviteCodeId) {
  try {
    await db.collection('invite_codes').doc(inviteCodeId).update({
      data: {
        usedCount: db.command.inc(1),
        lastUsedAt: new Date(),
        updatedAt: new Date()
      }
    })
  } catch (error) {
    console.error('更新邀请码使用次数失败:', error)
  }
}
