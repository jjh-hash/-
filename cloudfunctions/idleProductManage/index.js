// 闲置商品管理云函数
const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext();
  const { action, data } = event;
  
  console.log('【闲置商品管理】请求:', { action, data, openid: OPENID });
  
  try {
    switch (action) {
      case 'publish':
        return await publishProduct(OPENID, data);
      case 'getList':
        return await getProductList(OPENID, data);
      case 'getDetail':
        return await getProductDetail(OPENID, data);
      case 'delete':
        return await deleteProduct(OPENID, data);
      case 'updateStatus':
        return await updateProductStatus(OPENID, data);
      default:
        return {
          code: 400,
          message: '无效的操作类型'
        };
    }
  } catch (error) {
    console.error('【闲置商品管理】失败:', error);
    return {
      code: 500,
      message: '系统异常: ' + error.message
    };
  }
};

/**
 * 发布闲置商品
 */
async function publishProduct(openid, data) {
  const {
    title,
    description,
    price,
    originalPrice,
    category,
    location,
    tags,
    images,
    sellerId,
    sellerName,
    sellerAvatar
  } = data;

  // 参数验证
  if (!title || !price || !category || !images || images.length === 0) {
    return {
      code: 400,
      message: '参数不完整'
    };
  }

  try {
    // 创建商品记录
    const result = await db.collection('idle_products').add({
      data: {
        title: title,
        description: description || '',
        price: price,
        originalPrice: originalPrice || null,
        category: category,
        location: location || '未填写',
        tags: tags || [],
        images: images,
        sellerId: sellerId || openid,
        sellerName: sellerName || '匿名用户',
        sellerAvatar: sellerAvatar || '',
        status: 'active', // active: 在售, sold: 已售出, deleted: 已删除
        viewCount: 0,
        createdAt: db.serverDate(),
        updatedAt: db.serverDate()
      }
    });

    console.log('【发布闲置商品】成功:', result._id);

    return {
      code: 200,
      message: '发布成功',
      data: {
        productId: result._id
      }
    };
  } catch (error) {
    console.error('【发布闲置商品】失败:', error);
    return {
      code: 500,
      message: '发布失败: ' + error.message
    };
  }
}

/**
 * 获取商品列表
 */
async function getProductList(openid, data) {
  const {
    page = 1,
    pageSize = 20,
    category,
    keyword,
    sort = 'time', // time: 时间, price: 价格, distance: 距离
    sellerId
  } = data;

  try {
    // 构建查询条件
    const whereCondition = {
      status: 'active' // 只查询在售的商品
    };

    if (category && category !== '全部') {
      whereCondition.category = category;
    }

    if (keyword) {
      whereCondition.title = db.RegExp({
        regexp: keyword,
        options: 'i'
      });
    }

    if (sellerId) {
      whereCondition.sellerId = sellerId;
    }

    console.log('【获取商品列表】查询条件:', whereCondition);

    // 构建排序
    let orderBy = 'createdAt';
    let orderDirection = 'desc';

    switch (sort) {
      case 'price':
        orderBy = 'price';
        orderDirection = 'asc';
        break;
      case 'priceDesc':
        orderBy = 'price';
        orderDirection = 'desc';
        break;
      case 'time':
      default:
        orderBy = 'createdAt';
        orderDirection = 'desc';
        break;
    }

    // 查询商品列表
    const result = await db.collection('idle_products')
      .where(whereCondition)
      .orderBy(orderBy, orderDirection)
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .get();

    // 获取总数
    const countResult = await db.collection('idle_products')
      .where(whereCondition)
      .count();

    // 格式化数据
    const products = result.data.map(product => {
      // 计算发布时间
      const createdAt = product.createdAt ? new Date(product.createdAt) : new Date();
      const now = new Date();
      const diffMs = now - createdAt;
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);

      let publishTime = '';
      if (diffMins < 60) {
        publishTime = `${diffMins}分钟前`;
      } else if (diffHours < 24) {
        publishTime = `${diffHours}小时前`;
      } else if (diffDays < 7) {
        publishTime = `${diffDays}天前`;
      } else {
        publishTime = createdAt.toLocaleDateString();
      }

      return {
        ...product,
        id: product._id,
        publishTime: publishTime,
        discount: product.originalPrice 
          ? Math.round((product.originalPrice - product.price) / product.originalPrice * 100)
          : 0
      };
    });

    return {
      code: 200,
      message: '获取成功',
      data: {
        list: products,
        total: countResult.total,
        page: page,
        pageSize: pageSize
      }
    };
  } catch (error) {
    console.error('【获取商品列表】失败:', error);
    return {
      code: 500,
      message: '获取失败: ' + error.message
    };
  }
}

