// 店铺管理云函数
const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV // 使用当前云环境
});

const db = cloud.database();

exports.main = async (event, context) => {
  try {
    const { OPENID } = cloud.getWXContext();
    const { action, data } = event;
    
    console.log('【店铺管理】请求:', { action, data, openid: OPENID });
    
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
      case 'getStoreInfo':
        result = await getStoreInfo(OPENID, data);
        break;
      case 'updateStoreInfo':
        result = await updateStoreInfo(OPENID, data);
        break;
      case 'getStoreDetail':
        result = await getStoreDetail(OPENID, data);
        break;
      case 'getStoreDetailWithProducts':
        result = await getStoreDetailWithProducts(OPENID, data);
        break;
      case 'updateBusinessHours':
        result = await updateBusinessHours(OPENID, data);
        break;
      case 'updateBusinessStatus':
        result = await updateBusinessStatus(OPENID, data);
        break;
      case 'updateAutoAccept':
        result = await updateAutoAccept(OPENID, data);
        break;
      case 'updateStoreAnnouncement':
        result = await updateStoreAnnouncement(OPENID, data);
        break;
      default:
        console.warn('【店铺管理】无效的操作类型:', action);
        result = {
          code: 400,
          message: '无效的操作类型',
          action: action
        };
    }
    
    console.log('【店铺管理】返回结果:', result);
    return result;
    
  } catch (error) {
    console.error('【店铺管理】异常:', error);
    return {
      code: 500,
      message: '系统异常',
      error: error.message,
      stack: error.stack
    };
  }
};

/**
 * 获取店铺信息（商家端）
 */
async function getStoreInfo(openid, data) {
  const { merchantId } = data || {};
  
  console.log('【获取店铺信息】参数:', { openid, merchantId });
  
  let merchantInfo = null;
  
  // 如果提供了 merchantId，优先使用 merchantId 查询
  if (merchantId) {
    console.log('【获取店铺信息】使用提供的 merchantId:', merchantId);
    const merchant = await db.collection('merchants').doc(merchantId).get();
    if (merchant.data) {
      merchantInfo = merchant.data;
    }
  }
  
  // 如果没有提供 merchantId 或查询失败，使用 openid 查询（微信登录场景）
  if (!merchantInfo) {
    console.log('【获取店铺信息】使用 openid 查询商家:', openid);
    const merchant = await db.collection('merchants')
      .where({ openid })
      .get();
    
    if (!merchant.data.length) {
      return {
        code: 404,
        message: '商家不存在'
      };
    }
    
    merchantInfo = merchant.data[0];
  }
  
  let storeId = merchantInfo.storeId || merchantInfo._id;
  
  console.log('【获取店铺信息】店铺ID:', storeId);
  
  // 2. 查询或创建店铺信息
  let store = null;
  try {
    store = await db.collection('stores').doc(storeId).get();
  } catch (error) {
    console.log('【获取店铺信息】查询店铺失败:', error.message);
    // 如果 storeId 无效，清空它，让系统重新创建
    if (merchantInfo.storeId) {
      await db.collection('merchants').doc(merchantInfo._id).update({
        data: {
          storeId: '',
          updatedAt: db.serverDate()
        }
      });
      storeId = merchantInfo._id; // 使用商家ID作为新店铺ID
    }
    store = { data: null };
  }
  
  if (!store.data) {
    // 先检查是否已经存在相同 merchantId 的店铺（防止重复创建）
    const existingStoreQuery = await db.collection('stores')
      .where({
        merchantId: merchantInfo._id
      })
      .get();
    
    if (existingStoreQuery.data && existingStoreQuery.data.length > 0) {
      // 如果已存在店铺，使用已存在的店铺
      console.log('【获取店铺信息】发现已存在的店铺，使用已有店铺:', existingStoreQuery.data[0]._id);
      const existingStore = existingStoreQuery.data[0];
      storeId = existingStore._id;
      
      // 更新商家记录的 storeId（如果不同）
      if (merchantInfo.storeId !== storeId) {
        await db.collection('merchants').doc(merchantInfo._id).update({
          data: {
            storeId: storeId,
            updatedAt: db.serverDate()
          }
        });
        console.log('【获取店铺信息】已更新商家记录的 storeId');
      }
      
      store = { data: existingStore };
    } else {
      // 如果不存在，创建默认店铺信息
      console.log('【获取店铺信息】店铺不存在，创建新店铺');
      const createResult = await db.collection('stores').add({
        data: {
          merchantId: merchantInfo._id,
          name: merchantInfo.merchantName || '我的店铺',
          logoUrl: merchantInfo.avatar || '',
          avatar: merchantInfo.avatar || '', // 新增：兼容字段
          announcement: '',
          businessStatus: 'open',
          businessHours: {
            startTime: '09:00',
            endTime: '22:00'
          },
          deliveryArea: '校园内配送',
          address: '未设置店铺地址', // 新增：店铺地址
          storeCategory: '其他', // 店铺分类，默认"其他"
          category: '未设置经营分类', // 新增：经营分类
          minOrderAmount: 20,
          deliveryFee: 3,
          autoAccept: false, // 默认关闭自动接单
          ratingAvg: 0,
          ratingCount: 0,
          createdAt: db.serverDate(),
          updatedAt: db.serverDate()
        }
      });
      
      // 更新商家storeId
      await db.collection('merchants').doc(merchantInfo._id).update({
        data: {
          storeId: createResult._id,
          updatedAt: db.serverDate()
        }
      });
      
      storeId = createResult._id;
      store = await db.collection('stores').doc(storeId).get();
    }
  }
  
  // 3. 合并商家信息和店铺信息
  const storeInfo = {
    ...store.data,
    merchantName: merchantInfo.merchantName,
    contactPhone: merchantInfo.contactPhone,
    avatar: store.data.avatar || store.data.logoUrl || merchantInfo.avatar || ''
  };
  
  console.log('【获取店铺信息】返回数据:', storeInfo);
  
  return {
    code: 200,
    message: 'ok',
    data: { storeInfo }
  };
}

