// 商家管理云函数（管理端）
const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext();
  const { action, data } = event;
  
  console.log('【商家管理】请求:', { action, data });
  
  try {
    // 根据action执行不同操作
    switch (action) {
      case 'getList':
        return await getMerchantList(OPENID, data);
      case 'getDetail':
        return await getMerchantDetail(OPENID, data);
      case 'approve':
        return await approveMerchant(OPENID, data);
      case 'reject':
        return await rejectMerchant(OPENID, data);
      case 'suspend':
        return await suspendMerchant(OPENID, data);
      case 'resume':
        return await resumeMerchant(OPENID, data);
      case 'delete':
        return await deleteMerchant(OPENID, data);
      default:
        return {
          code: 400,
          message: '无效的操作类型'
        };
    }
  } catch (error) {
    console.error('【商家管理】失败:', error);
    return {
      code: 500,
      message: '系统异常',
      error: error.message
    };
  }
};

/**
 * 获取商家列表
 */
async function getMerchantList(openid, data) {
  const { page = 1, pageSize = 10, status, keyword } = data || {};
  
  console.log('【获取商家列表】参数:', { page, pageSize, status, keyword });
  
  // 构建查询条件
  const whereCondition = {};
  
  // 状态筛选
  if (status) {
    whereCondition.status = status;
  }
  
  // 关键词搜索
  if (keyword) {
    whereCondition.$or = [
      { merchantName: db.RegExp({ regexp: keyword, options: 'i' }) },
      { contactPhone: db.RegExp({ regexp: keyword, options: 'i' }) }
    ];
  }
  
  console.log('【获取商家列表】查询条件:', whereCondition);
  
  // 查询商家列表（只返回必要字段，减少数据传输）
  const result = await db.collection('merchants')
    .where(whereCondition)
    .field({
      _id: true,
      merchantName: true,
      contactPhone: true,
      status: true,
      qualificationStatus: true,
      storeId: true,
      createdAt: true
    })
    .orderBy('createdAt', 'desc')
    .skip((page - 1) * pageSize)
    .limit(pageSize)
    .get();
  
  // 获取总数
  const countResult = await db.collection('merchants')
    .where(whereCondition)
    .count();
  
  console.log('【获取商家列表】查询结果:', result.data.length, '条');
  
  // 批量获取店铺信息（优化：避免N+1查询）
  const storeIds = result.data
    .map(merchant => merchant.storeId)
    .filter(storeId => storeId); // 过滤掉空值
  
  const storesMap = new Map();
  if (storeIds.length > 0) {
    const storesResult = await db.collection('stores')
      .where({
        _id: db.command.in(storeIds)
      })
      .field({
        _id: true,
        name: true,
        businessStatus: true,
        logoUrl: true,
        announcement: true
      })
      .get();
    
    storesResult.data.forEach(store => {
      storesMap.set(store._id, {
        name: store.name,
        businessStatus: store.businessStatus,
        logoUrl: store.logoUrl,
        announcement: store.announcement
      });
    });
  }
  
  // 格式化商家数据（避免循环中的异步查询）
  const merchantList = result.data.map(merchant => {
    const storeInfo = merchant.storeId ? storesMap.get(merchant.storeId) || null : null;
    
    return {
      _id: merchant._id,
      merchantName: merchant.merchantName,
      contactPhone: merchant.contactPhone,
      status: merchant.status,
      qualificationStatus: merchant.qualificationStatus || 'pending',
      createdAt: formatDate(merchant.createdAt),
      storeInfo: storeInfo
    };
  });
  
  return {
    code: 200,
    message: 'ok',
    data: {
      list: merchantList,
      total: countResult.total,
      page: page,
      pageSize: pageSize
    }
  };
}

/**
 * 获取商家详情
 */
