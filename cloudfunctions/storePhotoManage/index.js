// 店铺照片管理云函数
const cloud = require('wx-server-sdk');

// 兼容性辅助函数：padStart的替代方案
function padStart(str, targetLength, padString) {
  str = String(str);
  padString = padString || ' ';
  if (str.length >= targetLength) {
    return str;
  }
  const padLength = targetLength - str.length;
  let padding = '';
  for (let i = 0; i < padLength; i++) {
    padding += padString;
  }
  return padding + str;
}

cloud.init({
  env: 'cloud1-7g0bpzkg04df43f9' // 指定云环境ID
});

const db = cloud.database();

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext();
  const { action, data } = event;
  
  console.log('店铺照片管理请求:', { action, data });
  
  try {
    // 根据action执行不同操作
    switch (action) {
      case 'addPhoto':
        return await addStorePhoto(OPENID, data);
      case 'getPhotos':
        return await getStorePhotos(OPENID, data);
      case 'updatePhoto':
        return await updateStorePhoto(OPENID, data);
      case 'deletePhoto':
        return await deleteStorePhoto(OPENID, data);
      case 'getPhotosByStore':
        return await getPhotosByStore(OPENID, data);
      case 'getPhotosForAudit':
        return await getPhotosForAudit(OPENID, data);
      case 'auditPhoto':
        return await auditPhoto(OPENID, data);
      case 'batchAudit':
        return await batchAudit(OPENID, data);
      default:
        return {
          code: 400,
          message: '无效的操作类型'
        };
    }
  } catch (error) {
    console.error('店铺照片管理失败:', error);
    return {
      code: 500,
      message: '系统异常',
      error: error.message
    };
  }
};

/**
 * 添加店铺照片
 */
async function addStorePhoto(openid, data) {
  const { name, category, fileID, merchantId } = data;
  
  console.log('【添加照片】接收到的参数:', { name, category, fileID, merchantId });
  
  // 1. 验证参数
  if (!fileID) {
    return {
      code: 400,
      message: '缺少文件ID'
    };
  }
  
  // 2. 验证商家身份
  let merchantInfo = null;
  
  // 如果提供了 merchantId，优先使用 merchantId 查询
  if (merchantId) {
    console.log('【添加照片】使用提供的 merchantId:', merchantId);
    const merchant = await db.collection('merchants').doc(merchantId).get();
    if (merchant.data) {
      merchantInfo = merchant.data;
    }
  }
  
  // 如果没有提供 merchantId 或查询失败，使用 openid 查询（微信登录场景）
  if (!merchantInfo) {
    console.log('【添加照片】使用 openid 查询商家:', openid);
    const merchant = await db.collection('merchants')
      .where({ openid })
      .get();
    
    if (!merchant.data.length) {
      return {
        code: 403,
        message: '商家不存在'
      };
    }
    
    merchantInfo = merchant.data[0];
  }
  
  let storeId = merchantInfo.storeId;
  
  // 如果没有关联店铺，使用商家ID作为店铺ID（临时方案）
  if (!storeId) {
    storeId = merchantInfo._id;
    console.log('商家未关联店铺，使用商家ID作为店铺ID:', storeId);
  }
  
  // 3. 保存照片信息到数据库
  const photoResult = await db.collection('store_photos').add({
    data: {
      storeId,
      merchantId: merchantInfo._id,
      name,
      category,
      fileId: fileID,
      url: fileID,
      status: 'active',
      auditStatus: category === 'license' ? 'pending' : 'approved', // 证件照片需要审核
      createdAt: db.serverDate(),
      updatedAt: db.serverDate()
    }
  });
  
  console.log('照片信息保存成功:', photoResult._id);
  
  return {
    code: 200,
    message: '上传成功',
    data: {
      photoId: photoResult._id,
      url: fileID
    }
  };
}

/**
 * 获取店铺照片列表
 */
