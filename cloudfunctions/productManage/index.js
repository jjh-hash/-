// 商品管理云函数
const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext();
  const { action, data } = event;
  
  console.log('商品管理请求:', { action, data });
  
  try {
    // 根据action执行不同操作
    switch (action) {
      case 'addProduct':
        return await addProduct(OPENID, data);
      case 'getProducts':
        return await getProducts(OPENID, data);
      case 'getProductDetail':
        return await getProductDetail(OPENID, data);
      case 'updateProduct':
        return await updateProduct(OPENID, data);
      case 'deleteProduct':
        return await deleteProduct(OPENID, data);
      case 'setProductStatus':
        return await setProductStatus(OPENID, data);
      case 'getProductsByStore':
        return await getProductsByStore(OPENID, data);
      case 'getProductsForAudit':
        return await getProductsForAudit(OPENID, data);
      case 'auditProduct':
        return await auditProduct(OPENID, data);
      case 'batchAuditProducts':
        return await batchAuditProducts(OPENID, data);
      default:
        return {
          code: 400,
          message: '无效的操作类型'
        };
    }
  } catch (error) {
    console.error('商品管理失败:', error);
    return {
      code: 500,
      message: '系统异常',
      error: error.message
    };
  }
};

/**
 * 添加商品
 */
async function addProduct(openid, data) {
  const { name, categoryId, price, description, coverUrl, stock, spec, attr, prepTime, specifications } = data;
  
  console.log('【添加商品】接收到的参数:', data);
  
  // 1. 验证参数
  if (!name || !name.trim()) {
    return {
      code: 400,
      message: '商品名称不能为空'
    };
  }
  
  if (!categoryId) {
    return {
      code: 400,
      message: '请选择商品分类'
    };
  }
  
  if (!price || price <= 0) {
    return {
      code: 400,
      message: '商品价格必须大于0'
    };
  }
  
  // 2. 验证商家身份
  const merchant = await db.collection('merchants')
    .where({ openid })
    .get();
  
  if (!merchant.data.length) {
    return {
      code: 403,
      message: '商家不存在'
    };
  }
  
  const merchantInfo = merchant.data[0];
  let storeId = merchantInfo.storeId;
  
  if (!storeId) {
    storeId = merchantInfo._id;
    console.log('商家未关联店铺，使用商家ID作为店铺ID:', storeId);
  }
  
  // 3. 验证分类是否存在
  const category = await db.collection('categories').doc(categoryId).get();
  
  if (!category.data || category.data.status !== 'active') {
    return {
      code: 400,
      message: '分类不存在或已删除'
    };
  }
  
  // 检查商家是否已通过审核，只有已通过审核的商家才能上架商品
  if (merchantInfo.status !== 'active') {
    return {
      code: 403,
      message: '商家审核未通过，无法上架商品'
    };
  }
  
  // 所有商品默认都需要管理员审核，无论商家状态如何
  const auditStatus = 'pending';
  
  // 4. 创建商品
  const productData = {
    storeId,
    merchantId: merchantInfo._id,
    categoryId,
    name: name.trim(),
    price: Math.round(price * 100), // 转换为分
    description: description || '',
    coverUrl: coverUrl || '',
    stock: stock || 0,
    sales: 0,
    status: 'on', // on/off/deleted
    auditStatus: auditStatus, // approved/pending/rejected
    // 扩展字段
    spec: spec || '', // 商品规格（保留兼容）
    attr: attr || '', // 商品属性（保留兼容）
    prepTime: prepTime || '', // 备餐用时
    createdAt: db.serverDate(),
    updatedAt: db.serverDate()
  };
  
  // 添加规格配置（如果存在）
  if (specifications && Array.isArray(specifications) && specifications.length > 0) {
    productData.specifications = specifications;
  }
  
  const productResult = await db.collection('products').add({
    data: productData
  });
  
  console.log('商品创建成功:', productResult._id);
  
  return {
    code: 200,
    message: '添加成功',
    data: {
      productId: productResult._id
    }
  };
}

/**
 * 获取商品列表
 */