async function getMerchantDetail(openid, data) {
  const { merchantId } = data;
  
  console.log('【获取商家详情】商家ID:', merchantId);
  
  if (!merchantId) {
    return {
      code: 400,
      message: '缺少商家ID'
    };
  }
  
  // 查询商家信息
  const merchant = await db.collection('merchants').doc(merchantId).get();
  
  if (!merchant.data) {
    return {
      code: 404,
      message: '商家不存在'
    };
  }
  
  // 获取店铺信息
  let storeInfo = null;
  if (merchant.data.storeId) {
    const store = await db.collection('stores').doc(merchant.data.storeId).get();
    if (store.data) {
      storeInfo = store.data;
    }
  }
  
  // 并行获取店铺照片、商品列表、分类列表（优化：并行查询）
  const [photosResult, productListResult, categoryListResult] = await Promise.all([
    // 获取店铺照片（只返回必要字段）
    merchant.data.storeId ? db.collection('store_photos')
      .where({ storeId: merchant.data.storeId })
      .field({
        _id: true,
        url: true,
        description: true,
        auditStatus: true,
        createdAt: true
      })
      .orderBy('createdAt', 'desc')
      .get() : Promise.resolve({ data: [] }),
    
    // 获取商品列表（只返回必要字段）
    merchant.data.storeId ? db.collection('products')
      .where({ storeId: merchant.data.storeId })
      .field({
        _id: true,
        name: true,
        price: true,
        coverUrl: true,
        status: true,
        auditStatus: true,
        createdAt: true
      })
      .orderBy('createdAt', 'desc')
      .get() : Promise.resolve({ data: [] }),
    
    // 获取分类列表（只返回必要字段）
    merchant.data.storeId ? db.collection('categories')
      .where({ storeId: merchant.data.storeId })
      .field({
        _id: true,
        name: true,
        icon: true,
        sortOrder: true
      })
      .orderBy('sortOrder', 'asc')
      .get() : Promise.resolve({ data: [] })
  ]);
  
  // 格式化店铺照片
  const storePhotos = photosResult.data.map(photo => ({
    _id: photo._id,
    url: photo.url,
    description: photo.description,
    auditStatus: photo.auditStatus,
    createdAt: formatDate(photo.createdAt)
  }));
  
  // 格式化商品列表
  const products = productListResult.data.map(product => ({
    _id: product._id,
    name: product.name,
    price: (product.price / 100).toFixed(2),
    coverUrl: product.coverUrl,
    status: product.status,
    auditStatus: product.auditStatus,
    createdAt: formatDate(product.createdAt)
  }));
  
  // 格式化分类列表
  const categories = categoryListResult.data.map(cat => ({
    _id: cat._id,
    name: cat.name,
    icon: cat.icon,
    sortOrder: cat.sortOrder
  }));
  
  return {
    code: 200,
    message: 'ok',
    data: {
      merchant: {
        _id: merchant.data._id,
        merchantName: merchant.data.merchantName,
        contactPhone: merchant.data.contactPhone,
        status: merchant.data.status,
        qualificationStatus: merchant.data.qualificationStatus || 'pending',
        createdAt: formatDate(merchant.data.createdAt),
        updatedAt: formatDate(merchant.data.updatedAt)
      },
      storeInfo: storeInfo,
      storePhotos: storePhotos,
      products: products,
      categories: categories
    }
  };
}

/**
 * 审核通过商家
 */
async function approveMerchant(openid, data) {
  const { merchantId } = data;
  
  console.log('【审核通过商家】商家ID:', merchantId);
  
  if (!merchantId) {
    return {
      code: 400,
      message: '缺少商家ID'
    };
  }
  
  // 查询商家信息
  const merchant = await db.collection('merchants').doc(merchantId).get();
  
  if (!merchant.data) {
    return {
      code: 404,
      message: '商家不存在'
    };
  }
  
  // 更新商家状态
  await db.collection('merchants').doc(merchantId).update({
    data: {
      status: 'active',
      qualificationStatus: 'approved',
      updatedAt: db.serverDate()
    }
  });
  
  // 更新店铺状态
  if (merchant.data.storeId) {
    await db.collection('stores').doc(merchant.data.storeId).update({
      data: {
        businessStatus: 'open',
        updatedAt: db.serverDate()
      }
    });
    
    // 注意：商家审核通过不代表商品自动通过审核
    // 每个商品都需要管理员单独审核，确保商品内容合规
  }
  
  return {
    code: 200,
    message: '审核通过成功'
  };
}