async function getStorePhotos(openid, data) {
  const { storeId, category, merchantId } = data;
  
  console.log('【获取店铺照片】参数:', { storeId, category, merchantId });
  
  // 构建查询条件
  const whereCondition = {
    status: 'active'
  };
  
  // 如果指定了storeId，直接使用
  if (storeId) {
    whereCondition.storeId = storeId;
  } else {
    // 如果没有提供 storeId，通过 merchantId 或 openid 查询商家的店铺ID
    let merchantInfo = null;
    
    // 如果提供了 merchantId，优先使用 merchantId 查询
    if (merchantId) {
      console.log('【获取店铺照片】使用提供的 merchantId:', merchantId);
      const merchant = await db.collection('merchants').doc(merchantId).get();
      if (merchant.data) {
        merchantInfo = merchant.data;
      }
    }
    
    // 如果没有提供 merchantId 或查询失败，使用 openid 查询（微信登录场景）
    if (!merchantInfo) {
      console.log('【获取店铺照片】使用 openid 查询商家:', openid);
      const merchant = await db.collection('merchants')
        .where({ openid })
        .get();
      
      if (!merchant.data.length) {
        return {
          code: 200,
          message: 'ok',
          data: { photos: [] }
        };
      }
      
      merchantInfo = merchant.data[0];
    }
    
    // 如果没有关联店铺，使用商家ID作为店铺ID
    const merchantStoreId = merchantInfo.storeId || merchantInfo._id;
    whereCondition.storeId = merchantStoreId;
    console.log('【获取店铺照片】店铺ID:', merchantStoreId);
  }
  
  // 如果指定了分类，则进行筛选
  if (category && category !== 'all') {
    whereCondition.category = category;
  }
  
  // 查询照片列表
  const photos = await db.collection('store_photos')
    .where(whereCondition)
    .orderBy('createdAt', 'desc')
    .get();
  
  // 格式化照片数据
  const photoList = photos.data.map(photo => ({
    id: photo._id,
    name: photo.name,
    category: photo.category,
    categoryText: getCategoryText(photo.category),
    url: photo.url || photo.fileId,
    createTime: formatDate(photo.createdAt)
  }));
  
  console.log('【获取照片】查询到', photoList.length, '张照片');
  
  return {
    code: 200,
    message: 'ok',
    data: { photos: photoList }
  };
}

/**
 * 更新店铺照片
 */
async function updateStorePhoto(openid, data) {
  const { photoId, name, category } = data;
  
  // 1. 验证商家权限
  const merchant = await db.collection('merchants')
    .where({ openid })
    .get();
  
  if (!merchant.data.length) {
    return {
      code: 403,
      message: '商家不存在'
    };
  }
  
  // 2. 验证照片是否属于该商家
  const photo = await db.collection('store_photos').doc(photoId).get();
  
  if (!photo.data) {
    return {
      code: 404,
      message: '照片不存在'
    };
  }
  
  if (photo.data.merchantId !== merchant.data[0]._id) {
    return {
      code: 403,
      message: '无权操作'
    };
  }
  
  // 3. 更新照片信息
  const updateData = {
    updatedAt: db.serverDate()
  };
  
  if (name !== undefined) {
    updateData.name = name;
  }
  
  if (category !== undefined) {
    updateData.category = category;
    // 如果改为证件照片，需要重新审核
    if (category === 'license') {
      updateData.auditStatus = 'pending';
    }
  }
  
  await db.collection('store_photos').doc(photoId).update({
    data: updateData
  });
  
  return {
    code: 200,
    message: '更新成功'
  };
}

/**
 * 删除店铺照片
 */
async function deleteStorePhoto(openid, data) {
  const { photoId } = data;
  
  // 1. 验证商家权限
  const merchant = await db.collection('merchants')
    .where({ openid })
    .get();
  
  if (!merchant.data.length) {
    return {
      code: 403,
      message: '商家不存在'
    };
  }
  
  // 2. 验证照片是否属于该商家
  const photo = await db.collection('store_photos').doc(photoId).get();
  
  if (!photo.data) {
    return {
      code: 404,
      message: '照片不存在'
    };
  }
  
  if (photo.data.merchantId !== merchant.data[0]._id) {
    return {
      code: 403,
      message: '无权操作'
    };
  }
  
  // 3. 逻辑删除照片
  await db.collection('store_photos').doc(photoId).update({
    data: {
      status: 'deleted',
      updatedAt: db.serverDate()
    }
  });
  
  // 4. 删除云存储文件（可选）
  try {
    await cloud.deleteFile({
      fileList: [photo.data.fileId]
    });
    console.log('云存储文件删除成功');
  } catch (err) {
    console.error('云存储文件删除失败:', err);
    // 不影响主流程，继续返回成功
  }
  
  return {
    code: 200,
    message: '删除成功'
  };
}

/**
 * 获取分类文本
 */
function getCategoryText(category) {
  const texts = {
    'environment': '环境照片',
    'food': '菜品照片',
    'license': '证件照片'
  };
  return texts[category] || '未知分类';
}

/**
 * 格式化日期
 */
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
  const month = padStart(chinaTime.getUTCMonth() + 1, 2, '0');
  const day = padStart(chinaTime.getUTCDate(), 2, '0');
  const hour = padStart(chinaTime.getUTCHours(), 2, '0');
  const minute = padStart(chinaTime.getUTCMinutes(), 2, '0');
  
  return `${year}-${month}-${day} ${hour}:${minute}`;
}

