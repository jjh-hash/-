// 公告管理云函数
const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();

exports.main = async (event, context) => {
  console.log('公告管理请求:', event);
  
  const { action, data } = event;
  
  try {
    switch (action) {
      case 'create':
        return await createAnnouncement(data);
      case 'getList':
        return await getAnnouncementList(data);
      case 'getActive':
        return await getActiveAnnouncement(data);
      case 'update':
        return await updateAnnouncement(data);
      case 'delete':
        return await deleteAnnouncement(data);
      default:
        return {
          code: 400,
          message: '未知操作',
          data: null
        };
    }
  } catch (error) {
    console.error('公告管理错误:', error);
    return {
      code: 500,
      message: '系统异常: ' + error.message,
      data: null
    };
  }
};

/**
 * 创建公告
 */
async function createAnnouncement(data) {
  const { title, content, status = 'active', priority = 0, targetType = 'all' } = data;
  
  if (!title || !content) {
    return {
      code: 400,
      message: '标题和内容为必填项',
      data: null
    };
  }
  
  try {
    // 创建公告
    const result = await db.collection('announcements').add({
      data: {
        title: title,
        content: content,
        status: status,
        priority: priority,
        targetType: targetType, // 发布范围：client/merchant/all
        createdAt: db.serverDate(),
        updatedAt: db.serverDate()
      }
    });
    
    console.log('公告创建成功:', result._id, 'targetType:', targetType);
    
    return {
      code: 200,
      message: '创建成功',
      data: {
        _id: result._id
      }
    };
  } catch (error) {
    console.error('创建公告失败:', error);
    return {
      code: 500,
      message: '创建失败: ' + error.message,
      data: null
    };
  }
}

/**
 * 获取公告列表
 */
async function getAnnouncementList(data) {
  const { status } = data;
  
  let whereCondition = {};
  
  if (status) {
    whereCondition.status = status;
  }
  
  // 不使用orderBy，直接获取所有数据
  const result = await db.collection('announcements')
    .where(whereCondition)
    .get();
  
  console.log('查询到的数据:', result.data);
  
  // 手动排序：按优先级降序，相同优先级按创建时间降序
  const sortedList = result.data.sort((a, b) => {
    if (a.priority !== b.priority) {
      return (b.priority || 0) - (a.priority || 0);
    }
    return new Date(b.createdAt) - new Date(a.createdAt);
  });
  
  return {
    code: 200,
    message: '获取成功',
    data: {
      list: sortedList
    }
  };
}

/**
 * 获取启用的公告（客户端调用）
 */
async function getActiveAnnouncement(data) {
  const { targetType = 'client' } = data; // 默认获取客户端公告
  
  // 构建查询条件：status为active，且targetType为all或指定类型
  const whereCondition = {
    status: 'active',
    $or: [
      { targetType: 'all' },
      { targetType: targetType }
    ]
  };
  
  const result = await db.collection('announcements')
    .where(whereCondition)
    .get();
  
  console.log('获取启用的公告:', result.data, 'targetType:', targetType);
  
  // 手动排序：按优先级降序，相同优先级按创建时间降序
  const sortedList = result.data.sort((a, b) => {
    if (a.priority !== b.priority) {
      return (b.priority || 0) - (a.priority || 0);
    }
    return new Date(b.createdAt) - new Date(a.createdAt);
  });
  
  return {
    code: 200,
    message: '获取成功',
    data: {
      announcement: sortedList.length > 0 ? sortedList[0] : null
    }
  };
}

/**
 * 更新公告
 */
async function updateAnnouncement(data) {
  const { announcementId, title, content, status, priority, targetType } = data;
  
  if (!announcementId) {
    return {
      code: 400,
      message: '缺少公告ID',
      data: null
    };
  }
  
  // 检查公告是否存在
  const announcement = await db.collection('announcements').doc(announcementId).get();
  
  if (!announcement.data) {
    return {
      code: 404,
      message: '公告不存在',
      data: null
    };
  }
  
  // 构建更新数据
  const updateData = {
    updatedAt: db.serverDate()
  };
  
  if (title !== undefined) updateData.title = title;
  if (content !== undefined) updateData.content = content;
  if (status !== undefined) updateData.status = status;
  if (priority !== undefined) updateData.priority = priority;
  if (targetType !== undefined) updateData.targetType = targetType;
  
  // 更新公告
  await db.collection('announcements').doc(announcementId).update({
    data: updateData
  });
  
  console.log('公告更新成功:', announcementId);
  
  return {
    code: 200,
    message: '更新成功',
    data: null
  };
}

/**
 * 删除公告
 */
async function deleteAnnouncement(data) {
  const { announcementId } = data;
  
  if (!announcementId) {
    return {
      code: 400,
      message: '缺少公告ID',
      data: null
    };
  }
  
  // 检查公告是否存在
  const announcement = await db.collection('announcements').doc(announcementId).get();
  
  if (!announcement.data) {
    return {
      code: 404,
      message: '公告不存在',
      data: null
    };
  }
  
  // 删除公告
  await db.collection('announcements').doc(announcementId).remove();
  
  console.log('公告删除成功:', announcementId);
  
  return {
    code: 200,
    message: '删除成功',
    data: null
  };
}

