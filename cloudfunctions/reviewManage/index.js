const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();

exports.main = async (event, context) => {
  const { action, data } = event;
  const { OPENID } = cloud.getWXContext();

  try {
    switch (action) {
      // 提交评论
      case 'submitReview':
        return await submitReview(data, OPENID);
      
      // 获取评论列表
      case 'getReviewList':
        return await getReviewList(data);
      
      // 获取我的评价列表
      case 'getMyReviews':
        return await getMyReviews(OPENID);
      
      // 删除我的评价
      case 'deleteReview':
        return await deleteReview(data, OPENID);
      
      // 商家回复评论
      case 'merchantReply':
        return await merchantReply(data, OPENID);
      
      // 获取店铺评分统计
      case 'getStoreRating':
        return await getStoreRating(data);
      
      default:
        return {
          code: 400,
          message: '未知操作',
          data: null
        };
    }
  } catch (error) {
    console.error('评论管理云函数错误:', error);
    return {
      code: 500,
      message: '服务器错误: ' + error.message,
      data: null
    };
  }
};

// 提交评论
async function submitReview(data, openid) {
  const { orderId, storeId, rating, content, images } = data;

  // 参数验证
  if (!storeId || !rating) {
    return {
      code: 400,
      message: '缺少必要参数',
      data: null
    };
  }

  // 评分验证
  if (rating < 1 || rating > 5) {
    return {
      code: 400,
      message: '评分必须在1-5之间',
      data: null
    };
  }

  // 评论内容和图片至少要有一个
  const hasContent = content && content.trim().length > 0;
  const hasImages = images && images.length > 0;
  
  if (!hasContent && !hasImages) {
    return {
      code: 400,
      message: '请填写评论内容或上传图片',
      data: null
    };
  }

  try {
    // 检查订单是否存在且属于该用户（如果提供了orderId）
    if (orderId && !orderId.startsWith('temp_')) {
      const orderResult = await db.collection('orders')
        .doc(orderId)
        .get();

      if (!orderResult.data) {
        return {
          code: 404,
          message: '订单不存在',
          data: null
        };
      }

      const order = orderResult.data;
      // 订单归属校验：使用 userOpenid 比较（createOrder 写入了 userOpenid）
      if (order.userOpenid && order.userOpenid !== openid) {
        return {
          code: 403,
          message: '无权评论此订单',
          data: null
        };
      }

      // 检查是否已经评论过
      const existingReview = await db.collection('reviews')
        .where({
          orderId: orderId,
          userId: openid
        })
        .get();

      if (existingReview.data.length > 0) {
        return {
          code: 400,
          message: '该订单已经评论过了',
          data: null
        };
      }
    }

    // 获取用户信息
    const userResult = await db.collection('users')
      .where({ openid: openid })
      .get();

    const user = userResult.data[0] || {};

    // 创建评论
    const reviewData = {
      orderId: orderId || null,
      userId: openid,
      userName: user.nickname || '用户',
      userAvatar: user.avatar || '',
      storeId: storeId,
      rating: parseInt(rating) || 5, // 确保是数字类型
      content: content || '',
      images: images || [],
      merchantReply: null,
      hasMerchantReply: false,
      createdAt: db.serverDate(),
      updatedAt: db.serverDate()
    };
    
    console.log('保存评论数据，rating:', reviewData.rating, '类型:', typeof reviewData.rating);

    const result = await db.collection('reviews').add({
      data: reviewData
    });

    // 更新订单状态为已评价（如果提供了有效的orderId）
    if (orderId && !orderId.startsWith('temp_')) {
      try {
        await db.collection('orders').doc(orderId).update({
          data: {
            hasReview: true,
            reviewId: result._id,
            updatedAt: new Date()
          }
        });
      } catch (err) {
        console.log('更新订单状态失败（可能订单不存在）:', err);
      }
    }

    // 更新店铺评分统计
    await updateStoreRating(storeId);

    return {
      code: 200,
      message: '评论提交成功',
      data: {
        reviewId: result._id
      }
    };
  } catch (error) {
    console.error('提交评论失败:', error);
    return {
      code: 500,
      message: '提交评论失败: ' + error.message,
      data: null
    };
  }
}