/**
 * 更新店铺信息（商家端）
 */
async function updateStoreInfo(openid, data) {
  const { merchantName, contactPhone, avatar, name, announcement, address, storeCategory, category, minOrderAmount, merchantId } = data;
  
  console.log('【更新店铺信息】接收到的参数:', data);
  console.log('【更新店铺信息】商家OpenID:', openid, 'merchantId:', merchantId);
  
  // 1. 查询商家信息
  let merchantInfo = null;
  
  // 如果提供了 merchantId，优先使用 merchantId 查询
  if (merchantId) {
    console.log('【更新店铺信息】使用提供的 merchantId:', merchantId);
    const merchant = await db.collection('merchants').doc(merchantId).get();
    if (merchant.data) {
      merchantInfo = merchant.data;
    }
  }
  
  // 如果没有提供 merchantId 或查询失败，使用 openid 查询（微信登录场景）
  if (!merchantInfo) {
    console.log('【更新店铺信息】使用 openid 查询商家:', openid);
    const merchant = await db.collection('merchants')
      .where({ openid })
      .get();
    
    if (!merchant.data.length) {
      return {
        code: 404,
        message: '商家不存在'
      };
    }
    
    merchantInfo = merchant.data[0];
  }
  
  let storeId = merchantInfo.storeId || merchantInfo._id;
  
  console.log('【更新店铺信息】商家ID:', merchantInfo._id);
  console.log('【更新店铺信息】店铺ID:', storeId);
  
  // 2. 更新商家信息
  const merchantUpdateData = {
    updatedAt: db.serverDate()
  };
  
  if (merchantName !== undefined) {
    merchantUpdateData.merchantName = merchantName;
  }
  
  if (contactPhone !== undefined) {
    merchantUpdateData.contactPhone = contactPhone;
  }
  
  if (avatar !== undefined && avatar && avatar.trim() !== '') {
    merchantUpdateData.avatar = avatar;
    console.log('【更新店铺信息】更新商家头像:', avatar);
  }
  
  await db.collection('merchants').doc(merchantInfo._id).update({
    data: merchantUpdateData
  });
  
  console.log('【更新店铺信息】商家信息更新完成');
  
  // 3. 检查店铺是否存在，不存在则创建
  let store = null;
  try {
    store = await db.collection('stores').doc(storeId).get();
  } catch (error) {
    console.log('【更新店铺信息】查询店铺失败:', error.message);
    store = { data: null };
  }
  
  if (!store.data) {
    // 先检查是否已经存在相同 merchantId 的店铺（防止重复创建）
    const existingStoreQuery = await db.collection('stores')
      .where({
        merchantId: merchantInfo._id
      })
      .get();
    
    if (existingStoreQuery.data && existingStoreQuery.data.length > 0) {
      // 如果已存在店铺，使用已存在的店铺并更新信息
      console.log('【更新店铺信息】发现已存在的店铺，使用已有店铺:', existingStoreQuery.data[0]._id);
      storeId = existingStoreQuery.data[0]._id;
      
      // 更新商家记录的 storeId（如果不同）
      if (merchantInfo.storeId !== storeId) {
        await db.collection('merchants').doc(merchantInfo._id).update({
          data: {
            storeId: storeId,
            updatedAt: db.serverDate()
          }
        });
      }
      
      // 继续执行更新逻辑，使用已存在的店铺
      store = await db.collection('stores').doc(storeId).get();
    } else {
      // 如果不存在，创建新店铺
      console.log('【更新店铺信息】店铺不存在，正在创建...');
      const createResult = await db.collection('stores').add({
        data: {
          merchantId: merchantInfo._id,
          name: name || merchantName || '我的店铺',
          logoUrl: avatar || '',
          avatar: avatar || '',
          announcement: announcement || '',
          businessStatus: 'open',
          businessHours: {
            startTime: '09:00',
            endTime: '22:00'
          },
          deliveryArea: address || '校园内配送',
          address: address || '未设置店铺地址',
          storeCategory: storeCategory || '其他', // 店铺分类
          category: category || '未设置经营分类',
          minOrderAmount: minOrderAmount ? parseFloat(minOrderAmount) : 20,
          deliveryFee: 3,
          ratingAvg: 0,
          ratingCount: 0,
          createdAt: db.serverDate(),
          updatedAt: db.serverDate()
        }
      });
      
      storeId = createResult._id;
      
      // 更新商家的storeId
      await db.collection('merchants').doc(merchantInfo._id).update({
        data: {
          storeId: storeId,
          updatedAt: db.serverDate()
        }
      });
      
      console.log('【更新店铺信息】店铺创建成功，ID:', storeId);
      return {
        code: 200,
        message: '店铺创建成功'
      };
    }
  }
  
  // 4. 更新店铺信息
  const storeUpdateData = {
    updatedAt: db.serverDate()
  };
  
  if (name !== undefined) {
    storeUpdateData.name = name;
  }
  
  if (announcement !== undefined) {
    storeUpdateData.announcement = announcement;
  }
  
  if (address !== undefined) {
    storeUpdateData.deliveryArea = address;
    storeUpdateData.address = address;
  }
  
  // 更新店铺分类（5个选项：学校食堂、生鲜水果、校园超市、奶茶果汁、其他）
  // "其他"分类只在首页显示，不在分类页面显示
  if (storeCategory !== undefined) {
    storeUpdateData.storeCategory = storeCategory;
    console.log('【更新店铺信息】更新店铺分类:', storeCategory);
  }
  
  if (category !== undefined) {
    storeUpdateData.category = category;
  }
  
  if (minOrderAmount !== undefined) {
    storeUpdateData.minOrderAmount = parseFloat(minOrderAmount);
  }
  
  if (avatar !== undefined && avatar && avatar.trim() !== '') {
    storeUpdateData.logoUrl = avatar;
    storeUpdateData.avatar = avatar;
    console.log('【更新店铺信息】更新店铺头像:', avatar);
  }
  
  await db.collection('stores').doc(storeId).update({
    data: storeUpdateData
  });
  
  console.log('【更新店铺信息】店铺信息更新完成');
  console.log('【更新店铺信息】更新数据:', storeUpdateData);
  
  return {
    code: 200,
    message: '更新成功'
  };
}

