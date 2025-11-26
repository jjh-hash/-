// 消息管理云函数
const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext();
  const { action, data } = event;
  
  console.log('【消息管理】请求:', { action, data, openid: OPENID });
  
  try {
    switch (action) {
      case 'createMessage':
        return await createMessage(OPENID, data);
      case 'getMessageList':
        return await getMessageList(OPENID, data);
      case 'getMessageDetail':
        return await getMessageDetail(OPENID, data);
      case 'updateMessageStatus':
        return await updateMessageStatus(OPENID, data);
      default:
        return {
          code: 400,
          message: '无效的操作类型'
        };
    }
  } catch (error) {
    console.error('【消息管理】失败:', error);
    return {
      code: 500,
      message: '系统异常: ' + error.message
    };
  }
};

/**
 * 创建消息记录
 */
async function createMessage(openid, data) {
  const {
    toUserId,
    toUserName,
    messageType, // order/gaming/express/reward/secondhand
    relatedId,
    relatedTitle,
    contactPhone,
    contactAction = 'call' // call/message
  } = data;

  // 参数验证
  if (!toUserId || !messageType || !relatedId) {
    return {
      code: 400,
      message: '参数不完整'
    };
  }

  try {
    // 获取发送者信息
    const fromUser = await db.collection('users')
      .where({ openid })
      .get();
    
    const fromUserName = fromUser.data && fromUser.data.length > 0 
      ? (fromUser.data[0].nickname || '匿名用户')
      : '匿名用户';

    // 创建消息记录
    const result = await db.collection('messages').add({
      data: {
        fromUserId: openid,
        fromUserName: fromUserName,
        toUserId: toUserId,
        toUserName: toUserName || '匿名用户',
        messageType: messageType,
        relatedId: relatedId,
        relatedTitle: relatedTitle || '',
        contactPhone: contactPhone || '',
        contactAction: contactAction,
        status: 'unread',
        createdAt: db.serverDate(),
        updatedAt: db.serverDate()
      }
    });

    console.log('【创建消息】成功:', result._id);

    return {
      code: 200,
      message: '创建成功',
      data: {
        messageId: result._id
      }
    };
  } catch (error) {
    console.error('【创建消息】失败:', error);
    return {
      code: 500,
      message: '创建失败: ' + error.message
    };
  }
}

/**
 * 获取消息列表
 */
async function getMessageList(openid, data) {
  const {
    page = 1,
    pageSize = 20,
    messageType
  } = data;

  try {
    // 构建查询条件：当前用户是发送者或接收者
    const whereCondition = db.command.or([
      { fromUserId: openid },
      { toUserId: openid }
    ]);

    // 如果指定了消息类型，添加类型筛选
    if (messageType) {
      const query = {
        messageType: messageType
      };
      query.$or = [
        { fromUserId: openid },
        { toUserId: openid }
      ];
      
      try {
        const result = await db.collection('messages')
          .where(query)
          .orderBy('createdAt', 'desc')
          .skip((page - 1) * pageSize)
          .limit(pageSize)
          .get();

        const countResult = await db.collection('messages')
          .where(query)
          .count();

        return {
          code: 200,
          message: '获取成功',
          data: {
            list: result.data || [],
            total: countResult.total || 0,
            page: page,
            pageSize: pageSize
          }
        };
      } catch (collectionError) {
        // 如果集合不存在，返回空列表
        if (collectionError.errCode === -502005 || collectionError.message && collectionError.message.includes('not exist')) {
          return {
            code: 200,
            message: '获取成功',
            data: {
              list: [],
              total: 0,
              page: page,
              pageSize: pageSize
            }
          };
        }
        throw collectionError;
      }
    }

    // 查询消息列表
    try {
      const result = await db.collection('messages')
        .where(whereCondition)
        .orderBy('createdAt', 'desc')
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .get();

      // 获取总数
      const countResult = await db.collection('messages')
        .where(whereCondition)
        .count();

      return {
        code: 200,
        message: '获取成功',
        data: {
          list: result.data || [],
          total: countResult.total || 0,
          page: page,
          pageSize: pageSize
        }
      };
    } catch (collectionError) {
      // 如果集合不存在，返回空列表
      if (collectionError.errCode === -502005 || collectionError.message && collectionError.message.includes('not exist')) {
        return {
          code: 200,
          message: '获取成功',
          data: {
            list: [],
            total: 0,
            page: page,
            pageSize: pageSize
          }
        };
      }
      throw collectionError;
    }
  } catch (error) {
    console.error('【获取消息列表】失败:', error);
    return {
      code: 500,
      message: '获取失败: ' + error.message
    };
  }
}

/**
 * 获取消息详情
 */
async function getMessageDetail(openid, data) {
  const { messageId } = data;

  if (!messageId) {
    return {
      code: 400,
      message: '缺少消息ID'
    };
  }

  try {
    const message = await db.collection('messages').doc(messageId).get();

    if (!message.data) {
      return {
        code: 404,
        message: '消息不存在'
      };
    }

    // 验证权限：只有发送者或接收者可以查看
    if (message.data.fromUserId !== openid && message.data.toUserId !== openid) {
      return {
        code: 403,
        message: '无权查看此消息'
      };
    }

    return {
      code: 200,
      message: '获取成功',
      data: message.data
    };
  } catch (error) {
    console.error('【获取消息详情】失败:', error);
    return {
      code: 500,
      message: '获取失败: ' + error.message
    };
  }
}

/**
 * 更新消息状态
 */
async function updateMessageStatus(openid, data) {
  const { messageId, status } = data;

  if (!messageId || !status) {
    return {
      code: 400,
      message: '参数不完整'
    };
  }

  try {
    // 查询消息信息
    const message = await db.collection('messages').doc(messageId).get();

    if (!message.data) {
      return {
        code: 404,
        message: '消息不存在'
      };
    }

    // 验证权限：只有接收者可以更新状态
    if (message.data.toUserId !== openid) {
      return {
        code: 403,
        message: '无权更新此消息状态'
      };
    }

    // 更新状态
    await db.collection('messages').doc(messageId).update({
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
    console.error('【更新消息状态】失败:', error);
    return {
      code: 500,
      message: '更新失败: ' + error.message
    };
  }
}

