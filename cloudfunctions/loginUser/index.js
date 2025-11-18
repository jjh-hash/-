// 微信用户登录云函数
const cloud = require('wx-server-sdk');

// 初始化云开发环境
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();

exports.main = async (event, context) => {
  console.log('登录请求参数:', event);
  
  try {
    const { code } = event;
    
    // 1. 参数验证
    if (!code) {
      return {
        code: 2001,
        message: '缺少登录凭证',
        data: null
      };
    }

    // 2. 获取微信用户信息
    const wxContext = cloud.getWXContext();
    const { OPENID, APPID, UNIONID } = wxContext;
    
    console.log('微信上下文信息:', { OPENID, APPID, UNIONID });

    // 3. 验证登录凭证（可选，小程序环境下OPENID已经足够）
    try {
      const loginResult = await cloud.openapi.auth.code2Session({
        jsCode: code
      });
      
      console.log('微信登录验证结果:', loginResult);
      
      // 验证返回的openid是否与上下文一致
      if (loginResult.openid !== OPENID) {
        console.warn('OpenID不一致:', loginResult.openid, OPENID);
      }
    } catch (error) {
      console.warn('登录凭证验证失败，但继续使用上下文OpenID:', error);
    }

    // 4. 查询或创建用户信息
    let userInfo = null;
    let isNewUser = false;
    
    try {
      // 查询现有用户
      const userQuery = await db.collection('users')
        .where({
          openid: OPENID
        })
        .get();
      
      if (userQuery.data.length > 0) {
        // 用户已存在，更新最后登录时间
        userInfo = userQuery.data[0];
        
        await db.collection('users').doc(userInfo._id).update({
          data: {
            lastLoginAt: db.serverDate(),
            updatedAt: db.serverDate()
          }
        });
        
        console.log('用户已存在，更新登录时间:', userInfo.nickname);
        console.log('用户头像:', userInfo.avatar);
        console.log('用户昵称:', userInfo.nickname);
      } else {
        // 新用户，创建用户记录
        const newUserData = {
          openid: OPENID,
          unionid: UNIONID || '',
          nickname: '微信用户',
          avatar: '',
          phone: '',
          email: '',
          campus: '',
          role: 'user',
          status: 'active',
          createdAt: db.serverDate(),
          updatedAt: db.serverDate(),
          lastLoginAt: db.serverDate()
        };
        
        const createResult = await db.collection('users').add({
          data: newUserData
        });
        
        userInfo = {
          _id: createResult._id,
          ...newUserData
        };
        
        isNewUser = true;
        console.log('新用户创建成功:', userInfo);
      }
    } catch (error) {
      console.error('用户信息处理失败:', error);
      return {
        code: 5000,
        message: '用户信息处理失败',
        data: null
      };
    }

    // 5. 生成用户Token（简单的会话标识）
    const token = `user_${OPENID}_${Date.now()}`;
    
    // 6. 记录登录日志
    try {
      await db.collection('user_logs').add({
        data: {
          userId: userInfo._id,
          openid: OPENID,
          action: 'login',
          ip: context.source || 'unknown',
          userAgent: context.userAgent || 'unknown',
          createdAt: new Date()
        }
      });
    } catch (error) {
      console.warn('登录日志记录失败:', error);
    }

    // 7. 返回登录结果
    return {
      code: 0,
      message: '登录成功',
      data: {
        userInfo: {
          _id: userInfo._id,
          openid: userInfo.openid,
          unionid: userInfo.unionid,
          nickname: userInfo.nickname,
          avatar: userInfo.avatar,
          phone: userInfo.phone,
          email: userInfo.email,
          campus: userInfo.campus,
          role: userInfo.role,
          status: userInfo.status,
          createdAt: userInfo.createdAt,
          updatedAt: userInfo.updatedAt,
          lastLoginAt: userInfo.lastLoginAt
        },
        token: token,
        isNewUser: isNewUser
      }
    };

  } catch (error) {
    console.error('登录云函数执行失败:', error);
    
    return {
      code: 5000,
      message: '系统异常，请稍后重试',
      data: null
    };
  }
};