/**
 * 拒绝商家
 */
async function rejectMerchant(openid, data) {
  const { merchantId } = data;
  
  console.log('【拒绝商家】商家ID:', merchantId);
  
  if (!merchantId) {
    return {
      code: 400,
      message: '缺少商家ID'
    };
  }
  
  // 查询商家信息
  const merchant = await db.collection('merchants').doc(merchantId).get();
  
  if (!merchant.data) {
    return {
      code: 404,
      message: '商家不存在'
    };
  }
  
  // 更新商家状态
  await db.collection('merchants').doc(merchantId).update({
    data: {
      status: 'rejected',
      qualificationStatus: 'rejected',
      updatedAt: db.serverDate()
    }
  });
  
  // 更新店铺状态
  if (merchant.data.storeId) {
    await db.collection('stores').doc(merchant.data.storeId).update({
      data: {
        businessStatus: 'closed',
        updatedAt: db.serverDate()
      }
    });
    
    // 拒绝所有待审核的商品
    await db.collection('products')
      .where({
        storeId: merchant.data.storeId,
        auditStatus: 'pending'
      })
      .update({
        data: {
          auditStatus: 'rejected',
          updatedAt: db.serverDate()
        }
      });
  }
  
  return {
    code: 200,
    message: '拒绝成功'
  };
}

/**
 * 暂停商家
 */
async function suspendMerchant(openid, data) {
  const { merchantId } = data;
  
  console.log('【暂停商家】商家ID:', merchantId);
  
  if (!merchantId) {
    return {
      code: 400,
      message: '缺少商家ID'
    };
  }
  
  // 查询商家信息
  const merchant = await db.collection('merchants').doc(merchantId).get();
  
  if (!merchant.data) {
    return {
      code: 404,
      message: '商家不存在'
    };
  }
  
  // 更新商家状态
  await db.collection('merchants').doc(merchantId).update({
    data: {
      status: 'suspended',
      updatedAt: db.serverDate()
    }
  });
  
  // 更新店铺状态
  if (merchant.data.storeId) {
    await db.collection('stores').doc(merchant.data.storeId).update({
      data: {
        businessStatus: 'rest',
        updatedAt: db.serverDate()
      }
    });
  }
  
  return {
    code: 200,
    message: '暂停成功'
  };
}

/**
 * 取消暂停商家（恢复营业）
 */
async function resumeMerchant(openid, data) {
  const { merchantId } = data;
  
  console.log('【取消暂停商家】商家ID:', merchantId);
  
  if (!merchantId) {
    return {
      code: 400,
      message: '缺少商家ID'
    };
  }
  
  // 查询商家信息
  const merchant = await db.collection('merchants').doc(merchantId).get();
  
  if (!merchant.data) {
    return {
      code: 404,
      message: '商家不存在'
    };
  }
  
  // 更新商家状态为已通过
  await db.collection('merchants').doc(merchantId).update({
    data: {
      status: 'active',
      updatedAt: db.serverDate()
    }
  });
  
  // 更新店铺状态为营业中
  if (merchant.data.storeId) {
    await db.collection('stores').doc(merchant.data.storeId).update({
      data: {
        businessStatus: 'open',
        updatedAt: db.serverDate()
      }
    });
  }
  
  return {
    code: 200,
    message: '取消暂停成功'
  };
}

/**
 * 删除商家（删除所有相关数据）
 */
