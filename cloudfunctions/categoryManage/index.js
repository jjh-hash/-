// 商品分类管理云函数
const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext();
  const { action, data } = event;
  
  console.log('商品分类管理请求:', { action, data });
  
  try {
    // 根据action执行不同操作
    switch (action) {
      case 'addCategory':
        return await addCategory(OPENID, data);
      case 'getCategories':
        return await getCategories(OPENID, data);
      case 'updateCategory':
        return await updateCategory(OPENID, data);
      case 'deleteCategory':
        return await deleteCategory(OPENID, data);
      case 'getCategoriesByStore':
        return await getCategoriesByStore(OPENID, data);
      case 'updateCategoryOrder':
        return await updateCategoryOrder(OPENID, data);
      default:
        return {
          code: 400,
          message: '无效的操作类型'
        };
    }
  } catch (error) {
    console.error('商品分类管理失败:', error);
    return {
      code: 500,
      message: '系统异常',
      error: error.message
    };
  }
};

/**
 * 添加分类
 */
async function addCategory(openid, data) {
  const { name, icon, merchantId } = data;
  
  console.log('【添加分类】接收到的参数:', { name, icon, merchantId });
  
  // 1. 验证参数
  if (!name || !name.trim()) {
    return {
      code: 400,
      message: '分类名称不能为空'
    };
  }
  
  // 2. 验证商家身份
  let merchantInfo = null;
  
  // 如果提供了 merchantId，优先使用 merchantId 查询
  if (merchantId) {
    console.log('【添加分类】使用提供的 merchantId:', merchantId);
    const merchant = await db.collection('merchants').doc(merchantId).get();
    if (merchant.data) {
      merchantInfo = merchant.data;
    }
  }
  
  // 如果没有提供 merchantId 或查询失败，使用 openid 查询（微信登录场景）
  if (!merchantInfo) {
    console.log('【添加分类】使用 openid 查询商家:', openid);
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
  
  // 如果没有关联店铺，使用商家ID作为店铺ID
  if (!storeId) {
    storeId = merchantInfo._id;
    console.log('商家未关联店铺，使用商家ID作为店铺ID:', storeId);
  }
  
  // 3. 检查分类名称是否重复
  const existingCategory = await db.collection('categories')
    .where({
      storeId: storeId,
      name: name.trim(),
      status: 'active'
    })
    .get();
  
  if (existingCategory.data.length > 0) {
    return {
      code: 400,
      message: '分类名称已存在'
    };
  }
  
  // 4. 获取当前最大排序号
  const maxOrderResult = await db.collection('categories')
    .where({ storeId: storeId })
    .orderBy('sortOrder', 'desc')
    .limit(1)
    .get();
  
  const nextSortOrder = maxOrderResult.data.length > 0 
    ? maxOrderResult.data[0].sortOrder + 1 
    : 1;
  
  // 5. 创建分类
  const categoryResult = await db.collection('categories').add({
    data: {
      storeId,
      merchantId: merchantInfo._id,
      name: name.trim(),
      icon: icon || '',
      sortOrder: nextSortOrder,
      status: 'active',
      createdAt: db.serverDate(),
      updatedAt: db.serverDate()
    }
  });
  
  console.log('分类创建成功:', categoryResult._id);
  
  return {
    code: 200,
    message: '添加成功',
    data: {
      categoryId: categoryResult._id,
      name: name.trim(),
      sortOrder: nextSortOrder
    }
  };
}

/**
 * 获取分类列表
 */
async function getCategories(openid, data) {
  console.log('【获取分类】接收到的参数:', data);
  
  // 安全的解构赋值，处理 data 为 undefined 的情况
  const { storeId, merchantId } = data || {};
  
  console.log('【获取分类】解析后的参数:', { storeId, merchantId });
  
  // 如果指定了storeId，直接使用
  let targetStoreId = storeId;
  
  // 如果没有提供 storeId，通过 merchantId 或 openid 查询商家的店铺ID
  if (!targetStoreId) {
    let merchantInfo = null;
    
    // 如果提供了 merchantId，优先使用 merchantId 查询
    if (merchantId) {
      console.log('【获取分类】使用提供的 merchantId:', merchantId);
      const merchant = await db.collection('merchants').doc(merchantId).get();
      if (merchant.data) {
        merchantInfo = merchant.data;
      }
    }
    
    // 如果没有提供 merchantId 或查询失败，使用 openid 查询（微信登录场景）
    if (!merchantInfo) {
      console.log('【获取分类】使用 openid 查询商家:', openid);
      const merchant = await db.collection('merchants')
        .where({ openid })
        .get();
      
      if (!merchant.data.length) {
        console.log('【获取分类】商家不存在，返回空列表');
        return {
          code: 200,
          message: 'ok',
          data: { categories: [] }
        };
      }
      
      merchantInfo = merchant.data[0];
    }
    
    targetStoreId = merchantInfo.storeId || merchantInfo._id;
    console.log('【获取分类】使用店铺ID:', targetStoreId);
  }
  
  // 查询分类列表
  console.log('【获取分类】查询条件:', { storeId: targetStoreId, status: 'active' });
  
  const categories = await db.collection('categories')
    .where({
      storeId: targetStoreId,
      status: 'active'
    })
    .orderBy('sortOrder', 'asc')
    .get();
  
  console.log('【获取分类】查询结果:', categories.data);
  
  // 格式化分类数据
  const categoryList = categories.data.map(category => ({
    id: category._id,
    name: category.name,
    icon: category.icon,
    sortOrder: category.sortOrder,
    swipeOffset: 0
  }));
  
  console.log('【获取分类】格式化后的数据:', categoryList);
  
  return {
    code: 200,
    message: 'ok',
    data: { categories: categoryList }
  };
}

/**
 * 更新分类
 */
async function updateCategory(openid, data) {
  const { categoryId, name, icon, merchantId } = data;
  
  // 1. 验证参数
  if (!categoryId) {
    return {
      code: 400,
      message: '缺少分类ID'
    };
  }
  
  if (name !== undefined && !name.trim()) {
    return {
      code: 400,
      message: '分类名称不能为空'
    };
  }
  
  // 2. 验证商家权限
  let merchantInfo = null;
  
  // 如果提供了 merchantId，优先使用 merchantId 查询
  if (merchantId) {
    console.log('【更新分类】使用提供的 merchantId:', merchantId);
    const merchant = await db.collection('merchants').doc(merchantId).get();
    if (merchant.data) {
      merchantInfo = merchant.data;
    }
  }
  
  // 如果没有提供 merchantId 或查询失败，使用 openid 查询（微信登录场景）
  if (!merchantInfo) {
    console.log('【更新分类】使用 openid 查询商家:', openid);
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
  
  // 3. 验证分类是否属于该商家
  const category = await db.collection('categories').doc(categoryId).get();
  
  if (!category.data) {
    return {
      code: 404,
      message: '分类不存在'
    };
  }
  
  if (category.data.merchantId !== merchantInfo._id) {
    return {
      code: 403,
      message: '无权操作'
    };
  }
  
  // 4. 如果要更新名称，检查是否重复
  if (name && name.trim() !== category.data.name) {
    const existingCategory = await db.collection('categories')
      .where({
        storeId: category.data.storeId,
        name: name.trim(),
        status: 'active',
        _id: db.command.neq(categoryId)
      })
      .get();
    
    if (existingCategory.data.length > 0) {
      return {
        code: 400,
        message: '分类名称已存在'
      };
    }
  }
  
  // 5. 更新分类信息
  const updateData = {
    updatedAt: db.serverDate()
  };
  
  if (name !== undefined) {
    updateData.name = name.trim();
  }
  
  if (icon !== undefined) {
    updateData.icon = icon;
  }
  
  await db.collection('categories').doc(categoryId).update({
    data: updateData
  });
  
  return {
    code: 200,
    message: '更新成功'
  };
}

/**
 * 删除分类
 */
async function deleteCategory(openid, data) {
  const { categoryId, merchantId } = data;
  
  // 1. 验证参数
  if (!categoryId) {
    return {
      code: 400,
      message: '缺少分类ID'
    };
  }
  
  // 2. 验证商家权限
  let merchantInfo = null;
  
  // 如果提供了 merchantId，优先使用 merchantId 查询
  if (merchantId) {
    console.log('【删除分类】使用提供的 merchantId:', merchantId);
    const merchant = await db.collection('merchants').doc(merchantId).get();
    if (merchant.data) {
      merchantInfo = merchant.data;
    }
  }
  
  // 如果没有提供 merchantId 或查询失败，使用 openid 查询（微信登录场景）
  if (!merchantInfo) {
    console.log('【删除分类】使用 openid 查询商家:', openid);
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
  
  // 3. 验证分类是否属于该商家
  const category = await db.collection('categories').doc(categoryId).get();
  
  if (!category.data) {
    return {
      code: 404,
      message: '分类不存在'
    };
  }
  
  if (category.data.merchantId !== merchantInfo._id) {
    return {
      code: 403,
      message: '无权操作'
    };
  }
  
  // 4. 检查该分类下是否有商品
  const products = await db.collection('products')
    .where({
      categoryId: categoryId,
      status: db.command.neq('deleted')
    })
    .count();
  
  if (products.total > 0) {
    return {
      code: 400,
      message: `该分类下还有 ${products.total} 个商品，无法删除`
    };
  }
  
  // 5. 逻辑删除分类
  await db.collection('categories').doc(categoryId).update({
    data: {
      status: 'deleted',
      updatedAt: db.serverDate()
    }
  });
  
  return {
    code: 200,
    message: '删除成功'
  };
}

/**
 * 客户端查询店铺分类（按店铺ID）
 */
async function getCategoriesByStore(openid, data) {
  const { storeId } = data;
  
  if (!storeId) {
    return {
      code: 400,
      message: '缺少店铺ID'
    };
  }
  
  // 查询分类列表（只返回活跃状态的）
  const categories = await db.collection('categories')
    .where({
      storeId: storeId,
      status: 'active'
    })
    .orderBy('sortOrder', 'asc')
    .get();
  
  // 格式化分类数据
  const categoryList = categories.data.map(category => ({
    id: category._id,
    name: category.name,
    icon: category.icon,
    sortOrder: category.sortOrder
  }));
  
  return {
    code: 200,
    message: 'ok',
    data: { categories: categoryList }
  };
}

/**
 * 更新分类排序
 */
async function updateCategoryOrder(openid, data) {
  const { categoryIds } = data;
  
  if (!categoryIds || !Array.isArray(categoryIds)) {
    return {
      code: 400,
      message: '缺少分类ID列表'
    };
  }
  
  // 验证商家权限
  const merchant = await db.collection('merchants')
    .where({ openid })
    .get();
  
  if (!merchant.data.length) {
    return {
      code: 403,
      message: '商家不存在'
    };
  }
  
  // 批量更新排序
  const promises = categoryIds.map((categoryId, index) => {
    return db.collection('categories').doc(categoryId).update({
      data: {
        sortOrder: index + 1,
        updatedAt: db.serverDate()
      }
    });
  });
  
  await Promise.all(promises);
  
  return {
    code: 200,
    message: '排序更新成功'
  };
}