/**
 * 获取店铺详情（客户端）
 */
async function getStoreDetail(openid, data) {
  try {
    const { storeId } = data;
    
    console.log('【获取店铺详情】店铺ID:', storeId);
    console.log('【获取店铺详情】用户OpenID:', openid);
    
    // 如果没有传入storeId，尝试通过openid查找商家的店铺
    let targetStoreId = storeId;
    
    if (!targetStoreId) {
      console.log('【获取店铺详情】未提供storeId，尝试通过openid查找商家店铺');
      
      // 通过openid查找商家
      const merchant = await db.collection('merchants')
        .where({ openid })
        .get();
      
      if (merchant.data && merchant.data.length > 0) {
        targetStoreId = merchant.data[0].storeId || merchant.data[0]._id;
        console.log('【获取店铺详情】找到商家店铺ID:', targetStoreId);
      } else {
        return {
          code: 404,
          message: '未找到您的店铺，请先创建店铺'
        };
      }
    }
    
    // 查询店铺信息
    let store;
    try {
      store = await db.collection('stores').doc(targetStoreId).get();
    } catch (error) {
      console.error('【获取店铺详情】查询店铺失败:', error);
      
      // 如果查询失败，可能是ID格式不对，尝试作为普通字段查询
      const storeResult = await db.collection('stores')
        .where({ _id: targetStoreId })
        .get();
      
      if (storeResult.data && storeResult.data.length > 0) {
        store = { data: storeResult.data[0] };
      } else {
        return {
          code: 404,
          message: '店铺不存在'
        };
      }
    }
    
    if (!store || !store.data) {
      console.log('【获取店铺详情】店铺数据为空');
      return {
        code: 404,
        message: '店铺不存在'
      };
    }
    
    // 不再进行自动营业时间检查，只使用手动设置的状态
    
    console.log('【获取店铺详情】店铺数据:', store.data);
    
    // 查询商家信息
    let merchant = await db.collection('merchants')
      .where({ storeId: targetStoreId })
      .get();
    
    // 如果通过storeId找不到商家，尝试通过merchantId查找
    if (!merchant.data || merchant.data.length === 0) {
      if (store.data.merchantId) {
        const merchantDoc = await db.collection('merchants')
          .doc(store.data.merchantId)
          .get();
        merchant = { data: merchantDoc.data ? [merchantDoc.data] : [] };
      }
    }
    
    const merchantInfo = Array.isArray(merchant.data) && merchant.data.length > 0 
      ? merchant.data[0] 
      : (merchant.data || {});
    
    const storeDetail = {
      ...store.data,
      merchantId: merchantInfo._id || store.data.merchantId || null, // 添加商家ID
      merchantOpenid: merchantInfo.openid || null, // 添加商家openid，用于联系商家
      merchantName: merchantInfo.merchantName || store.data.name || '商家',
      contactPhone: merchantInfo.contactPhone || '未设置联系方式',
      announcement: store.data.announcement || '',
      businessHours: store.data.businessHours || '未设置营业时间',
      deliveryArea: store.data.deliveryArea || store.data.address || '未设置配送范围',
      address: store.data.address || store.data.deliveryArea || '未设置地址',
      description: store.data.description || store.data.introduction || '',
      monthlySales: store.data.monthlySales || store.data.sales || 0,
      deliveryFee: store.data.deliveryFee || 3,
      minOrderAmount: store.data.minOrderAmount || 20
    };
    
    console.log('【获取店铺详情】返回数据:', storeDetail);
    
    return {
      code: 200,
      message: 'ok',
      data: { store: storeDetail }
    };
  } catch (error) {
    console.error('【获取店铺详情】异常:', error);
    return {
      code: 500,
      message: '获取店铺详情失败',
      error: error.message
    };
  }
}

