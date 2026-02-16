// 聊天管理云函数
const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const _ = db.command;

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext();
  const { action, data } = event;
  
  console.log('【聊天管理】请求:', { action, data, openid: OPENID });
  
  try {
    switch (action) {
      case 'sendMessage':
        return await sendMessage(OPENID, data);
      case 'getChatMessages':
        return await getChatMessages(OPENID, data);
      case 'getChatList':
        return await getChatList(OPENID, data);
      case 'markAsRead':
        return await markAsRead(OPENID, data);
      default:
        return {
          code: 400,
          message: '无效的操作类型'
        };
    }
  } catch (error) {
    console.error('【聊天管理】失败:', error);
    return {
      code: 500,
      message: '系统异常: ' + error.message
    };
  }
};

/**
 * 发送聊天消息
 */
async function sendMessage(openid, data) {
  const {
    toUserId,
    toUserName,
    content,
    messageType, // order/gaming/express/reward/secondhand
    relatedId,
    relatedTitle
  } = data;

  // 参数验证
  if (!toUserId || !content || !content.trim()) {
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
    
    const fromUserData = fromUser.data && fromUser.data.length > 0 ? fromUser.data[0] : null;
    const fromUserName = fromUserData 
      ? (fromUserData.nickname || '匿名用户')
      : '匿名用户';
    const fromUserAvatar = (fromUserData && fromUserData.avatar) || '';

    // 生成会话ID（确保两个用户之间的会话ID唯一且一致）
    const chatId = generateChatId(openid, toUserId);

    // 获取接收者信息（用于头像）
    let toUserAvatar = '';
    try {
      const toUser = await db.collection('users')
        .where({ openid: toUserId })
        .get();
      if (toUser.data && toUser.data.length > 0) {
        toUserAvatar = toUser.data[0].avatar || '';
      }
    } catch (err) {
      console.error('获取接收者头像失败:', err);
    }

    // 创建聊天消息
    const result = await db.collection('chat_messages').add({
      data: {
        chatId: chatId,
        fromUserId: openid,
        fromUserName: fromUserName,
        fromUserAvatar: fromUserAvatar,
        toUserId: toUserId,
        toUserName: toUserName || '匿名用户',
        toUserAvatar: toUserAvatar,
        content: content.trim(),
        messageType: messageType || 'order',
        relatedId: relatedId || '',
        relatedTitle: relatedTitle || '',
        status: 'unread',
        createdAt: db.serverDate(),
        updatedAt: db.serverDate()
      }
    });

    // 更新会话列表
    await updateChatList(openid, toUserId, toUserName, fromUserName, content.trim(), messageType, relatedId, relatedTitle);

    console.log('【发送聊天消息】成功:', result._id);

    return {
      code: 200,
      message: '发送成功',
      data: {
        messageId: result._id,
        chatId: chatId
      }
    };
  } catch (error) {
    console.error('【发送聊天消息】失败:', error);
    return {
      code: 500,
      message: '发送失败: ' + error.message
    };
  }
}

/**
 * 获取聊天消息列表
 */
async function getChatMessages(openid, data) {
  const {
    chatId,
    toUserId,
    page = 1,
    pageSize = 50
  } = data;

  try {
    // 如果没有提供chatId，通过toUserId生成
    let targetChatId = chatId;
    if (!targetChatId && toUserId) {
      targetChatId = generateChatId(openid, toUserId);
    }

    if (!targetChatId) {
      return {
        code: 400,
        message: '缺少会话ID或对方用户ID'
      };
    }

    try {
      // 查询聊天消息（按时间正序，最新的在后面）
      const result = await db.collection('chat_messages')
        .where({
          chatId: targetChatId
        })
        .orderBy('createdAt', 'asc')
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .get();

      // 获取总数
      const countResult = await db.collection('chat_messages')
        .where({
          chatId: targetChatId
        })
        .count();

      return {
        code: 200,
        message: '获取成功',
        data: {
          list: result.data || [],
          total: countResult.total || 0,
          page: page,
          pageSize: pageSize,
          chatId: targetChatId
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
            pageSize: pageSize,
            chatId: targetChatId
          }
        };
      }
      throw collectionError;
    }
  } catch (error) {
    console.error('【获取聊天消息】失败:', error);
    return {
      code: 500,
      message: '获取失败: ' + error.message
    };
  }
}

/**
 * 获取聊天列表（会话列表）
 */
