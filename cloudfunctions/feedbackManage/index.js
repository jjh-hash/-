// 反馈管理云函数
const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();

exports.main = async (event, context) => {
  const { action, data } = event;
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;

  console.log('【反馈管理】action:', action, 'openid:', openid);

  try {
    switch (action) {
      case 'submitFeedback':
        return await submitFeedback(data, openid);
      case 'getFeedbackList':
        return await getFeedbackList(data, openid);
      default:
        return {
          code: 400,
          message: '未知的操作类型',
          data: null
        };
    }
  } catch (error) {
    console.error('【反馈管理】错误:', error);
    return {
      code: 500,
      message: '操作失败: ' + error.message,
      data: null
    };
  }
};

// 提交反馈
async function submitFeedback(data, openid) {
  const { type, content, images, contact } = data;

  // 验证必填字段
  if (!type || !content || !content.trim()) {
    return {
      code: 400,
      message: '反馈类型和内容不能为空',
      data: null
    };
  }

  // 验证内容长度
  if (content.trim().length < 5) {
    return {
      code: 400,
      message: '反馈内容至少5个字符',
      data: null
    };
  }

  try {
    // 获取用户信息
    const userResult = await db.collection('users')
      .where({ openid: openid })
      .get();

    const user = userResult.data[0] || {};

    // 创建反馈记录
    const feedbackData = {
      userId: openid,
      userName: user.nickname || '用户',
      userAvatar: user.avatar || '',
      type: type, // bug, suggestion, complaint, praise, other
      content: content.trim(),
      images: images || [],
      contact: contact || '',
      status: 'pending', // pending, processing, resolved, closed
      source: 'rider', // rider, user, merchant
      createdAt: db.serverDate(),
      updatedAt: db.serverDate()
    };

    const result = await db.collection('feedbacks').add({
      data: feedbackData
    });

    console.log('【提交反馈】成功，反馈ID:', result._id);

    return {
      code: 200,
      message: '反馈提交成功，我们会尽快处理',
      data: {
        feedbackId: result._id
      }
    };
  } catch (error) {
    console.error('提交反馈失败:', error);
    return {
      code: 500,
      message: '提交反馈失败: ' + error.message,
      data: null
    };
  }
}

// 获取反馈列表（可选功能，用于查看自己的反馈历史）
async function getFeedbackList(data, openid) {
  const { page = 1, pageSize = 20 } = data;

  try {
    // 查询当前用户的反馈列表
    const result = await db.collection('feedbacks')
      .where({
        userId: openid
      })
      .orderBy('createdAt', 'desc')
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .get();

    // 获取总数
    const countResult = await db.collection('feedbacks')
      .where({
        userId: openid
      })
      .count();

    return {
      code: 200,
      message: '获取成功',
      data: {
        list: result.data,
        total: countResult.total,
        page: page,
        pageSize: pageSize
      }
    };
  } catch (error) {
    console.error('获取反馈列表失败:', error);
    return {
      code: 500,
      message: '获取反馈列表失败: ' + error.message,
      data: null
    };
  }
}