async function getProducts(openid, data) {
  console.log('【获取商品】接收到的参数:', data);
  
  const { categoryId, status, merchantId } = data || {};
  
  // 查询商家信息
  let merchantInfo = null;
  
  // 如果提供了 merchantId，优先使用 merchantId 查询
  if (merchantId) {
    console.log('【获取商品】使用提供的 merchantId:', merchantId);
    const merchant = await db.collection('merchants').doc(merchantId).get();
    if (merchant.data) {
      merchantInfo = merchant.data;
    }
  }
  
  // 如果没有提供 merchantId 或查询失败，使用 openid 查询（微信登录场景）
  if (!merchantInfo) {
    console.log('【获取商品】使用 openid 查询商家:', openid);
    const merchant = await db.collection('merchants')
      .where({ openid })
      .get();
    
    if (!merchant.data.length) {
      return {
        code: 200,
        message: 'ok',
        data: { products: [] }
      };
    }
    
    merchantInfo = merchant.data[0];
  }
  
  let storeId = merchantInfo.storeId || merchantInfo._id;
  
  console.log('【获取商品】使用店铺ID:', storeId);
  
  // 构建查询条件
  const whereCondition = {
    storeId: storeId
  };
  
  // 状态筛选：on/off/deleted
  if (status) {
    whereCondition.status = status;
  } else {
    // 默认不包含已删除的商品
    whereCondition.status = db.command.neq('deleted');
  }
  
  // 分类筛选
  if (categoryId) {
    whereCondition.categoryId = categoryId;
  }
  
  console.log('【获取商品】查询条件:', whereCondition);
  
  // 查询商品列表
  const products = await db.collection('products')
    .where(whereCondition)
    .orderBy('createdAt', 'desc')
    .get();
  
  console.log('【获取商品】查询结果:', products.data);
  
  // 格式化商品数据
  const productList = products.data.map(product => ({
    id: product._id,
    name: product.name,
    categoryId: product.categoryId,
    price: (product.price / 100).toFixed(2), // 转换为元
    description: product.description,
    coverUrl: product.coverUrl,
    stock: product.stock,
    sales: product.sales,
    status: product.status,
    auditStatus: product.auditStatus || 'pending', // 审核状态
    swipeOffset: 0
  }));
  
  console.log('【获取商品】格式化后的数据:', productList);
  
  return {
    code: 200,
    message: 'ok',
    data: { products: productList }
  };
}

/**
 * 获取商品详情
 */
async function getProductDetail(openid, data) {
  const { productId, merchantId, storeId: providedStoreId } = data;
  
  console.log('【获取商品详情】商品ID:', productId, '商家ID:', merchantId, '店铺ID:', providedStoreId);
  
  // 1. 验证参数
  if (!productId) {
    return {
      code: 400,
      message: '缺少商品ID'
    };
  }
  
  // 2. 查询商品
  const product = await db.collection('products').doc(productId).get();
  
  if (!product.data) {
    return {
      code: 404,
      message: '商品不存在'
    };
  }
  
  console.log('【获取商品详情】查询结果:', product.data);
  
  // 3. 验证商家权限
  let storeId = providedStoreId;
  let merchantInfo = null;
  
  // 如果传入了 merchantId，优先使用 merchantId 查找商家
  if (merchantId) {
    const merchant = await db.collection('merchants').doc(merchantId).get();
    if (merchant.data) {
      merchantInfo = merchant.data;
      storeId = storeId || merchantInfo.storeId || merchantInfo._id;
    }
  }
  
  // 如果传入了 storeId，直接使用
  if (!storeId && !merchantInfo) {
    // 如果没有传入 merchantId 或 storeId，则通过 openid 查找商家
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
    storeId = merchantInfo.storeId || merchantInfo._id;
  }
  
  if (!storeId) {
    return {
      code: 403,
      message: '无法确定商家身份'
    };
  }
  
  // 检查商品是否属于该商家
  if (product.data.storeId !== storeId) {
    return {
      code: 403,
      message: '无权查看此商品'
    };
  }
  
  // 4. 获取分类信息
  let categoryName = '';
  if (product.data.categoryId) {
    const category = await db.collection('categories').doc(product.data.categoryId).get();
    if (category.data) {
      categoryName = category.data.name;
    }
  }
  
  // 5. 格式化商品数据
  const productDetail = {
    id: product.data._id,
    name: product.data.name,
    categoryId: product.data.categoryId,
    categoryName: categoryName,
    price: (product.data.price / 100).toFixed(2), // 转换为元
    description: product.data.description || '',
    coverUrl: product.data.coverUrl || '',
    stock: product.data.stock || 0,
    sales: product.data.sales || 0,
    status: product.data.status,
    // 扩展字段
    spec: product.data.spec || '',
    attr: product.data.attr || '',
    prepTime: product.data.prepTime || '',
    // 规格配置（转换价格从分到元，保留 type 字段）
    specifications: product.data.specifications ? product.data.specifications.map(group => ({
      name: group.name || '',
      type: group.type || 'single', // 保留规格组类型，默认为单选
      options: (group.options || []).map(option => ({
        name: option.name || '',
        price: option.price ? (typeof option.price === 'number' ? option.price / 100 : parseFloat(option.price) / 100) : 0
      }))
    })) : []
  };
  
  console.log('【获取商品详情】格式化后的数据:', productDetail);
  
  return {
    code: 200,
    message: 'ok',
    data: { product: productDetail }
  };
}