async function getChatList(openid, data) {
  try {
    try {
      // 查询当前用户参与的所有会话
      const result = await db.collection('chat_list')
        .where(_.or([
          { user1Id: openid },
          { user2Id: openid }
        ]))
        .orderBy('updatedAt', 'desc')
        .get();

      // 格式化会话列表
      const chatList = (result.data || []).map(chat => {
        const otherUserId = chat.user1Id === openid ? chat.user2Id : chat.user1Id;
        const otherUserName = chat.user1Id === openid ? chat.user2Name : chat.user1Name;
        
        return {
          chatId: chat.chatId,
          otherUserId: otherUserId,
          otherUserName: otherUserName,
          lastMessage: chat.lastMessage,
          lastMessageTime: chat.updatedAt,
          unreadCount: chat.user1Id === openid ? (chat.user1UnreadCount || 0) : (chat.user2UnreadCount || 0),
          messageType: chat.messageType,
          relatedTitle: chat.relatedTitle
        };
      });

      return {
        code: 200,
        message: '获取成功',
        data: {
          list: chatList
        }
      };
    } catch (collectionError) {
      // 如果集合不存在，返回空列表
      if (collectionError.errCode === -502005 || collectionError.message && collectionError.message.includes('not exist')) {
        return {
          code: 200,
          message: '获取成功',
          data: {
            list: []
          }
        };
      }
      throw collectionError;
    }
  } catch (error) {
    console.error('【获取聊天列表】失败:', error);
    return {
      code: 500,
      message: '获取失败: ' + error.message
    };
  }
}

/**
 * 标记消息为已读
 */
async function markAsRead(openid, data) {
  const { chatId, toUserId } = data;

  try {
    let targetChatId = chatId;
    if (!targetChatId && toUserId) {
      targetChatId = generateChatId(openid, toUserId);
    }

    if (!targetChatId) {
      return {
        code: 400,
        message: '缺少会话ID或对方用户ID'
      };
    }

    try {
      // 更新未读消息状态
      await db.collection('chat_messages')
        .where({
          chatId: targetChatId,
          toUserId: openid,
          status: 'unread'
        })
        .update({
          data: {
            status: 'read',
            updatedAt: db.serverDate()
          }
        });
    } catch (collectionError) {
      // 如果集合不存在，忽略错误
      if (collectionError.errCode === -502005 || collectionError.message && collectionError.message.includes('not exist')) {
        // 集合不存在，无需标记
      } else {
        throw collectionError;
      }
    }

    try {
      // 更新会话列表中的未读数
      const chat = await db.collection('chat_list')
        .where({
          chatId: targetChatId
        })
        .get();

      if (chat.data && chat.data.length > 0) {
        const chatData = chat.data[0];
        const updateData = {};
        
        if (chatData.user1Id === openid) {
          updateData.user1UnreadCount = 0;
        } else if (chatData.user2Id === openid) {
          updateData.user2UnreadCount = 0;
        }
        
        if (Object.keys(updateData).length > 0) {
          await db.collection('chat_list').doc(chatData._id).update({
            data: {
              ...updateData,
              updatedAt: db.serverDate()
            }
          });
        }
      }
    } catch (collectionError) {
      // 如果集合不存在，忽略错误
      if (collectionError.errCode === -502005 || collectionError.message && collectionError.message.includes('not exist')) {
        // 集合不存在，无需更新
      } else {
        throw collectionError;
      }
    }

    return {
      code: 200,
      message: '标记成功'
    };
  } catch (error) {
    console.error('【标记已读】失败:', error);
    return {
      code: 500,
      message: '标记失败: ' + error.message
    };
  }
}

/**
 * 生成会话ID（确保两个用户之间的会话ID唯一且一致）
 */
function generateChatId(userId1, userId2) {
  // 按字母顺序排序，确保同一对用户的chatId一致
  const ids = [userId1, userId2].sort();
  return `chat_${ids[0]}_${ids[1]}`;
}

/**
 * 更新会话列表
 */
async function updateChatList(fromUserId, toUserId, toUserName, fromUserName, lastMessage, messageType, relatedId, relatedTitle) {
  const chatId = generateChatId(fromUserId, toUserId);

  try {
    // 查询是否已存在会话
    const existingChat = await db.collection('chat_list')
      .where({
        chatId: chatId
      })
      .get();

    if (existingChat.data && existingChat.data.length > 0) {
      // 更新现有会话
      const chatData = existingChat.data[0];
      const updateData = {
        lastMessage: lastMessage,
        updatedAt: db.serverDate()
      };

      // 更新未读数（接收者未读数+1）
      if (chatData.user1Id === toUserId) {
        updateData.user1UnreadCount = (chatData.user1UnreadCount || 0) + 1;
      } else if (chatData.user2Id === toUserId) {
        updateData.user2UnreadCount = (chatData.user2UnreadCount || 0) + 1;
      }

      await db.collection('chat_list').doc(chatData._id).update({
        data: updateData
      });
    } else {
      // 创建新会话
      await db.collection('chat_list').add({
        data: {
          chatId: chatId,
          user1Id: fromUserId,
          user1Name: fromUserName,
          user2Id: toUserId,
          user2Name: toUserName,
          lastMessage: lastMessage,
          messageType: messageType || 'order',
          relatedId: relatedId || '',
          relatedTitle: relatedTitle || '',
          user1UnreadCount: 0,
          user2UnreadCount: 1, // 接收者未读数+1
          createdAt: db.serverDate(),
          updatedAt: db.serverDate()
        }
      });
    }
  } catch (error) {
    console.error('【更新会话列表】失败:', error);
    // 不抛出错误，避免影响消息发送
  }
}

