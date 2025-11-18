// 地址管理云函数
const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();

// 用户ID缓存（避免重复查询）
const userIdCache = new Map();

/**
 * 获取或创建用户ID（优化版本）
 */
async function getUserId(openid) {
  // 先查缓存
  if (userIdCache.has(openid)) {
    return userIdCache.get(openid);
  }
  
  // 查询用户信息（只返回_id字段，减少数据传输）
  const user = await db.collection('users')
    .where({ openid })
    .field({ _id: true })
    .get();

  let userId;
  if (!user.data || user.data.length === 0) {
    // 创建新用户（只创建必要字段）
    const createUser = await db.collection('users').add({
      data: {
        openid: openid,
        createdAt: db.serverDate(),
        updatedAt: db.serverDate()
      }
    });
    userId = createUser._id;
  } else {
    userId = user.data[0]._id;
  }
  
  // 缓存用户ID（设置30分钟过期）
  userIdCache.set(openid, userId);
  setTimeout(() => userIdCache.delete(openid), 30 * 60 * 1000);
  
  return userId;
}

exports.main = async (event, context) => {
  try {
    const { OPENID } = cloud.getWXContext();
    const { action, data } = event;
    
    console.log('【地址管理】请求:', { action, data, openid: OPENID });
    
    // 参数验证
    if (!action) {
      return {
        code: 400,
        message: '缺少action参数'
      };
    }
    
    let result;
    
    // 根据action执行不同操作
    switch (action) {
      case 'addAddress':
        result = await addAddress(OPENID, data);
        break;
      case 'getAddressList':
        result = await getAddressList(OPENID, data);
        break;
      case 'updateAddress':
        result = await updateAddress(OPENID, data);
        break;
      case 'deleteAddress':
        result = await deleteAddress(OPENID, data);
        break;
      case 'setDefaultAddress':
        result = await setDefaultAddress(OPENID, data);
        break;
      default:
        console.warn('【地址管理】无效的操作类型:', action);
        result = {
          code: 400,
          message: '无效的操作类型',
          action: action
        };
    }
    
    console.log('【地址管理】返回结果:', result);
    return result;
    
  } catch (error) {
    console.error('【地址管理】异常:', error);
    return {
      code: 500,
      message: '系统异常',
      error: error.message,
      stack: error.stack
    };
  }
};

/**
 * 添加地址
 */
async function addAddress(openid, data) {
  try {
    const { addressDetail, buildingName, houseNumber, name, phone, isDefault } = data;
    
    console.log('【添加地址】接收到的参数:', data);
    
    // 参数验证
    if (!addressDetail || !name || !phone) {
      return {
        code: 400,
        message: '缺少必要参数',
        details: {
          hasAddressDetail: !!addressDetail,
          hasName: !!name,
          hasPhone: !!phone
        }
      };
    }
    
    // 使用优化的用户ID获取方法
    const userId = await getUserId(openid);
    
    // 如果设置为默认地址，先取消其他默认地址（使用事务或批量更新）
    if (isDefault) {
      await db.collection('addresses')
        .where({
          userId: userId,
          isDefault: true
        })
        .update({
          data: {
            isDefault: false,
            updatedAt: db.serverDate()
          }
        });
    }
    
    // 创建地址数据
    const addressData = {
      userId: userId,
      userOpenid: openid,
      addressDetail: addressDetail,
      buildingName: buildingName || '',
      houseNumber: houseNumber || '',
      name: name,
      phone: phone,
      isDefault: isDefault || false,
      createdAt: db.serverDate(),
      updatedAt: db.serverDate()
    };
    
    console.log('【添加地址】地址数据:', addressData);
    
    // 保存地址到数据库
    const result = await db.collection('addresses').add({
      data: addressData
    }).catch(async (err) => {
      if (err.errCode === -502005) {
        console.log('【添加地址】地址集合不存在，尝试创建...');
        throw new Error('数据库集合addresses不存在，请在云开发控制台创建该集合');
      }
      throw err;
    });
    
    console.log('【添加地址】地址创建成功，ID:', result._id);
    
    return {
      code: 200,
      message: '地址添加成功',
      data: {
        addressId: result._id
      }
    };
    
  } catch (error) {
    console.error('【添加地址】异常:', error);
    return {
      code: 500,
      message: '添加地址失败',
      error: error.message
    };
  }
}

/**
 * 获取地址列表（优化版本：使用字段投影减少数据传输）
 */