// 获取评论列表
async function getReviewList(data) {
  const { storeId, page = 1, pageSize = 20, filter = 'all' } = data;

  console.log('【获取评论列表】参数:', { storeId, page, pageSize, filter });

  if (!storeId) {
    return {
      code: 400,
      message: '缺少店铺ID',
      data: null
    };
  }

  try {
    // 构建查询条件
    let whereCondition = {
      storeId: storeId
    };

    console.log('【获取评论列表】查询条件:', whereCondition);

    // 筛选条件
    if (filter === 'good') {
      whereCondition.rating = db.command.gte(4);
    } else if (filter === 'neutral') {
      whereCondition.rating = db.command.and(db.command.gte(3), db.command.lt(4));
    } else if (filter === 'bad') {
      whereCondition.rating = db.command.lt(3);
    } else if (filter === 'withImage') {
      whereCondition.images = db.command.neq([]);
    }

    // 查询评论列表
    const result = await db.collection('reviews')
      .where(whereCondition)
      .orderBy('createdAt', 'desc')
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .get();

    console.log('【获取评论列表】查询结果数量:', result.data.length);
    console.log('【获取评论列表】原始数据:', JSON.stringify(result.data.slice(0, 2)));

    // 获取总数
    const countResult = await db.collection('reviews')
      .where(whereCondition)
      .count();

    console.log('【获取评论列表】总数:', countResult.total);

    // 确保返回的数据格式正确
    const formattedList = result.data.map(review => {
      // 处理日期字段
      let createdAt = review.createdAt;
      if (createdAt && typeof createdAt === 'object' && createdAt.getTime) {
        // 如果是Date对象，转换为字符串
        createdAt = createdAt.toISOString();
      } else if (!createdAt) {
        createdAt = new Date().toISOString();
      }

      return {
        _id: review._id,
        orderId: review.orderId || null,
        userId: review.userId || '',
        userName: review.userName || '用户',
        userAvatar: review.userAvatar || '',
        storeId: review.storeId || storeId,
        rating: review.rating || 5, // 确保有默认值
        content: review.content || '',
        images: review.images || [],
        merchantReply: review.merchantReply || null,
        hasMerchantReply: review.hasMerchantReply || false,
        createdAt: createdAt
      };
    });

    return {
      code: 200,
      message: '获取成功',
      data: {
        list: formattedList,
        total: countResult.total,
        page: page,
        pageSize: pageSize
      }
    };
  } catch (error) {
    console.error('【获取评论列表】失败:', error);
    return {
      code: 500,
      message: '获取评论列表失败: ' + error.message,
      data: null
    };
  }
}

// 商家回复评论
async function merchantReply(data, openid) {
  const { reviewId, replyContent } = data;

  if (!reviewId || !replyContent) {
    return {
      code: 400,
      message: '缺少必要参数',
      data: null
    };
  }

  try {
    // 检查评论是否存在
    const reviewResult = await db.collection('reviews')
      .doc(reviewId)
      .get();

    if (!reviewResult.data) {
      return {
        code: 404,
        message: '评论不存在',
        data: null
      };
    }

    // 验证商家权限
    const merchantResult = await db.collection('merchants')
      .where({ openid: openid })
      .get();

    if (merchantResult.data.length === 0) {
      return {
        code: 403,
        message: '无权限回复',
        data: null
      };
    }

    const merchant = merchantResult.data[0];
    const review = reviewResult.data;

    // 验证是否是该商家的店铺
    const storeResult = await db.collection('stores')
      .doc(review.storeId)
      .get();

    if (!storeResult.data || storeResult.data.merchantId !== merchant._id) {
      return {
        code: 403,
        message: '无权回复此评论',
        data: null
      };
    }

    // 更新评论的商家回复
    await db.collection('reviews').doc(reviewId).update({
      data: {
        merchantReply: replyContent,
        hasMerchantReply: true,
        merchantReplyAt: db.serverDate(),
        updatedAt: db.serverDate()
      }
    });

    return {
      code: 200,
      message: '回复成功',
      data: null
    };
  } catch (error) {
    console.error('商家回复失败:', error);
    return {
      code: 500,
      message: '回复失败: ' + error.message,
      data: null
    };
  }
}