/**
 * 更新营业时间
 */
async function updateBusinessHours(openid, data) {
  const { startTime, endTime, merchantId } = data;
  
  console.log('【更新营业时间】接收到的参数:', { startTime, endTime, merchantId });
  
  // 查询商家信息
  let merchantInfo = null;
  
  // 如果提供了 merchantId，优先使用 merchantId 查询
  if (merchantId) {
    console.log('【更新营业时间】使用提供的 merchantId:', merchantId);
    const merchant = await db.collection('merchants').doc(merchantId).get();
    if (merchant.data) {
      merchantInfo = merchant.data;
    }
  }
  
  // 如果没有提供 merchantId 或查询失败，使用 openid 查询（微信登录场景）
  if (!merchantInfo) {
    console.log('【更新营业时间】使用 openid 查询商家:', openid);
    const merchant = await db.collection('merchants')
      .where({ openid })
      .get();
    
    if (!merchant.data.length) {
      return {
        code: 404,
        message: '商家不存在'
      };
    }
    
    merchantInfo = merchant.data[0];
  }
  
  let storeId = merchantInfo.storeId || merchantInfo._id;
  
  console.log('【更新营业时间】店铺ID:', storeId);
  
  // 检查店铺是否存在
  let store = null;
  try {
    store = await db.collection('stores').doc(storeId).get();
  } catch (error) {
    console.log('【更新营业时间】查询店铺失败:', error.message);
    store = { data: null };
  }
  
  if (!store.data) {
    // 先检查是否已经存在相同 merchantId 的店铺（防止重复创建）
    const existingStoreQuery = await db.collection('stores')
      .where({
        merchantId: merchantInfo._id
      })
      .get();
    
    if (existingStoreQuery.data && existingStoreQuery.data.length > 0) {
      // 如果已存在店铺，使用已存在的店铺
      console.log('【更新营业时间】发现已存在的店铺，使用已有店铺:', existingStoreQuery.data[0]._id);
      storeId = existingStoreQuery.data[0]._id;
      
      // 更新商家记录的 storeId（如果不同）
      if (merchantInfo.storeId !== storeId) {
        await db.collection('merchants').doc(merchantInfo._id).update({
          data: {
            storeId: storeId,
            updatedAt: db.serverDate()
          }
        });
      }
      
      // 继续执行更新逻辑，使用已存在的店铺
      store = await db.collection('stores').doc(storeId).get();
    } else {
      // 如果不存在，创建新店铺
      console.log('【更新营业时间】店铺不存在，正在创建...');
      const createResult = await db.collection('stores').add({
        data: {
          merchantId: merchantInfo._id,
          name: merchantInfo.merchantName || '我的店铺',
          logoUrl: merchantInfo.avatar || '',
          avatar: merchantInfo.avatar || '',
          announcement: '',
          businessStatus: 'open',
          businessHours: {
            startTime,
            endTime
          },
          deliveryArea: '校园内配送',
          address: '未设置店铺地址',
          storeCategory: '其他', // 店铺分类，默认"其他"
          category: '未设置经营分类',
          minOrderAmount: 20,
          deliveryFee: 3,
          autoAccept: false, // 默认关闭自动接单
          ratingAvg: 0,
          ratingCount: 0,
          createdAt: db.serverDate(),
          updatedAt: db.serverDate()
        }
      });
      
      storeId = createResult._id;
      
      // 更新商家的storeId
      await db.collection('merchants').doc(merchantInfo._id).update({
        data: {
          storeId: storeId,
          updatedAt: db.serverDate()
        }
      });
      
      console.log('【更新营业时间】店铺创建成功，ID:', storeId);
      return {
        code: 200,
        message: '营业时间更新成功'
      };
    }
  }
  
  // 更新营业时间
  await db.collection('stores').doc(storeId).update({
    data: {
      businessHours: {
        startTime,
        endTime
      },
      updatedAt: db.serverDate()
    }
  });
  
  console.log('【更新营业时间】更新成功');
  
  return {
    code: 200,
    message: '更新成功'
  };
}

