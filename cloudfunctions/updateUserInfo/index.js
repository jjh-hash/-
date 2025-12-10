// 更新用户信息云函数
const cloud = require('wx-server-sdk');

// 初始化云开发环境
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();

exports.main = async (event, context) => {
  console.log('=== 更新用户信息云函数开始 ===');
  console.log('请求参数:', event);
  
  try {
    const { nickname, avatar, campus, college, major, phone, wechat, qq } = event;
    
    console.log('接收到的昵称:', nickname);
    console.log('接收到的头像:', avatar);
    console.log('接收到的校区:', campus);
    console.log('接收到的学院:', college);
    console.log('接收到的专业:', major);
    console.log('接收到的电话:', phone);
    
    // 1. 参数验证（至少需要昵称）
    if (!nickname || nickname.trim() === '') {
      console.log('参数验证失败：昵称为必填项');
      return {
        code: 2001,
        message: '昵称为必填项',
        data: null
      };
    }

    // 2. 获取微信用户信息
    const wxContext = cloud.getWXContext();
    const { OPENID } = wxContext;
    
    console.log('当前用户OpenID:', OPENID);

    // 3. 查询用户信息
    const userQuery = await db.collection('users')
      .where({
        openid: OPENID
      })
      .get();
    
    if (userQuery.data.length === 0) {
      return {
        code: 2002,
        message: '用户不存在',
        data: null
      };
    }

    const userInfo = userQuery.data[0];
    
    // 4. 构建更新数据
    const updateData = {
      updatedAt: db.serverDate()
    };
    
    // 更新昵称（必填）
    if (nickname !== undefined && nickname !== null && nickname !== '') {
      updateData.nickname = nickname.trim();
      console.log('✓ 准备更新昵称:', updateData.nickname);
    }
    
    // 更新头像
    if (avatar !== undefined && avatar !== null && avatar !== '') {
      updateData.avatar = avatar;
      console.log('✓ 准备更新头像:', avatar);
      if (avatar.length > 10) {
        console.log('✓ 头像URL前10个字符:', avatar.substring(0, 10));
      }
    }
    
    // 更新校区（允许空字符串）
    if (campus !== undefined && campus !== null) {
      updateData.campus = campus === '' ? '' : campus.trim();
      console.log('✓ 准备更新校区:', updateData.campus);
    }
    
    // 更新学院（允许空字符串）
    if (college !== undefined && college !== null) {
      updateData.college = college === '' ? '' : college.trim();
      console.log('✓ 准备更新学院:', updateData.college);
    }
    
    // 更新专业（允许空字符串）
    if (major !== undefined && major !== null) {
      updateData.major = major === '' ? '' : major.trim();
      console.log('✓ 准备更新专业:', updateData.major);
    }
    
    // 更新电话（允许空字符串）
    if (phone !== undefined && phone !== null) {
      updateData.phone = phone === '' ? '' : phone.trim();
      console.log('✓ 准备更新电话:', updateData.phone);
    }
    
    // 更新微信号（允许空字符串）
    if (wechat !== undefined && wechat !== null) {
      updateData.wechat = wechat === '' ? '' : wechat.trim();
      console.log('✓ 准备更新微信号:', updateData.wechat);
    }
    
    // 更新QQ号（允许空字符串）
    if (qq !== undefined && qq !== null) {
      updateData.qq = qq === '' ? '' : qq.trim();
      console.log('✓ 准备更新QQ号:', updateData.qq);
    }
    
    console.log('要更新的数据:', JSON.stringify(updateData, null, 2));
    
    // 5. 更新用户信息
    const updateResult = await db.collection('users').doc(userInfo._id).update({
      data: updateData
    });
    
    console.log('数据库更新结果:', updateResult);
    console.log('更新记录的ID:', userInfo._id);
    
    // 6. 返回更新后的用户信息
    const updatedUserResult = await db.collection('users').doc(userInfo._id).get();
    const updatedUser = updatedUserResult.data;
    
    console.log('=== 更新后的用户信息 ===');
    console.log('用户ID:', updatedUser._id);
    console.log('昵称:', updatedUser.nickname);
    console.log('头像:', updatedUser.avatar);
    console.log('校区:', updatedUser.campus);
    console.log('学院:', updatedUser.college);
    console.log('专业:', updatedUser.major);
    console.log('电话:', updatedUser.phone);
    console.log('头像长度:', updatedUser.avatar ? updatedUser.avatar.length : 0);
    
    return {
      code: 0,
      message: '更新成功',
      data: {
        userInfo: {
          _id: updatedUser._id,
          openid: updatedUser.openid,
          unionid: updatedUser.unionid || '',
          nickname: updatedUser.nickname || '微信用户',
          avatar: updatedUser.avatar || '',
          phone: updatedUser.phone || '',
          email: updatedUser.email || '',
          campus: updatedUser.campus || '',
          college: updatedUser.college || '',
          major: updatedUser.major || '',
          role: updatedUser.role || 'user',
          status: updatedUser.status || 'active',
          createdAt: updatedUser.createdAt,
          updatedAt: updatedUser.updatedAt,
          lastLoginAt: updatedUser.lastLoginAt
        }
      }
    };

  } catch (error) {
    console.error('更新用户信息失败:', error);
    
    return {
      code: 5000,
      message: '系统异常，请稍后重试',
      data: null
    };
  }
};