// 获取店铺评分统计
async function getStoreRating(data) {
  const { storeId } = data;

  if (!storeId) {
    return {
      code: 400,
      message: '缺少店铺ID',
      data: null
    };
  }

  try {
    // 获取所有评论
    const reviewsResult = await db.collection('reviews')
      .where({ storeId: storeId })
      .get();

    const reviews = reviewsResult.data;

    if (reviews.length === 0) {
      return {
        code: 200,
        message: '暂无评论',
        data: {
          overallRating: 0,
          deliveryRating: 0,
          totalReviews: 0,
          ratingDistribution: {
            5: 0,
            4: 0,
            3: 0,
            2: 0,
            1: 0
          }
        }
      };
    }

    // 计算评分统计
    let totalRating = 0;
    let totalDeliveryRating = 0;
    const ratingDistribution = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };

    reviews.forEach(review => {
      totalRating += review.rating;
      ratingDistribution[review.rating] = (ratingDistribution[review.rating] || 0) + 1;
      
      // 如果有配送评分，累加
      if (review.deliveryRating) {
        totalDeliveryRating += review.deliveryRating;
      }
    });

    const overallRating = (totalRating / reviews.length).toFixed(1);
    const deliveryRating = totalDeliveryRating > 0 
      ? (totalDeliveryRating / reviews.length).toFixed(1) 
      : overallRating;

    return {
      code: 200,
      message: '获取成功',
      data: {
        overallRating: parseFloat(overallRating),
        deliveryRating: parseFloat(deliveryRating),
        totalReviews: reviews.length,
        ratingDistribution: ratingDistribution
      }
    };
  } catch (error) {
    console.error('获取店铺评分失败:', error);
    return {
      code: 500,
      message: '获取店铺评分失败: ' + error.message,
      data: null
    };
  }
}

// 获取我的评价列表
async function getMyReviews(openid) {
  try {
    // 查询该用户的所有评论
    const result = await db.collection('reviews')
      .where({
        userId: openid
      })
      .orderBy('createdAt', 'desc')
      .get();

    // 获取店铺信息
    const reviews = await Promise.all(result.data.map(async (review) => {
      if (review.storeId) {
        try {
          const storeResult = await db.collection('stores')
            .doc(review.storeId)
            .get();
          
          return {
            ...review,
            storeName: storeResult.data ? storeResult.data.name : '店铺'
          };
        } catch (err) {
          return {
            ...review,
            storeName: '店铺'
          };
        }
      }
      return {
        ...review,
        storeName: '店铺'
      };
    }));

    return {
      code: 200,
      message: '获取成功',
      data: {
        list: reviews.map(review => ({
          _id: review._id,
          orderId: review.orderId || null,
          userId: review.userId || '',
          userName: review.userName || '用户',
          userAvatar: review.userAvatar || '',
          storeId: review.storeId || '',
          storeName: review.storeName || '店铺',
          rating: review.rating || 5,
          content: review.content || '',
          images: review.images || [],
          merchantReply: review.merchantReply || null,
          hasMerchantReply: review.hasMerchantReply || false,
          createdAt: review.createdAt ? (typeof review.createdAt === 'object' && review.createdAt.getTime ? review.createdAt.toISOString() : review.createdAt) : new Date().toISOString()
        })),
        total: reviews.length
      }
    };
  } catch (error) {
    console.error('获取我的评价失败:', error);
    return {
      code: 500,
      message: '获取我的评价失败: ' + error.message,
      data: null
    };
  }
}

// 删除我的评价
async function deleteReview(data, openid) {
  const { reviewId } = data;

  if (!reviewId) {
    return {
      code: 400,
      message: '缺少评论ID',
      data: null
    };
  }

  try {
    // 检查评论是否存在且属于该用户
    const reviewResult = await db.collection('reviews')
      .doc(reviewId)
      .get();

    if (!reviewResult.data) {
      return {
        code: 404,
        message: '评论不存在',
        data: null
      };
    }

    const review = reviewResult.data;
    if (review.userId !== openid) {
      return {
        code: 403,
        message: '无权删除此评论',
        data: null
      };
    }

    // 删除评论
    await db.collection('reviews').doc(reviewId).remove();

    // 更新店铺评分
    if (review.storeId) {
      await updateStoreRating(review.storeId);
    }

    return {
      code: 200,
      message: '删除成功',
      data: null
    };
  } catch (error) {
    console.error('删除评论失败:', error);
    return {
      code: 500,
      message: '删除评论失败: ' + error.message,
      data: null
    };
  }
}

// 更新店铺评分
async function updateStoreRating(storeId) {
  try {
    const reviewsResult = await db.collection('reviews')
      .where({ storeId: storeId })
      .get();

    const reviews = reviewsResult.data;

    if (reviews.length === 0) {
      return;
    }

    let totalRating = 0;
    reviews.forEach(review => {
      totalRating += review.rating;
    });

    const avgRating = (totalRating / reviews.length).toFixed(1);

    // 更新店铺评分
    await db.collection('stores').doc(storeId).update({
      data: {
        ratingAvg: parseFloat(avgRating),
        ratingCount: reviews.length,
        updatedAt: new Date()
      }
    });
  } catch (error) {
    console.error('更新店铺评分失败:', error);
  }
}