/**
 * 更新商品
 */
async function updateProduct(openid, data) {
  const { productId, name, categoryId, price, description, coverUrl, stock, spec, attr, prepTime, specifications, merchantId, storeId: providedStoreId } = data;
  
  // 1. 验证参数
  if (!productId) {
    return {
      code: 400,
      message: '缺少商品ID'
    };
  }
  
  // 2. 验证商品是否存在
  const product = await db.collection('products').doc(productId).get();
  
  if (!product.data) {
    return {
      code: 404,
      message: '商品不存在'
    };
  }
  
  // 3. 验证商家权限
  let storeId = providedStoreId;
  let merchantInfo = null;
  
  // 如果传入了 merchantId，优先使用 merchantId 查找商家
  if (merchantId) {
    const merchant = await db.collection('merchants').doc(merchantId).get();
    if (merchant.data) {
      merchantInfo = merchant.data;
      storeId = storeId || merchantInfo.storeId || merchantInfo._id;
    }
  }
  
  // 如果传入了 storeId，直接使用
  if (!storeId && !merchantInfo) {
    // 如果没有传入 merchantId 或 storeId，则通过 openid 查找商家
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
    storeId = merchantInfo.storeId || merchantInfo._id;
  }
  
  if (!storeId) {
    return {
      code: 403,
      message: '无法确定商家身份'
    };
  }
  
  // 检查商品是否属于该商家（通过storeId）
  if (product.data.storeId !== storeId) {
    return {
      code: 403,
      message: '无权操作'
    };
  }
  
  // 4. 更新商品信息
  const updateData = {
    updatedAt: db.serverDate()
  };
  
  if (name !== undefined) {
    updateData.name = name.trim();
  }
  
  if (categoryId !== undefined) {
    updateData.categoryId = categoryId;
  }
  
  if (price !== undefined) {
    updateData.price = Math.round(price * 100);
  }
  
  if (description !== undefined) {
    updateData.description = description;
  }
  
  if (coverUrl !== undefined) {
    updateData.coverUrl = coverUrl;
  }
  
  if (stock !== undefined) {
    updateData.stock = stock;
  }
  
  // 扩展字段
  if (spec !== undefined) {
    updateData.spec = spec;
  }
  
  if (attr !== undefined) {
    updateData.attr = attr;
  }
  
  if (prepTime !== undefined) {
    updateData.prepTime = prepTime;
  }
  
  // 更新规格配置
  if (specifications !== undefined) {
    if (specifications && Array.isArray(specifications) && specifications.length > 0) {
      updateData.specifications = specifications;
    } else {
      // 如果传入空数组，清空规格配置
      updateData.specifications = [];
    }
  }
  
  await db.collection('products').doc(productId).update({
    data: updateData
  });
  
  return {
    code: 200,
    message: '更新成功'
  };
}

/**
 * 删除商品
 */