/**
 * 更新自动接单设置
 */
async function updateAutoAccept(openid, data) {
  const { autoAccept, merchantId } = data;
  
  console.log('【更新自动接单】接收到的参数:', { autoAccept, merchantId });
  
  // 查询商家信息
  let merchantInfo = null;
  
  // 如果提供了 merchantId，优先使用 merchantId 查询
  if (merchantId) {
    console.log('【更新自动接单】使用提供的 merchantId:', merchantId);
    const merchant = await db.collection('merchants').doc(merchantId).get();
    if (merchant.data) {
      merchantInfo = merchant.data;
    }
  }
  
  // 如果没有提供 merchantId 或查询失败，使用 openid 查询（微信登录场景）
  if (!merchantInfo) {
    console.log('【更新自动接单】使用 openid 查询商家:', openid);
    const merchant = await db.collection('merchants')
      .where({ openid })
      .get();
    
    if (!merchant.data.length) {
      return {
        code: 404,
        message: '商家不存在'
      };
    }
    
    merchantInfo = merchant.data[0];
  }
  
  let storeId = merchantInfo.storeId || merchantInfo._id;
  
  // 检查店铺是否存在
  let store = null;
  try {
    store = await db.collection('stores').doc(storeId).get();
  } catch (error) {
    console.log('【更新自动接单】查询店铺失败:', error.message);
    return {
      code: 404,
      message: '店铺不存在，请先创建店铺信息'
    };
  }
  
  if (!store.data) {
    return {
      code: 404,
      message: '店铺不存在，请先创建店铺信息'
    };
  }
  
  // 更新自动接单设置
  await db.collection('stores').doc(storeId).update({
    data: {
      autoAccept: autoAccept === true || autoAccept === 'true',
      updatedAt: db.serverDate()
    }
  });
  
  console.log('【更新自动接单】更新成功，autoAccept:', autoAccept);
  
  return {
    code: 200,
    message: '更新成功'
  };
}

/**
 * 更新营业状态
 */
async function updateBusinessStatus(openid, data) {
  const { businessStatus, merchantId } = data;
  
  console.log('【更新营业状态】参数:', { businessStatus, merchantId });
  
  // 查询商家信息
  let merchantInfo = null;
  
  // 如果提供了 merchantId，优先使用 merchantId 查询
  if (merchantId) {
    console.log('【更新营业状态】使用提供的 merchantId:', merchantId);
    const merchant = await db.collection('merchants').doc(merchantId).get();
    if (merchant.data) {
      merchantInfo = merchant.data;
    }
  }
  
  // 如果没有提供 merchantId 或查询失败，使用 openid 查询（微信登录场景）
  if (!merchantInfo) {
    console.log('【更新营业状态】使用 openid 查询商家:', openid);
    const merchant = await db.collection('merchants')
      .where({ openid })
      .get();
    
    if (!merchant.data.length) {
      return {
        code: 404,
        message: '商家不存在'
      };
    }
    
    merchantInfo = merchant.data[0];
  }
  
  let storeId = merchantInfo.storeId || merchantInfo._id;
  
  // 检查店铺是否存在
  let store = null;
  try {
    store = await db.collection('stores').doc(storeId).get();
  } catch (error) {
    console.log('【更新营业状态】查询店铺失败:', error.message);
    return {
      code: 404,
      message: '店铺不存在，请先创建店铺信息'
    };
  }
  
  if (!store.data) {
    return {
      code: 404,
      message: '店铺不存在，请先创建店铺信息'
    };
  }
  
  // 更新营业状态（仅手动操作）
  const updateData = {
    businessStatus,
    updatedAt: db.serverDate()
  };
  
  await db.collection('stores').doc(storeId).update({
    data: updateData
  });
  
  console.log('【更新营业状态】店铺', storeId, '状态更新完成:', updateData);
  
  return {
    code: 200,
    message: '更新成功'
  };
}

/**
 * 获取店铺详情（包含商品列表）- 客户端使用
 */