/**
 * 客户端查询店铺照片（按店铺ID）
 */
async function getPhotosByStore(openid, data) {
  const { storeId, category } = data;
  
  if (!storeId) {
    return {
      code: 400,
      message: '缺少店铺ID'
    };
  }
  
  // 构建查询条件（只返回已审核通过的照片）
  const whereCondition = {
    storeId: storeId,
    status: 'active',
    auditStatus: 'approved'
  };
  
  // 如果指定了分类，则进行筛选
  if (category && category !== 'all') {
    whereCondition.category = category;
  }
  
  // 查询照片列表
  const photos = await db.collection('store_photos')
    .where(whereCondition)
    .orderBy('createdAt', 'desc')
    .get();
  
  // 格式化照片数据
  const photoList = photos.data.map(photo => ({
    id: photo._id,
    name: photo.name,
    category: photo.category,
    categoryText: getCategoryText(photo.category),
    url: photo.url,
    createTime: formatDate(photo.createdAt)
  }));
  
  return {
    code: 200,
    message: 'ok',
    data: { photos: photoList }
  };
}

/**
 * 管理端查询待审核照片
 */
async function getPhotosForAudit(openid, data) {
  const { auditStatus, page = 1, pageSize = 20 } = data;
  
  // 构建查询条件
  const whereCondition = {
    status: 'active'
  };
  
  // 如果有审核状态筛选
  if (auditStatus) {
    whereCondition.auditStatus = auditStatus;
  }
  
  // 查询照片列表（包含待审核和已驳回的）
  const result = await db.collection('store_photos')
    .where(whereCondition)
    .orderBy('createdAt', 'desc')
    .skip((page - 1) * pageSize)
    .limit(pageSize)
    .get();
  
  // 获取总数
  const countResult = await db.collection('store_photos')
    .where(whereCondition)
    .count();
  
  // 格式化照片数据
  const photoList = result.data.map(photo => ({
    id: photo._id,
    storeId: photo.storeId,
    merchantId: photo.merchantId,
    name: photo.name,
    category: photo.category,
    categoryText: getCategoryText(photo.category),
    url: photo.url,
    auditStatus: photo.auditStatus,
    auditStatusText: getAuditStatusText(photo.auditStatus),
    createTime: formatDate(photo.createdAt)
  }));
  
  return {
    code: 200,
    message: 'ok',
    data: {
      photos: photoList,
      total: countResult.total,
      page: page,
      pageSize: pageSize
    }
  };
}

/**
 * 审核照片
 */
async function auditPhoto(openid, data) {
  const { photoId, auditStatus, auditReason } = data;
  
  if (!photoId || !auditStatus) {
    return {
      code: 400,
      message: '缺少必要参数'
    };
  }
  
  // 查询照片
  const photo = await db.collection('store_photos').doc(photoId).get();
  
  if (!photo.data) {
    return {
      code: 404,
      message: '照片不存在'
    };
  }
  
  // 更新审核状态
  const updateData = {
    auditStatus: auditStatus,
    updatedAt: db.serverDate()
  };
  
  if (auditReason) {
    updateData.auditReason = auditReason;
  }
  
  if (auditStatus === 'approved') {
    updateData.auditedAt = db.serverDate();
  }
  
  await db.collection('store_photos').doc(photoId).update({
    data: updateData
  });
  
  return {
    code: 200,
    message: '审核成功'
  };
}

/**
 * 批量审核照片
 */
async function batchAudit(openid, data) {
  const { photoIds, auditStatus, auditReason } = data;
  
  if (!photoIds || !Array.isArray(photoIds) || photoIds.length === 0) {
    return {
      code: 400,
      message: '缺少照片ID列表'
    };
  }
  
  if (!auditStatus) {
    return {
      code: 400,
      message: '缺少审核状态'
    };
  }
  
  // 批量更新
  const updateData = {
    auditStatus: auditStatus,
    updatedAt: db.serverDate()
  };
  
  if (auditReason) {
    updateData.auditReason = auditReason;
  }
  
  if (auditStatus === 'approved') {
    updateData.auditedAt = db.serverDate();
  }
  
  // 批量更新
  const _ = db.command;
  await db.collection('store_photos')
    .where({
      _id: _.in(photoIds)
    })
    .update({
      data: updateData
    });
  
  return {
    code: 200,
    message: '批量审核成功',
    data: {
      count: photoIds.length
    }
  };
}

/**
 * 获取审核状态文本
 */
function getAuditStatusText(status) {
  const texts = {
    'pending': '待审核',
    'approved': '已通过',
    'rejected': '已驳回'
  };
  return texts[status] || '未知状态';
}