async function deleteMerchant(openid, data) {
  const { merchantId } = data;
  
  console.log('【删除商家】商家ID:', merchantId);
  
  if (!merchantId) {
    return {
      code: 400,
      message: '缺少商家ID'
    };
  }
  
  try {
    // 1. 查询商家信息
    const merchant = await db.collection('merchants').doc(merchantId).get();
    
    if (!merchant.data) {
      return {
        code: 404,
        message: '商家不存在'
      };
    }
    
    const merchantData = merchant.data;
    const storeId = merchantData.storeId;
    const openid = merchantData.openid;
    const account = merchantData.account;
    
    console.log('【删除商家】开始删除，店铺ID:', storeId, 'OpenID:', openid, '账号:', account);
    
    // 2. 删除所有相关数据（并行执行以提高效率）
    const deletePromises = [];
    
    // 2.1 删除商家记录
    deletePromises.push(
      db.collection('merchants').doc(merchantId).remove()
        .then(() => console.log('【删除商家】商家记录已删除'))
        .catch(err => console.error('【删除商家】删除商家记录失败:', err))
    );
    
    // 2.2 删除店铺信息（如果存在）
    if (storeId) {
      deletePromises.push(
        db.collection('stores').doc(storeId).remove()
          .then(() => console.log('【删除商家】店铺信息已删除'))
          .catch(err => console.error('【删除商家】删除店铺信息失败:', err))
      );
      
      // 2.3 删除店铺照片
      deletePromises.push(
        db.collection('store_photos')
          .where({ storeId: storeId })
          .get()
          .then(result => {
            if (result.data.length > 0) {
              const deletePhotoPromises = result.data.map(photo => 
                db.collection('store_photos').doc(photo._id).remove()
              );
              return Promise.all(deletePhotoPromises);
            }
          })
          .then(() => console.log('【删除商家】店铺照片已删除'))
          .catch(err => console.error('【删除商家】删除店铺照片失败:', err))
      );
      
      // 2.4 删除商品
      deletePromises.push(
        db.collection('products')
          .where({ storeId: storeId })
          .get()
          .then(result => {
            if (result.data.length > 0) {
              const deleteProductPromises = result.data.map(product => 
                db.collection('products').doc(product._id).remove()
              );
              return Promise.all(deleteProductPromises);
            }
          })
          .then(() => console.log('【删除商家】商品已删除'))
          .catch(err => console.error('【删除商家】删除商品失败:', err))
      );
      
      // 2.5 删除分类
      deletePromises.push(
        db.collection('categories')
          .where({ storeId: storeId })
          .get()
          .then(result => {
            if (result.data.length > 0) {
              const deleteCategoryPromises = result.data.map(category => 
                db.collection('categories').doc(category._id).remove()
              );
              return Promise.all(deleteCategoryPromises);
            }
          })
          .then(() => console.log('【删除商家】分类已删除'))
          .catch(err => console.error('【删除商家】删除分类失败:', err))
      );
      
      // 2.6 删除评论
      deletePromises.push(
        db.collection('reviews')
          .where({ storeId: storeId })
          .get()
          .then(result => {
            if (result.data.length > 0) {
              const deleteReviewPromises = result.data.map(review => 
                db.collection('reviews').doc(review._id).remove()
              );
              return Promise.all(deleteReviewPromises);
            }
          })
          .then(() => console.log('【删除商家】评论已删除'))
          .catch(err => console.error('【删除商家】删除评论失败:', err))
      );
      
      // 2.7 删除订单（将订单状态标记为已删除，而不是真正删除，保留订单历史）
      // 注意：订单通常不直接删除，而是标记为已删除状态
      // 如果需要真正删除订单，可以取消下面的注释
      /*
      deletePromises.push(
        db.collection('orders')
          .where({ storeId: storeId })
          .get()
          .then(result => {
            if (result.data.length > 0) {
              const deleteOrderPromises = result.data.map(order => 
                db.collection('orders').doc(order._id).remove()
              );
              return Promise.all(deleteOrderPromises);
            }
          })
          .then(() => console.log('【删除商家】订单已删除'))
          .catch(err => console.error('【删除商家】删除订单失败:', err))
      );
      */
    }
    
    // 2.8 删除用户记录（如果openid存在）
    if (openid) {
      deletePromises.push(
        db.collection('users')
          .where({ openid: openid, role: 'merchant' })
          .get()
          .then(result => {
            if (result.data.length > 0) {
              const deleteUserPromises = result.data.map(user => 
                db.collection('users').doc(user._id).remove()
              );
              return Promise.all(deleteUserPromises);
            }
          })
          .then(() => console.log('【删除商家】用户记录已删除'))
          .catch(err => console.error('【删除商家】删除用户记录失败:', err))
      );
    }
    
    // 等待所有删除操作完成
    await Promise.all(deletePromises);
    
    console.log('【删除商家】所有相关数据已删除');
    
    return {
      code: 200,
      message: '删除成功'
    };
    
  } catch (error) {
    console.error('【删除商家】失败:', error);
    return {
      code: 500,
      message: '删除失败: ' + error.message
    };
  }
}