async function getStoreDetailWithProducts(openid, data) {
  const { storeId } = data;
  
  console.log('【获取店铺详情及商品】店铺ID:', storeId);
  
  if (!storeId) {
    return {
      code: 400,
      message: '缺少店铺ID'
    };
  }
  
  try {
    // 1. 查询店铺信息
    const store = await db.collection('stores').doc(storeId).get();
    
    if (!store.data) {
      return {
        code: 404,
        message: '店铺不存在'
      };
    }
    
    // 2. 检查店铺状态：只有营业中的店铺才能查看详情和下订单
    const updatedStore = store;
    
    // 检查店铺状态
    const finalBusinessStatus = updatedStore.data.businessStatus;
    
    if (finalBusinessStatus !== 'open') {
      // 如果状态不是营业，则拒绝访问
      console.log('【获取店铺详情及商品】店铺', storeId, '状态不是营业中，拒绝访问');
      return {
        code: 403,
        message: '店铺当前休息中，暂不提供服务'
      };
    }
    
    // 3. 查询商家信息
    const merchant = await db.collection('merchants')
      .where({ storeId })
      .get();
    
    if (!merchant.data.length || merchant.data[0].status !== 'active') {
      return {
        code: 404,
        message: '商家未通过审核'
      };
    }
    
    // 4. 查询商品分类（只返回活跃状态的分类）
    const categories = await db.collection('categories')
      .where({
        storeId: storeId,
        status: 'active'
      })
      .field({
        _id: true,
        name: true,
        sortOrder: true
      })
      .orderBy('sortOrder', 'asc')
      .get();
    
    // 5. 查询已审核通过的商品（只返回必要字段，减少数据传输）
    const products = await db.collection('products')
      .where({
        storeId: storeId,
        status: 'on',
        auditStatus: 'approved'
      })
      .field({
        _id: true,
        name: true,
        price: true,
        coverUrl: true,
        categoryId: true,
        stock: true,
        sales: true,
        specifications: true // 包含规格配置
      })
      .orderBy('createdAt', 'desc')
      .get();
    
    // 6. 获取店铺状态
    let finalStoreStatus = updatedStore.data.businessStatus;
    
    // 6. 处理店铺头像，优先使用avatar，然后是logoUrl
    let logoUrl = updatedStore.data.avatar || updatedStore.data.logoUrl || '';
    
    // 清理logoUrl中的错误路径前缀
    if (logoUrl) {
      // 如果包含cloud://但前面有错误的路径，清理掉
      if (logoUrl.includes('cloud://')) {
        // 移除/pages/home/等路径前缀，只保留cloud://开头的部分
        const cloudMatch = logoUrl.match(/cloud:\/\/[^\s"']+/);
        if (cloudMatch) {
          logoUrl = cloudMatch[0];
        }
      }
      
      // 移除无效值
      if (logoUrl === 'undefined' || logoUrl === 'null' || logoUrl.trim() === '') {
        logoUrl = '';
      }
    }
    
    // 注意：在微信小程序中，cloud://格式的fileID可以直接在image标签中使用
    // 不需要转换为临时URL，小程序会自动处理
    // 如果需要转换为临时URL（例如在网页中使用），可以在前端进行转换
    
    // 7. 处理商品图片URL，转换为临时URL
    const productFileIDs = [];
    products.data.forEach(product => {
      const coverUrl = product.coverUrl || '';
      if (coverUrl && (coverUrl.startsWith('cloud://') || coverUrl.includes('cloud://'))) {
        // 清理fileID格式
        let cleanFileID = coverUrl;
        if (coverUrl.includes('cloud://')) {
          const cloudMatch = coverUrl.match(/cloud:\/\/[^\/]+(?:\/[^"]*)?/);
          if (cloudMatch) {
            cleanFileID = cloudMatch[0];
          } else {
            cleanFileID = coverUrl.replace(/.*cloud:\/\//, 'cloud://');
          }
        }
        if (cleanFileID && !productFileIDs.includes(cleanFileID)) {
          productFileIDs.push(cleanFileID);
        }
      }
    });
    
    // 批量转换商品图片fileID为临时URL
    const productImageUrlMap = new Map();
    if (productFileIDs.length > 0) {
      try {
        // 清理fileID格式，确保格式正确
        const cleanedFileIDs = productFileIDs.map(fileID => {
          if (fileID.includes('cloud://')) {
            const cloudMatch = fileID.match(/cloud:\/\/[^\s"']+/);
            if (cloudMatch) {
              return cloudMatch[0];
            }
          }
          return fileID;
        });
        
        console.log('【获取店铺详情】准备转换商品图片URL，数量:', cleanedFileIDs.length);
        
        const batchSize = 20;
        for (let i = 0; i < cleanedFileIDs.length; i += batchSize) {
          const batch = cleanedFileIDs.slice(i, i + batchSize);
          const tempUrlRes = await cloud.getTempFileURL({
            fileList: batch
          });
          
          tempUrlRes.fileList.forEach((item, index) => {
            const fileID = batch[index];
            const originalFileID = productFileIDs[index + i]; // 获取原始fileID用于映射
            
            if (item.status === 'ok') {
              productImageUrlMap.set(originalFileID, item.tempFileURL);
              productImageUrlMap.set(fileID, item.tempFileURL); // 同时保存清理后的fileID映射
            } else {
              console.warn('【获取店铺详情】商品图片URL转换失败:', fileID, item.errMsg);
              // 如果权限不足，保留原fileID让小程序尝试加载
              if (item.errMsg && item.errMsg.includes('STORAGE_EXCEED_AUTHORITY')) {
                console.warn('【获取店铺详情】云存储权限不足，使用原fileID');
                productImageUrlMap.set(originalFileID, originalFileID);
                productImageUrlMap.set(fileID, fileID);
              } else {
                // 其他错误，设置为空，触发默认图片
                productImageUrlMap.set(originalFileID, '');
                productImageUrlMap.set(fileID, '');
              }
            }
          });
        }
        console.log('【获取店铺详情】商品图片URL转换完成，成功转换:', productImageUrlMap.size, '个');
      } catch (error) {
        console.error('【获取店铺详情】批量转换商品图片URL失败:', error);
        // 如果批量转换失败，保留原fileID
        productFileIDs.forEach(fileID => {
          if (!productImageUrlMap.has(fileID)) {
            productImageUrlMap.set(fileID, fileID);
          }
        });
      }
    }
    
    const storeInfo = {
      name: updatedStore.data.name,
      description: updatedStore.data.description || updatedStore.data.announcement || '',
      announcement: updatedStore.data.announcement || '',
      avatar: logoUrl, // 优先使用avatar字段
      logo: logoUrl, // 兼容字段
      logoUrl: logoUrl, // 兼容字段
      deliveryFee: updatedStore.data.deliveryFee || 3,
      minOrder: updatedStore.data.minOrderAmount || 20,
      minOrderAmount: updatedStore.data.minOrderAmount || 20,
      ratingAvg: updatedStore.data.ratingAvg || 0,
      ratingCount: updatedStore.data.ratingCount || 0,
      monthlySales: updatedStore.data.monthlySales || updatedStore.data.sales || 0,
      businessStatus: finalStoreStatus, // 使用最终确定的状态（手动设置优先）
      merchantName: merchant.data[0].merchantName
    };
    
    // 8. 格式化分类数据
    const categoryList = categories.data.map((cat, index) => ({
      id: cat._id,
      name: cat.name,
      sortOrder: cat.sortOrder || index
    }));
    
    // 如果没有分类，创建一个默认分类
    if (categoryList.length === 0) {
      categoryList.push({
        id: 'default',
        name: '全部商品',
        sortOrder: 0
      });
    }
    
    // 9. 格式化商品数据
    const productList = products.data.map(product => {
      // 转换规格配置价格从分到元，并判断是否有规格
      let specifications = [];
      let hasSpec = false;
      
      if (product.specifications && Array.isArray(product.specifications) && product.specifications.length > 0) {
        specifications = product.specifications.map(group => ({
          name: group.name || '',
          type: group.type || 'single', // 保留规格组类型，默认为单选
          options: (group.options || []).map(option => ({
            name: option.name || '',
            price: option.price ? (typeof option.price === 'number' ? option.price / 100 : parseFloat(option.price) / 100) : 0
          }))
        }));
        hasSpec = specifications.length > 0 && specifications.some(group => group.options && group.options.length > 0);
      }
      
      // 处理商品图片URL，转换为临时URL
      let coverUrl = product.coverUrl || '';
      if (coverUrl && (coverUrl.startsWith('cloud://') || coverUrl.includes('cloud://'))) {
        // 清理fileID格式
        let cleanFileID = coverUrl;
        if (coverUrl.includes('cloud://')) {
          const cloudMatch = coverUrl.match(/cloud:\/\/[^\s"']+/);
          if (cloudMatch) {
            cleanFileID = cloudMatch[0];
          } else {
            cleanFileID = coverUrl.replace(/.*cloud:\/\//, 'cloud://');
          }
        }
        
        // 转换为临时URL（如果已转换）
        const tempUrl = productImageUrlMap.get(coverUrl) || productImageUrlMap.get(cleanFileID);
        if (tempUrl) {
          coverUrl = tempUrl;
        } else {
          // 如果转换失败，保留原fileID（小程序可能会自动处理）
          coverUrl = cleanFileID;
        }
        
        // 如果转换后的URL为空，使用默认图片
        if (!coverUrl || coverUrl.trim() === '') {
          coverUrl = ''; // 前端会使用默认图片
        }
      } else if (!coverUrl || coverUrl.trim() === '') {
        coverUrl = ''; // 前端会使用默认图片
      }
      
      // 处理商品价格：如果价格大于等于100，认为是分，需要除以100转换为元；否则认为是元
      let productPrice = product.price || 0;
      if (typeof productPrice === 'number') {
        if (productPrice >= 100) {
          // 价格大于等于100，认为是分，转换为元
          productPrice = productPrice / 100;
        }
        // 如果价格小于100，认为是元，不需要转换
      } else if (typeof productPrice === 'string') {
        const numPrice = parseFloat(productPrice) || 0;
        if (numPrice >= 100) {
          productPrice = numPrice / 100;
        } else {
          productPrice = numPrice;
        }
      }
      
      return {
        id: product._id,
        name: product.name,
        price: productPrice.toFixed(2),
        image: coverUrl,
        coverUrl: coverUrl,
        category: product.categoryId || 'default',
        categoryId: product.categoryId || 'default',
        quantity: 0,
        stock: product.stock || 0,
        sales: product.sales || 0,
        specifications: specifications,
        hasSpec: hasSpec // 根据规格配置判断是否有规格
      };
    });
    
    console.log('【获取店铺详情及商品】返回数据');
    
    return {
      code: 200,
      message: 'ok',
      data: {
        storeInfo,
        categories: categoryList,
        products: productList
      }
    };
    
  } catch (error) {
    console.error('【获取店铺详情及商品】失败:', error);
    return {
      code: 500,
      message: '系统异常',
      error: error.message
    };
  }
}

/**
 * 更新店铺公告
 */
async function updateStoreAnnouncement(openid, data) {
  const { announcement, merchantId } = data;
  
  console.log('【更新店铺公告】接收到的参数:', { announcement, merchantId });
  
  // 查询商家信息
  let merchantInfo = null;
  
  // 如果提供了 merchantId，优先使用 merchantId 查询
  if (merchantId) {
    console.log('【更新店铺公告】使用提供的 merchantId:', merchantId);
    const merchant = await db.collection('merchants').doc(merchantId).get();
    if (merchant.data) {
      merchantInfo = merchant.data;
    }
  }
  
  // 如果没有提供 merchantId 或查询失败，使用 openid 查询（微信登录场景）
  if (!merchantInfo) {
    console.log('【更新店铺公告】使用 openid 查询商家:', openid);
    const merchant = await db.collection('merchants')
      .where({ openid })
      .get();
    
    if (!merchant.data.length) {
      return {
        code: 404,
        message: '商家不存在'
      };
    }
    
    merchantInfo = merchant.data[0];
  }
  
  let storeId = merchantInfo.storeId || merchantInfo._id;
  
  console.log('【更新店铺公告】店铺ID:', storeId);
  
  // 检查店铺是否存在
  let store = null;
  try {
    store = await db.collection('stores').doc(storeId).get();
  } catch (error) {
    console.log('【更新店铺公告】查询店铺失败:', error.message);
    store = { data: null };
  }
  
  if (!store.data) {
    // 先检查是否已经存在相同 merchantId 的店铺（防止重复创建）
    const existingStoreQuery = await db.collection('stores')
      .where({
        merchantId: merchantInfo._id
      })
      .get();
    
    if (existingStoreQuery.data && existingStoreQuery.data.length > 0) {
      // 如果已存在店铺，使用已存在的店铺
      console.log('【更新店铺公告】发现已存在的店铺，使用已有店铺:', existingStoreQuery.data[0]._id);
      storeId = existingStoreQuery.data[0]._id;
      
      // 更新商家记录的 storeId（如果不同）
      if (merchantInfo.storeId !== storeId) {
        await db.collection('merchants').doc(merchantInfo._id).update({
          data: {
            storeId: storeId,
            updatedAt: db.serverDate()
          }
        });
      }
      
      // 继续执行更新逻辑，使用已存在的店铺
      store = await db.collection('stores').doc(storeId).get();
    } else {
      // 如果不存在，创建新店铺
      console.log('【更新店铺公告】店铺不存在，正在创建...');
      const createResult = await db.collection('stores').add({
        data: {
          merchantId: merchantInfo._id,
          name: merchantInfo.merchantName || '我的店铺',
          logoUrl: merchantInfo.avatar || '',
          avatar: merchantInfo.avatar || '',
          announcement: announcement || '',
          businessStatus: 'open',
          businessHours: {
            startTime: '09:00',
            endTime: '22:00'
          },
          deliveryArea: '校园内配送',
          address: '未设置店铺地址',
          storeCategory: '其他', // 店铺分类，默认"其他"
          category: '未设置经营分类',
          minOrderAmount: 20,
          deliveryFee: 3,
          autoAccept: false, // 默认关闭自动接单
          ratingAvg: 0,
          ratingCount: 0,
          createdAt: db.serverDate(),
          updatedAt: db.serverDate()
        }
      });
      
      storeId = createResult._id;
      
      // 更新商家的storeId
      await db.collection('merchants').doc(merchantInfo._id).update({
        data: {
          storeId: storeId,
          updatedAt: db.serverDate()
        }
      });
      
      console.log('【更新店铺公告】店铺创建成功，ID:', storeId);
      return {
        code: 200,
        message: '公告保存成功'
      };
    }
  }
  
  // 更新店铺公告
  await db.collection('stores').doc(storeId).update({
    data: {
      announcement: announcement || '',
      updatedAt: db.serverDate()
    }
  });
  
  console.log('【更新店铺公告】更新成功');
  
  return {
    code: 200,
    message: '更新成功'
  };
}