async function deleteProduct(openid, data) {
  const { productId } = data;
  
  // 1. 验证参数
  if (!productId) {
    return {
      code: 400,
      message: '缺少商品ID'
    };
  }
  
  // 2. 验证商家权限
  const merchant = await db.collection('merchants')
    .where({ openid })
    .get();
  
  if (!merchant.data.length) {
    return {
      code: 403,
      message: '商家不存在'
    };
  }
  
  // 3. 验证商品是否属于该商家
  const product = await db.collection('products').doc(productId).get();
  
  if (!product.data) {
    return {
      code: 404,
      message: '商品不存在'
    };
  }
  
  if (product.data.merchantId !== merchant.data[0]._id) {
    return {
      code: 403,
      message: '无权操作'
    };
  }
  
  // 4. 逻辑删除商品
  await db.collection('products').doc(productId).update({
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
 * 设置商品状态（上架/下架）
 */
async function setProductStatus(openid, data) {
  const { productId, status, merchantId, storeId: providedStoreId } = data;
  
  if (!productId || !status) {
    return {
      code: 400,
      message: '缺少必要参数'
    };
  }
  
  if (!['on', 'off'].includes(status)) {
    return {
      code: 400,
      message: '无效的状态值'
    };
  }
  
  // 验证商品是否存在
  const product = await db.collection('products').doc(productId).get();
  
  if (!product.data) {
    return {
      code: 404,
      message: '商品不存在'
    };
  }
  
  // 验证商家权限
  let storeId = providedStoreId;
  let merchantInfo = null;
  
  // 如果传入了 merchantId，优先使用 merchantId 查找商家
  if (merchantId) {
    const merchant = await db.collection('merchants').doc(merchantId).get();
    if (merchant.data) {
      merchantInfo = merchant.data;
      storeId = storeId || merchantInfo.storeId || merchantInfo._id;
    }
  }
  
  // 如果传入了 storeId，直接使用
  if (!storeId && !merchantInfo) {
    // 如果没有传入 merchantId 或 storeId，则通过 openid 查找商家
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
    storeId = merchantInfo.storeId || merchantInfo._id;
  }
  
  if (!storeId) {
    return {
      code: 403,
      message: '无法确定商家身份'
    };
  }
  
  // 检查商品是否属于该商家（通过storeId）
  if (product.data.storeId !== storeId) {
    return {
      code: 403,
      message: '无权操作'
    };
  }
  
  // 更新状态
  await db.collection('products').doc(productId).update({
    data: {
      status: status,
      updatedAt: db.serverDate()
    }
  });
  
  return {
    code: 200,
    message: '状态更新成功'
  };
}

/**
 * 客户端查询店铺商品（按店铺ID）
 */
async function getProductsByStore(openid, data) {
  const { storeId, categoryId } = data;
  
  if (!storeId) {
    return {
      code: 400,
      message: '缺少店铺ID'
    };
  }
  
  // 先检查商家的审核状态
  const merchant = await db.collection('merchants')
    .where({ storeId: storeId })
    .get();
  
  if (!merchant.data.length || merchant.data[0].status !== 'active') {
    // 商家未通过审核，返回空列表
    return {
      code: 200,
      message: 'ok',
      data: { products: [] }
    };
  }
  
  // 构建查询条件（只返回上架且审核通过的商品）
  const whereCondition = {
    storeId: storeId,
    status: 'on',
    auditStatus: 'approved'
  };
  
  // 分类筛选
  if (categoryId) {
    whereCondition.categoryId = categoryId;
  }
  
  // 查询商品列表
  const products = await db.collection('products')
    .where(whereCondition)
    .orderBy('createdAt', 'desc')
    .get();
  
  // 格式化商品数据
  const productList = products.data.map(product => ({
    id: product._id,
    name: product.name,
    categoryId: product.categoryId,
    price: (product.price / 100).toFixed(2),
    description: product.description,
    coverUrl: product.coverUrl,
    stock: product.stock,
    sales: product.sales
  }));
  
  return {
    code: 200,
    message: 'ok',
    data: { products: productList }
  };
}

/**
 * 管理端查询待审核商品
 */
async function getProductsForAudit(openid, data) {
  const { auditStatus, page = 1, pageSize = 20 } = data || {};
  
  // 构建查询条件
  const whereCondition = {
    status: db.command.neq('deleted')
  };
  
  // 审核状态筛选
  if (auditStatus) {
    whereCondition.auditStatus = auditStatus;
  }
  
  // 查询商品列表
  const result = await db.collection('products')
    .where(whereCondition)
    .orderBy('createdAt', 'desc')
    .skip((page - 1) * pageSize)
    .limit(pageSize)
    .get();
  
  // 获取总数
  const countResult = await db.collection('products')
    .where(whereCondition)
    .count();
  
  // 格式化商品数据
  const productList = result.data.map(product => ({
    id: product._id,
    storeId: product.storeId,
    merchantId: product.merchantId,
    categoryId: product.categoryId,
    name: product.name,
    price: (product.price / 100).toFixed(2),
    coverUrl: product.coverUrl,
    status: product.status,
    auditStatus: product.auditStatus,
    createTime: formatDate(product.createdAt)
  }));
  
  return {
    code: 200,
    message: 'ok',
    data: {
      products: productList,
      total: countResult.total,
      page: page,
      pageSize: pageSize
    }
  };
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
  const month = String(chinaTime.getUTCMonth() + 1).padStart(2, '0');
  const day = String(chinaTime.getUTCDate()).padStart(2, '0');
  const hour = String(chinaTime.getUTCHours()).padStart(2, '0');
  const minute = String(chinaTime.getUTCMinutes()).padStart(2, '0');
  
  return `${year}-${month}-${day} ${hour}:${minute}`;
}

/**
 * 审核商品（单个）
 */
async function auditProduct(openid, data) {
  const { productId, auditStatus, auditReason } = data;
  
  console.log('【审核商品】接收到的参数:', { productId, auditStatus, auditReason });
  
  // 1. 验证参数
  if (!productId || !auditStatus) {
    return {
      code: 400,
      message: '缺少必要参数'
    };
  }
  
  // 验证审核状态值
  if (!['approved', 'rejected'].includes(auditStatus)) {
    return {
      code: 400,
      message: '无效的审核状态'
    };
  }
  
  // 2. 查询商品
  const product = await db.collection('products').doc(productId).get();
  
  if (!product.data) {
    return {
      code: 404,
      message: '商品不存在'
    };
  }
  
  console.log('【审核商品】商品信息:', product.data);
  
  // 3. 准备更新数据
  const updateData = {
    auditStatus: auditStatus,
    updatedAt: db.serverDate()
  };
  
  // 如果有审核理由，则添加
  if (auditReason) {
    updateData.auditReason = auditReason;
  }
  
  // 如果审核通过，记录审核时间
  if (auditStatus === 'approved') {
    updateData.auditedAt = db.serverDate();
  }
  
  // 4. 更新商品审核状态
  await db.collection('products').doc(productId).update({
    data: updateData
  });
  
  console.log('【审核商品】更新成功');
  
  // 5. 记录管理员操作日志（如果需要）
  try {
    await db.collection('admin_logs').add({
      data: {
        adminId: openid,
        action: 'auditProduct',
        target: product.data.name,
        targetType: 'product',
        result: auditStatus === 'approved' ? 'approved' : 'rejected',
        details: {
          productId: productId,
          auditReason: auditReason || ''
        },
        createdAt: db.serverDate()
      }
    });
  } catch (error) {
    console.error('【审核商品】记录日志失败:', error);
  }
  
  return {
    code: 200,
    message: auditStatus === 'approved' ? '审核通过成功' : '审核拒绝成功'
  };
}

/**
 * 批量审核商品
 */
async function batchAuditProducts(openid, data) {
  const { productIds, auditStatus, auditReason } = data;
  
  console.log('【批量审核商品】接收到的参数:', { productIds, auditStatus, auditReason });
  
  // 1. 验证参数
  if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
    return {
      code: 400,
      message: '缺少商品ID列表'
    };
  }
  
  if (!auditStatus) {
    return {
      code: 400,
      message: '缺少审核状态'
    };
  }
  
  // 验证审核状态值
  if (!['approved', 'rejected'].includes(auditStatus)) {
    return {
      code: 400,
      message: '无效的审核状态'
    };
  }
  
  // 2. 批量更新
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
  
  // 使用 db.command.in 批量更新
  const _ = db.command;
  const updateResult = await db.collection('products')
    .where({
      _id: _.in(productIds)
    })
    .update({
      data: updateData
    });
  
  console.log('【批量审核商品】更新结果:', updateResult);
  
  // 3. 记录管理员操作日志
  try {
    await db.collection('admin_logs').add({
      data: {
        adminId: openid,
        action: 'batchAuditProducts',
        target: `批量审核${productIds.length}个商品`,
        targetType: 'product',
        result: auditStatus === 'approved' ? 'approved' : 'rejected',
        details: {
          productIds: productIds,
          count: productIds.length,
          auditReason: auditReason || ''
        },
        createdAt: db.serverDate()
      }
    });
  } catch (error) {
    console.error('【批量审核商品】记录日志失败:', error);
  }
  
  return {
    code: 200,
    message: `批量审核成功，共处理${productIds.length}个商品`,
    data: {
      count: productIds.length
    }
  };
}

