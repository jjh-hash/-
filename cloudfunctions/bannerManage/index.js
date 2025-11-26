// 轮播图管理云函数
const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();

exports.main = async (event, context) => {
  console.log('轮播图管理请求:', event);
  
  const { action, data } = event;
  
  try {
    switch (action) {
      case 'create':
        return await createBanner(data);
      case 'getList':
        return await getBannerList(data);
      case 'update':
        return await updateBanner(data);
      case 'delete':
        return await deleteBanner(data);
      case 'updateOrder':
        return await updateBannerOrder(data);
      default:
        return {
          code: 400,
          message: '未知操作',
          data: null
        };
    }
  } catch (error) {
    console.error('轮播图管理错误:', error);
    console.error('错误堆栈:', error.stack);
    return {
      code: 500,
      message: '系统异常: ' + error.message,
      data: {
        error: error.message,
        stack: error.stack
      }
    };
  }
};

/**
 * 创建轮播图
 */
async function createBanner(data) {
  const { imageUrl, linkUrl, sortOrder = 0, status = 'active' } = data;
  
  if (!imageUrl) {
    return {
      code: 400,
      message: '图片URL为必填项',
      data: null
    };
  }
  
  // 获取当前最大排序号
  const maxOrderResult = await db.collection('banners')
    .orderBy('sortOrder', 'desc')
    .limit(1)
    .get();
  
  const maxOrder = maxOrderResult.data.length > 0 ? maxOrderResult.data[0].sortOrder : 0;
  
  // 创建轮播图
  const result = await db.collection('banners').add({
    data: {
      imageUrl: imageUrl,
      linkUrl: linkUrl || '',
      sortOrder: sortOrder || maxOrder + 1,
      status: status,
      createdAt: db.serverDate(),
      updatedAt: db.serverDate()
    }
  });
  
  console.log('轮播图创建成功:', result._id);
  
  return {
    code: 200,
    message: '创建成功',
    data: {
      _id: result._id
    }
  };
}

/**
 * 获取轮播图列表
 */
async function getBannerList(data) {
  const { status, isActive } = data;
  
  let whereCondition = {};
  
  // 如果只获取启用的轮播图
  if (isActive) {
    whereCondition.status = 'active';
  } else if (status) {
    whereCondition.status = status;
  }
  
  const result = await db.collection('banners')
    .where(whereCondition)
    .orderBy('sortOrder', 'asc')
    .get();
  
  return {
    code: 200,
    message: '获取成功',
    data: {
      list: result.data
    }
  };
}

/**
 * 更新轮播图
 */
async function updateBanner(data) {
  const { bannerId, imageUrl, linkUrl, sortOrder, status } = data;
  
  if (!bannerId) {
    return {
      code: 400,
      message: '缺少轮播图ID',
      data: null
    };
  }
  
  // 检查轮播图是否存在
  const banner = await db.collection('banners').doc(bannerId).get();
  
  if (!banner.data) {
    return {
      code: 404,
      message: '轮播图不存在',
      data: null
    };
  }
  
  // 构建更新数据
  const updateData = {
    updatedAt: db.serverDate()
  };
  
  if (imageUrl !== undefined) updateData.imageUrl = imageUrl;
  if (linkUrl !== undefined) updateData.linkUrl = linkUrl;
  if (sortOrder !== undefined) updateData.sortOrder = sortOrder;
  if (status !== undefined) updateData.status = status;
  
  // 更新轮播图
  await db.collection('banners').doc(bannerId).update({
    data: updateData
  });
  
  console.log('轮播图更新成功:', bannerId);
  
  return {
    code: 200,
    message: '更新成功',
    data: null
  };
}

/**
 * 删除轮播图
 */
async function deleteBanner(data) {
  const { bannerId } = data;
  
  if (!bannerId) {
    return {
      code: 400,
      message: '缺少轮播图ID',
      data: null
    };
  }
  
  // 检查轮播图是否存在
  const banner = await db.collection('banners').doc(bannerId).get();
  
  if (!banner.data) {
    return {
      code: 404,
      message: '轮播图不存在',
      data: null
    };
  }
  
  // 删除轮播图
  await db.collection('banners').doc(bannerId).remove();
  
  console.log('轮播图删除成功:', bannerId);
  
  return {
    code: 200,
    message: '删除成功',
    data: null
  };
}

/**
 * 更新轮播图排序
 */
async function updateBannerOrder(data) {
  const { orders } = data; // orders: [{ bannerId, sortOrder }]
  
  if (!orders || !Array.isArray(orders)) {
    return {
      code: 400,
      message: '缺少排序数据',
      data: null
    };
  }
  
  // 批量更新排序
  const updatePromises = orders.map(order => 
    db.collection('banners').doc(order.bannerId).update({
      data: {
        sortOrder: order.sortOrder,
        updatedAt: db.serverDate()
      }
    })
  );
  
  await Promise.all(updatePromises);
  
  console.log('轮播图排序更新成功');
  
  return {
    code: 200,
    message: '排序更新成功',
    data: null
  };
}