async function getAddressList(openid, data) {
  try {
    console.log('【获取地址列表】参数:', data);
    
    // 使用优化的用户ID获取方法
    const userId = await getUserId(openid);
    
    // 查询地址列表（只返回必要字段，减少数据传输量）
    const result = await db.collection('addresses')
      .where({ userId })
      .field({
        _id: true,
        name: true,
        phone: true,
        buildingName: true,
        houseNumber: true,
        addressDetail: true,
        isDefault: true,
        createdAt: true
      })
      .orderBy('isDefault', 'desc')
      .orderBy('createdAt', 'desc')
      .get();
    
    console.log('【获取地址列表】查询结果:', result.data.length, '条');
    
    return {
      code: 200,
      message: 'ok',
      data: {
        list: result.data
      }
    };
    
  } catch (error) {
    console.error('【获取地址列表】异常:', error);
    return {
      code: 500,
      message: '获取地址列表失败',
      error: error.message
    };
  }
}

/**
 * 更新地址（优化版本）
 */
async function updateAddress(openid, data) {
  try {
    const { addressId, addressDetail, buildingName, houseNumber, name, phone, isDefault } = data;
    
    console.log('【更新地址】参数:', data);
    
    if (!addressId) {
      return {
        code: 400,
        message: '缺少地址ID'
      };
    }
    
    // 使用优化的用户ID获取方法
    const userId = await getUserId(openid);
    
    // 构建更新数据
    const updateData = {
      updatedAt: db.serverDate()
    };
    
    if (addressDetail !== undefined) updateData.addressDetail = addressDetail;
    if (buildingName !== undefined) updateData.buildingName = buildingName;
    if (houseNumber !== undefined) updateData.houseNumber = houseNumber;
    if (name !== undefined) updateData.name = name;
    if (phone !== undefined) updateData.phone = phone;
    if (isDefault !== undefined) updateData.isDefault = isDefault;
    
    // 如果设置为默认地址，先取消其他默认地址
    if (isDefault) {
      await db.collection('addresses')
        .where({
          userId: userId,
          isDefault: true,
          _id: db.command.neq(addressId)
        })
        .update({
          data: {
            isDefault: false,
            updatedAt: db.serverDate()
          }
        });
    }
    
    // 更新地址
    await db.collection('addresses').doc(addressId).update({
      data: updateData
    });
    
    console.log('【更新地址】更新成功');
    
    return {
      code: 200,
      message: '地址更新成功'
    };
    
  } catch (error) {
    console.error('【更新地址】异常:', error);
    return {
      code: 500,
      message: '更新地址失败',
      error: error.message
    };
  }
}

/**
 * 删除地址
 */
async function deleteAddress(openid, data) {
  try {
    const { addressId } = data;
    
    console.log('【删除地址】参数:', data);
    
    if (!addressId) {
      return {
        code: 400,
        message: '缺少地址ID'
      };
    }
    
    // 删除地址
    await db.collection('addresses').doc(addressId).remove();
    
    console.log('【删除地址】删除成功');
    
    return {
      code: 200,
      message: '地址删除成功'
    };
    
  } catch (error) {
    console.error('【删除地址】异常:', error);
    return {
      code: 500,
      message: '删除地址失败',
      error: error.message
    };
  }
}

/**
 * 设置默认地址（优化版本：使用批量操作）
 */
async function setDefaultAddress(openid, data) {
  try {
    const { addressId } = data;
    
    console.log('【设置默认地址】参数:', data);
    
    if (!addressId) {
      return {
        code: 400,
        message: '缺少地址ID'
      };
    }
    
    // 使用优化的用户ID获取方法
    const userId = await getUserId(openid);
    
    // 使用Promise.all并行执行，提高性能
    await Promise.all([
      // 先取消所有默认地址
      db.collection('addresses')
        .where({
          userId: userId,
          isDefault: true,
          _id: db.command.neq(addressId)
        })
        .update({
          data: {
            isDefault: false,
            updatedAt: db.serverDate()
          }
        }),
      // 设置新的默认地址
      db.collection('addresses').doc(addressId).update({
        data: {
          isDefault: true,
          updatedAt: db.serverDate()
        }
      })
    ]);
    
    console.log('【设置默认地址】设置成功');
    
    return {
      code: 200,
      message: '默认地址设置成功'
    };
    
  } catch (error) {
    console.error('【设置默认地址】异常:', error);
    return {
      code: 500,
      message: '设置默认地址失败',
      error: error.message
    };
  }
}

