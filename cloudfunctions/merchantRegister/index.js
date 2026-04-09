// 商家注册云函数
const cloud = require('wx-server-sdk');
const crypto = require('crypto');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();

exports.main = async (event, context) => {
  console.log('商家注册请求:', event);
  
  try {
    const { shopName, inviteCode, account, password } = event;
    
    // 1. 基础验证
    if (!shopName || !shopName.trim()) {
      return {
        code: 400,
        message: '请输入店铺名称',
        data: null
      };
    }
    
    if (!inviteCode || !inviteCode.trim()) {
      return {
        code: 400,
        message: '请输入邀请码',
        data: null
      };
    }
    
    // 验证账号密码
    if (!account || !account.trim()) {
      return {
        code: 400,
        message: '请输入登录账号',
        data: null
      };
    }
    
    if (!password || !password.trim()) {
      return {
        code: 400,
        message: '请输入登录密码',
        data: null
      };
    }
    
    if (password.length < 6) {
      return {
        code: 400,
        message: '密码至少需要6位',
        data: null
      };
    }
    
    // 检查账号是否已被使用
    const accountCheck = await db.collection('merchants')
      .where({
        account: account.trim()
      })
      .get();
    
    if (accountCheck.data.length > 0) {
      return {
        code: 400,
        message: '该账号已被注册，请使用其他账号',
        data: null
      };
    }
    
    // 2. 检查商家名称是否已存在
    const merchantNameCheck = await db.collection('merchants')
      .where({
        merchantName: shopName.trim()
      })
      .get();
    
    if (merchantNameCheck.data.length > 0) {
      console.log('商家名称已存在:', shopName);
      return {
        code: 400,
        message: '该商家名称已被注册，请使用其他名称',
        data: null
      };
    }
    
    // 3. 验证邀请码
    const inviteCodeResult = await db.collection('invite_codes')
      .where({
        code: inviteCode.trim(),
        status: 'active'
      })
      .get();
    
    if (inviteCodeResult.data.length === 0) {
      console.log('邀请码不存在:', inviteCode);
      return {
        code: 400,
        message: '邀请码不存在或已失效',
        data: null
      };
    }
    
    const inviteCodeData = inviteCodeResult.data[0];
    
    // 检查过期时间
    if (inviteCodeData.expiredAt && new Date() > inviteCodeData.expiredAt) {
      return {
        code: 400,
        message: '邀请码已过期',
        data: null
      };
    }
    
    // 检查使用次数
    if (inviteCodeData.usedCount >= inviteCodeData.maxUses) {
      return {
        code: 400,
        message: '邀请码使用次数已达上限',
        data: null
      };
    }
    
    // 4. 获取微信用户信息
    const wxContext = cloud.getWXContext();
    const { OPENID } = wxContext;
    
    // 5. 同一微信号可注册多个商家（多条 merchants 记录可共用同一 openid）
    
    // 6. 检查并更新用户角色为商家
    const userQuery = await db.collection('users')
      .where({ openid: OPENID })
      .get();
    
    if (userQuery.data.length > 0) {
      // 更新用户角色为商家
      await db.collection('users').doc(userQuery.data[0]._id).update({
        data: {
          role: 'merchant',
          merchantName: shopName.trim(),
          updatedAt: db.serverDate()
        }
      });
      console.log('用户角色已更新为商家');
    } else {
      // 如果用户不存在，创建用户记录
      await db.collection('users').add({
        data: {
          openid: OPENID,
          unionid: '',
          nickname: '商家用户',
          avatar: '',
          phone: '',
          email: '',
          campus: '',
          role: 'merchant',
          merchantName: shopName.trim(),
          status: 'active',
          createdAt: db.serverDate(),
          updatedAt: db.serverDate()
        }
      });
      console.log('创建新用户并标记为商家');
    }
    
    // 7. 加密密码
    const passwordHash = crypto.createHash('sha256')
      .update(password.trim())
      .digest('hex');
    
    // 8. 创建商家记录
    const merchantResult = await db.collection('merchants').add({
      data: {
        openid: OPENID,
        merchantName: shopName.trim(),
        account: account.trim(),
        password: passwordHash, // 存储加密后的密码
        contactPhone: '',
        role: 'owner',
        status: 'pending',
        inviteCodeId: inviteCodeData._id,
        contractStatus: 'unsigned',
        qualificationStatus: 'pending',
        createdAt: db.serverDate(),
        updatedAt: db.serverDate()
      }
    });
    
    // 9. 更新邀请码使用次数
    await db.collection('invite_codes').doc(inviteCodeData._id).update({
      data: {
        usedCount: db.command.inc(1),
        lastUsedAt: db.serverDate(),
        updatedAt: db.serverDate()
      }
    });
    
    // 10. 检查邀请码是否已用完，如果已用完则自动删除
    const updatedInviteCode = await db.collection('invite_codes').doc(inviteCodeData._id).get();
    if (updatedInviteCode.data) {
      const newUsedCount = updatedInviteCode.data.usedCount || 0;
      const maxUses = updatedInviteCode.data.maxUses || 1;
      
      if (newUsedCount >= maxUses) {
        // 邀请码已用完，自动删除
        await db.collection('invite_codes').doc(inviteCodeData._id).remove();
        console.log('邀请码已用完，自动删除:', inviteCodeData.code);
      }
    }
    
    console.log('商家注册成功:', merchantResult._id);
    
    // 获取用户信息（包含头像）
    const userInfo = userQuery.data.length > 0 ? userQuery.data[0] : {};
    
    return {
      code: 200,
      message: '注册成功',
      data: {
        merchant: {
          _id: merchantResult._id,
          merchantName: shopName.trim(),
          contactPhone: '',
          status: 'pending',
          role: 'owner'
        },
        user: {
          _id: userInfo._id || '',
          nickname: userInfo.nickname || '商家用户',
          avatar: userInfo.avatar || '',
          role: 'merchant'
        }
      }
    };
    
  } catch (error) {
    console.error('商家注册失败:', error);
    return {
      code: 500,
      message: '系统异常',
      data: null
    };
  }
};

