// 骑手注册云函数
const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  const { name, phone, gender, vehicle, inviteCode } = event;

  console.log('【骑手注册】请求:', { name, phone, gender, vehicle, openid });
  console.log('【骑手注册】性别值验证:', { 
    gender, 
    isMale: gender === 'male', 
    isFemale: gender === 'female',
    isValid: gender === 'male' || gender === 'female'
  });

  try {
    // 验证必填字段
    if (!name || !name.trim()) {
      return {
        code: 400,
        message: '请输入姓名'
      };
    }
    if (!phone || !/^1\d{10}$/.test(phone.trim())) {
      return {
        code: 400,
        message: '请输入正确的手机号'
      };
    }
    if (!gender || !['male', 'female'].includes(gender)) {
      return {
        code: 400,
        message: '请选择性别'
      };
    }
    if (!vehicle || !vehicle.trim()) {
      return {
        code: 400,
        message: '请输入配送工具'
      };
    }

    // 检查是否已经注册过骑手
    let existingRider;
    try {
      const riderQuery = await db.collection('riders')
        .where({ openid: openid })
        .get();
      
      if (riderQuery.data && riderQuery.data.length > 0) {
        existingRider = riderQuery.data[0];
      }
    } catch (error) {
      // 如果集合不存在，继续创建
      if (error.errCode !== -502005 && !error.message.includes('collection not exist')) {
        throw error;
      }
    }

    if (existingRider) {
      // 如果已存在，更新信息
      // 如果之前被拒绝，允许重新提交（状态重置为 pending）
      // 如果之前已通过，不允许重新注册（保持 approved 状态）
      const currentStatus = existingRider.status || 'pending';
      let newStatus = 'pending';
      let message = '注册信息已更新，待审核';
      
      if (currentStatus === 'approved') {
        // 如果已经审核通过，不允许重新注册，保持通过状态
        newStatus = 'approved';
        message = '您已经通过审核，无需重新注册';
      } else {
        // 如果之前是 pending 或 rejected，允许重新提交
        newStatus = 'pending';
        if (currentStatus === 'rejected') {
          message = '注册信息已更新，待重新审核';
        }
      }
      
      const updateData = {
        name: name.trim(),
        phone: phone.trim(),
        gender: gender, // 确保保存正确的性别值
        vehicle: vehicle.trim(),
        status: newStatus, // 重新提交时重置为待审核（如果之前不是已通过）
        updatedAt: db.serverDate()
      };
      
      console.log('【骑手注册】更新数据:', { riderId: existingRider._id, updateData });
      
      await db.collection('riders').doc(existingRider._id).update({
        data: updateData
      });
      
      console.log('【骑手注册】更新成功，性别:', gender);
      
      return {
        code: 200,
        message: message,
        data: {
          riderId: existingRider._id,
          status: newStatus
        }
      };
    } else {
      // 创建新的骑手记录
      // 注意：如果集合不存在，add 方法会自动创建集合
      // 如果仍然失败，请检查：
      // 1. 云函数是否已正确部署（右键 cloudfunctions/riderRegister -> 上传并部署：云端安装依赖）
      // 2. 数据库权限是否允许创建集合
      const riderData = {
        openid: openid,
        name: name.trim(),
        phone: phone.trim(),
        gender: gender, // 确保保存正确的性别值
        vehicle: vehicle.trim(),
        status: 'pending',
        createdAt: db.serverDate(),
        updatedAt: db.serverDate()
      };
      
      console.log('【骑手注册】准备保存的数据:', riderData);
      
      const riderResult = await db.collection('riders').add({
        data: riderData
      });

      console.log('【骑手注册】创建成功，骑手ID:', riderResult._id, '性别:', gender);

      return {
        code: 200,
        message: '注册成功，待审核',
        data: {
          riderId: riderResult._id
        }
      };
    }
  } catch (error) {
    console.error('【骑手注册】失败:', error);
    return {
      code: 500,
      message: '注册失败: ' + error.message
    };
  }
};