/**
 * 格式化日期为中国时间（UTC+8）
 */
function formatDate(date) {
  if (!date) return '';
  
  let d;
  
  // 处理云数据库的Date对象（有getTime方法）
  if (date && typeof date === 'object' && date.getTime && typeof date.getTime === 'function') {
    d = new Date(date.getTime());
  } else if (date && typeof date === 'object' && date.getFullYear) {
    d = date;
  } else if (typeof date === 'string') {
    // 处理字符串格式的日期
    let dateStr = date;
    // 兼容ISO格式和空格格式
    if (dateStr.includes(' ') && !dateStr.includes('T')) {
      // 检查是否有时区信息
      const hasTimezone = dateStr.endsWith('Z') || 
                         /[+-]\d{2}:?\d{2}$/.test(dateStr) ||
                         dateStr.match(/[+-]\d{4}$/);
      
      if (!hasTimezone) {
        // 如果没有时区信息，假设是UTC时间（云数据库通常返回UTC时间），添加Z后缀
        dateStr = dateStr.replace(' ', 'T') + 'Z';
      } else {
        dateStr = dateStr.replace(' ', 'T');
      }
    }
    d = new Date(dateStr);
  } else if (typeof date === 'object' && date.type === 'date') {
    // 处理云数据库的特殊日期对象格式 { type: 'date', date: '2025-11-11T14:53:00.000Z' }
    if (date.date) {
      d = new Date(date.date);
    } else {
      d = new Date(date);
    }
  } else {
    d = new Date(date);
  }
  
  // 验证日期是否有效
  if (isNaN(d.getTime())) {
    console.warn('【格式化日期】无效的日期:', date);
    return '';
  }
  
  // 云函数运行在UTC时区，需要手动转换为中国时区（UTC+8）
  // 获取UTC时间戳，然后加上8小时（8 * 60 * 60 * 1000 毫秒）
  const chinaTimeOffset = 8 * 60 * 60 * 1000; // 8小时的毫秒数
  const chinaTime = new Date(d.getTime() + chinaTimeOffset);
  
  // 使用UTC方法获取时间组件（因为我们已经手动加上了时区偏移）
  const year = chinaTime.getUTCFullYear();
  const month = String(chinaTime.getUTCMonth() + 1).padStart(2, '0');
  const day = String(chinaTime.getUTCDate()).padStart(2, '0');
  const hours = String(chinaTime.getUTCHours()).padStart(2, '0');
  const minutes = String(chinaTime.getUTCMinutes()).padStart(2, '0');
  
  return `${year}-${month}-${day} ${hours}:${minutes}`;
}