/**
 * 获取商品详情
 */
async function getProductDetail(openid, data) {
  const { productId } = data;

  if (!productId) {
    return {
      code: 400,
      message: '缺少商品ID'
    };
  }

  try {
    const product = await db.collection('idle_products').doc(productId).get();

    if (!product.data) {
      return {
        code: 404,
        message: '商品不存在'
      };
    }

    // 增加浏览次数
    await db.collection('idle_products').doc(productId).update({
      data: {
        viewCount: db.command.inc(1)
      }
    });

    // 格式化数据
    const productData = product.data;
    const createdAt = productData.createdAt ? new Date(productData.createdAt) : new Date();
    const now = new Date();
    const diffMs = now - createdAt;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    let publishTime = '';
    if (diffMins < 60) {
      publishTime = `${diffMins}分钟前`;
    } else if (diffHours < 24) {
      publishTime = `${diffHours}小时前`;
    } else if (diffDays < 7) {
      publishTime = `${diffDays}天前`;
    } else {
      publishTime = createdAt.toLocaleDateString();
    }

    return {
      code: 200,
      message: '获取成功',
      data: {
        ...productData,
        id: productData._id,
        publishTime: publishTime,
        discount: productData.originalPrice 
          ? Math.round((productData.originalPrice - productData.price) / productData.originalPrice * 100)
          : 0
      }
    };
  } catch (error) {
    console.error('【获取商品详情】失败:', error);
    return {
      code: 500,
      message: '获取失败: ' + error.message
    };
  }
}

/**
 * 删除商品
 */
async function deleteProduct(openid, data) {
  const { productId } = data;

  if (!productId) {
    return {
      code: 400,
      message: '缺少商品ID'
    };
  }

  try {
    // 查询商品信息
    const product = await db.collection('idle_products').doc(productId).get();

    if (!product.data) {
      return {
        code: 404,
        message: '商品不存在'
      };
    }

    // 验证是否是商品所有者
    if (product.data.sellerId !== openid) {
      return {
        code: 403,
        message: '无权删除此商品'
      };
    }

    // 标记为已删除
    await db.collection('idle_products').doc(productId).update({
      data: {
        status: 'deleted',
        updatedAt: db.serverDate()
      }
    });

    return {
      code: 200,
      message: '删除成功'
    };
  } catch (error) {
    console.error('【删除商品】失败:', error);
    return {
      code: 500,
      message: '删除失败: ' + error.message
    };
  }
}

/**
 * 更新商品状态（如标记为已售出）
 */
async function updateProductStatus(openid, data) {
  const { productId, status } = data;

  if (!productId || !status) {
    return {
      code: 400,
      message: '参数不完整'
    };
  }

  try {
    // 查询商品信息
    const product = await db.collection('idle_products').doc(productId).get();

    if (!product.data) {
      return {
        code: 404,
        message: '商品不存在'
      };
    }

    // 验证是否是商品所有者
    if (product.data.sellerId !== openid) {
      return {
        code: 403,
        message: '无权修改此商品'
      };
    }

    // 更新状态
    await db.collection('idle_products').doc(productId).update({
      data: {
        status: status,
        updatedAt: db.serverDate()
      }
    });

    return {
      code: 200,
      message: '更新成功'
    };
  } catch (error) {
    console.error('【更新商品状态】失败:', error);
    return {
      code: 500,
      message: '更新失败: ' + error.message
    };
  }
}

