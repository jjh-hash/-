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
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();

exports.main = async (event, context) => {
  const { action, data } = event;
  const { OPENID } = cloud.getWXContext();

  try {
    switch (action) {
      // 创建退款申请
      case 'createRefund':
        return await createRefund(data, OPENID);
      
      // 获取退款列表
      case 'getRefundList':
        return await getRefundList(data, OPENID);
      
      // 获取退款详情
      case 'getRefundDetail':
        return await getRefundDetail(data, OPENID);
      
      // 更新退款状态（商家/管理员操作）
      case 'updateRefundStatus':
        return await updateRefundStatus(data, OPENID);
      
      default:
        return {
          code: 400,
          message: '未知操作',
          data: null
        };
    }
  } catch (error) {
    console.error('退款管理云函数错误:', error);
    return {
      code: 500,
      message: '服务器错误: ' + error.message,
      data: null
    };
  }
};

/**
 * 创建退款申请
 */
async function createRefund(data, openid) {
  try {
    const { orderId, refundReason, refundReasonText, images, refundSource, selectedItems, refundAmount } = data;

    console.log('【创建退款申请】参数:', data);

    // 验证必填参数
    if (!orderId) {
      return {
        code: 400,
        message: '订单ID不能为空',
        data: null
      };
    }

    if (!refundReason) {
      return {
        code: 400,
        message: '退款原因不能为空',
        data: null
      };
    }

    if (!selectedItems || selectedItems.length === 0) {
      return {
        code: 400,
        message: '请至少选择一件商品',
        data: null
      };
    }

    if (!refundAmount || refundAmount <= 0) {
      return {
        code: 400,
        message: '退款金额必须大于0',
        data: null
      };
    }

    // 查询订单信息
    const orderResult = await db.collection('orders').doc(orderId).get();
    if (!orderResult.data) {
      return {
        code: 404,
        message: '订单不存在',
        data: null
      };
    }

    const order = orderResult.data;

    // 验证订单归属
    if (order.userOpenid && order.userOpenid !== openid) {
      return {
        code: 403,
        message: '无权操作此订单',
        data: null
      };
    }

    // 验证订单状态（只有已完成的订单可以申请退款）
    if (order.orderStatus !== 'completed') {
      return {
        code: 400,
        message: '只有已完成的订单可以申请退款',
        data: null
      };
    }

    // 检查已完成的退款申请，计算已退款金额和已退款商品
    const completedRefunds = await db.collection('refunds')
      .where({
        orderId: orderId,
        status: db.command.in(['approved', 'completed'])
      })
      .get();

    let totalRefundedAmount = 0;
    let refundedItemsMap = {}; // 记录已退款的商品 {productId_spec: {quantity: 已退款数量}}

    if (completedRefunds.data && completedRefunds.data.length > 0) {
      completedRefunds.data.forEach(refund => {
        if (refund.refundAmount) {
          totalRefundedAmount += parseFloat(refund.refundAmount);
        }
        
        // 记录已退款的商品
        if (refund.selectedItems && Array.isArray(refund.selectedItems)) {
          refund.selectedItems.forEach(item => {
            const key = `${item.productId || item.id}_${item.spec || ''}`;
            if (!refundedItemsMap[key]) {
              refundedItemsMap[key] = {
                productId: item.productId || item.id,
                spec: item.spec || '',
                quantity: 0
              };
            }
            refundedItemsMap[key].quantity += (item.quantity || 1);
          });
        }
      });
    }

    // 检查是否有正在处理中的退款申请
    const pendingRefunds = await db.collection('refunds')
      .where({
        orderId: orderId,
        status: db.command.in(['pending', 'processing'])
      })
      .get();

    if (pendingRefunds.data && pendingRefunds.data.length > 0) {
      // 计算正在处理中的退款金额
      let pendingRefundAmount = 0;
      pendingRefunds.data.forEach(refund => {
        if (refund.refundAmount) {
          pendingRefundAmount += parseFloat(refund.refundAmount);
        }
      });

      // 检查累计退款金额（已退款 + 处理中 + 本次申请）是否超过订单总金额
      const orderTotalAmount = parseFloat(order.amountPayable || order.amountTotal || 0);
      if (totalRefundedAmount + pendingRefundAmount + refundAmount > orderTotalAmount) {
        return {
          code: 400,
          message: `退款金额超过订单总金额，已退款¥${totalRefundedAmount.toFixed(2)}，处理中¥${pendingRefundAmount.toFixed(2)}，订单总额¥${orderTotalAmount.toFixed(2)}`,
          data: null
        };
      }
    } else {
      // 如果没有处理中的退款，检查已退款金额 + 本次申请是否超过订单总金额
      const orderTotalAmount = parseFloat(order.amountPayable || order.amountTotal || 0);
      if (totalRefundedAmount + refundAmount > orderTotalAmount) {
        return {
          code: 400,
          message: `退款金额超过订单总金额，已退款¥${totalRefundedAmount.toFixed(2)}，订单总额¥${orderTotalAmount.toFixed(2)}`,
          data: null
        };
      }
    }

    // 验证选中的商品是否已被退款
    const orderItems = order.items || [];
    const orderItemsMap = {}; // 订单商品映射 {productId_spec: {quantity: 订单数量}}
    
    orderItems.forEach(item => {
      const key = `${item.productId || item.id}_${item.spec || ''}`;
      if (!orderItemsMap[key]) {
        orderItemsMap[key] = {
          productId: item.productId || item.id,
          spec: item.spec || '',
          quantity: 0
        };
      }
      orderItemsMap[key].quantity += (item.quantity || 1);
    });

    // 检查本次申请的商品是否超过可退款数量
    const selectedItemsMap = {};
    selectedItems.forEach(item => {
      const key = `${item.productId || item.id}_${item.spec || ''}`;
      if (!selectedItemsMap[key]) {
        selectedItemsMap[key] = 0;
      }
      selectedItemsMap[key] += (item.quantity || 1);
    });

    // 验证每个商品的可退款数量
    for (const key in selectedItemsMap) {
      const requestedQuantity = selectedItemsMap[key];
      const orderQuantity = orderItemsMap[key] ? orderItemsMap[key].quantity : 0;
      const refundedQuantity = refundedItemsMap[key] ? refundedItemsMap[key].quantity : 0;
      const availableQuantity = orderQuantity - refundedQuantity;

      if (requestedQuantity > availableQuantity) {
        const itemInfo = orderItems.find(item => 
          `${item.productId || item.id}_${item.spec || ''}` === key
        );
        const itemName = itemInfo ? (itemInfo.productName || '商品') : '商品';
        const spec = itemInfo ? (itemInfo.spec || '') : '';
        return {
          code: 400,
          message: `${itemName}${spec ? '(' + spec + ')' : ''}可退款数量不足，订单数量${orderQuantity}，已退款${refundedQuantity}，本次申请${requestedQuantity}`,
          data: null
        };
      }
    }

    // 生成退款单号
    const refundNo = 'RF' + Date.now() + Math.random().toString(36).substr(2, 6).toUpperCase();

    // 创建退款申请
    const refundData = {
      refundNo: refundNo,
      orderId: orderId,
      orderNo: order.orderNo,
      userId: order.userId,
      userOpenid: openid,
      storeId: order.storeId,
      storeName: order.storeName,
      refundReason: refundReason,
      refundReasonText: refundReasonText || '',
      images: images || [],
      refundSource: refundSource || 'payment',
      selectedItems: selectedItems,
      refundAmount: refundAmount,
      originalAmount: parseFloat(order.amountPayable || order.amountTotal || 0),
      status: 'pending', // pending: 待处理, processing: 处理中, approved: 已同意, rejected: 已拒绝, completed: 已完成
      createdAt: db.serverDate(),
      updatedAt: db.serverDate()
    };

    const result = await db.collection('refunds').add({
      data: refundData
    });

    console.log('【创建退款申请】成功，退款单号:', refundNo);

    return {
      code: 200,
      message: '退款申请已提交',
      data: {
        refundId: result._id,
        refundNo: refundNo
      }
    };

  } catch (error) {
    console.error('【创建退款申请】异常:', error);
    return {
      code: 500,
      message: '创建退款申请失败: ' + error.message,
      data: null
    };
  }
}

/**
 * 获取退款列表
 */
async function getRefundList(data, openid) {
  try {
    const { page = 1, pageSize = 20, status } = data;

    // 构建查询条件
    const whereCondition = {
      userOpenid: openid
    };

    if (status) {
      whereCondition.status = status;
    }

    // 查询退款列表
    const result = await db.collection('refunds')
      .where(whereCondition)
      .orderBy('createdAt', 'desc')
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .get();

    // 获取总数
    const countResult = await db.collection('refunds')
      .where(whereCondition)
      .count();

    // 格式化数据
    const list = result.data.map(refund => {
      return {
        ...refund,
        createdAt: formatDate(refund.createdAt),
        updatedAt: formatDate(refund.updatedAt)
      };
    });

    return {
      code: 200,
      message: 'ok',
      data: {
        list: list,
        total: countResult.total,
        page: page,
        pageSize: pageSize
      }
    };

  } catch (error) {
    console.error('【获取退款列表】异常:', error);
    return {
      code: 500,
      message: '获取退款列表失败: ' + error.message,
      data: null
    };
  }
}

/**
 * 获取退款详情
 */
async function getRefundDetail(data, openid) {
  try {
    const { refundId, isAdmin } = data;

    if (!refundId) {
      return {
        code: 400,
        message: '退款ID不能为空',
        data: null
      };
    }

    const result = await db.collection('refunds').doc(refundId).get();

    if (!result.data) {
      return {
        code: 404,
        message: '退款申请不存在',
        data: null
      };
    }

    const refund = result.data;

    // 验证权限：管理员可以查看所有退款，普通用户只能查看自己的退款
    if (!isAdmin && refund.userOpenid !== openid) {
      return {
        code: 403,
        message: '无权查看此退款申请',
        data: null
      };
    }

    // 格式化日期
    const formattedRefund = {
      ...refund,
      createdAt: formatDate(refund.createdAt),
      updatedAt: formatDate(refund.updatedAt),
      approvedAt: refund.approvedAt ? formatDate(refund.approvedAt) : null,
      rejectedAt: refund.rejectedAt ? formatDate(refund.rejectedAt) : null,
      completedAt: refund.completedAt ? formatDate(refund.completedAt) : null
    };

    return {
      code: 200,
      message: 'ok',
      data: {
        refund: formattedRefund
      }
    };

  } catch (error) {
    console.error('【获取退款详情】异常:', error);
    return {
      code: 500,
      message: '获取退款详情失败: ' + error.message,
      data: null
    };
  }
}

/**
 * 更新退款状态（商家/管理员操作）
 */
async function updateRefundStatus(data, openid) {
  try {
    const { refundId, status, remark } = data;

    if (!refundId || !status) {
      return {
        code: 400,
        message: '参数不完整',
        data: null
      };
    }

    const validStatuses = ['processing', 'approved', 'rejected', 'completed'];
    if (!validStatuses.includes(status)) {
      return {
        code: 400,
        message: '无效的退款状态',
        data: null
      };
    }

    // 查询退款信息
    const refundResult = await db.collection('refunds').doc(refundId).get();
    if (!refundResult.data) {
      return {
        code: 404,
        message: '退款申请不存在',
        data: null
      };
    }

    const refund = refundResult.data;

    // 验证权限（商家或管理员）
    // 查询订单信息，验证商家权限
    const orderResult = await db.collection('orders').doc(refund.orderId).get();
    if (!orderResult.data) {
      return {
        code: 404,
        message: '订单不存在',
        data: null
      };
    }

    const order = orderResult.data;
    
    console.log('【更新退款状态】订单信息:', {
      orderId: order._id,
      orderStoreId: order.storeId,
      orderNo: order.orderNo
    });
    console.log('【更新退款状态】当前用户openid:', openid);
    
    // 方法1：通过订单的storeId查询店铺，然后验证商家权限
    let hasPermission = false;
    
    if (order.storeId) {
      try {
        // 查询店铺信息
        const storeResult = await db.collection('stores')
          .doc(order.storeId)
          .get();
        
        if (storeResult.data) {
          const store = storeResult.data;
          console.log('【更新退款状态】店铺信息:', {
            storeId: store._id,
            merchantId: store.merchantId,
            storeName: store.name
          });
          
          // 查询商家信息，验证openid
          if (store.merchantId) {
            const merchantResult = await db.collection('merchants')
              .doc(store.merchantId)
              .get();
            
            if (merchantResult.data) {
              const merchant = merchantResult.data;
              console.log('【更新退款状态】商家信息:', {
                merchantId: merchant._id,
                merchantOpenid: merchant.openid,
                currentOpenid: openid,
                match: merchant.openid === openid
              });
              
              // 验证openid是否匹配
              if (merchant.openid === openid) {
                hasPermission = true;
                console.log('【更新退款状态】权限验证通过：通过店铺-商家关系验证');
              }
            }
          }
        }
      } catch (err) {
        console.warn('【更新退款状态】通过店铺查询商家失败:', err);
      }
    }
    
    // 方法2：如果方法1失败，直接通过openid查询商家，然后验证storeId
    if (!hasPermission) {
      try {
        const merchantResult = await db.collection('merchants')
          .where({ openid: openid })
          .get();
        
        if (merchantResult.data && merchantResult.data.length > 0) {
          const merchant = merchantResult.data[0];
          console.log('【更新退款状态】通过openid查询到商家:', {
            merchantId: merchant._id,
            merchantStoreId: merchant.storeId
          });
          
          // 获取商家的店铺ID
          let merchantStoreId = merchant.storeId;
          
          // 如果商家信息中没有storeId，尝试查询stores集合
          if (!merchantStoreId) {
            try {
              const storeResult = await db.collection('stores')
                .where({ merchantId: merchant._id })
                .limit(1)
                .get();
              
              if (storeResult.data && storeResult.data.length > 0) {
                merchantStoreId = storeResult.data[0]._id;
                console.log('【更新退款状态】从stores集合获取店铺ID:', merchantStoreId);
              } else {
                // 如果还是没有，使用商家ID作为店铺ID（兼容旧数据）
                merchantStoreId = merchant._id;
                console.log('【更新退款状态】使用商家ID作为店铺ID:', merchantStoreId);
              }
            } catch (err) {
              console.warn('【更新退款状态】查询店铺信息失败:', err);
              merchantStoreId = merchant._id;
            }
          }
          
          console.log('【更新退款状态】权限验证:', {
            orderStoreId: order.storeId,
            merchantStoreId: merchantStoreId,
            match: order.storeId === merchantStoreId
          });
          
          if (order.storeId === merchantStoreId) {
            hasPermission = true;
            console.log('【更新退款状态】权限验证通过：通过openid-商家-storeId验证');
          }
        }
      } catch (err) {
        console.warn('【更新退款状态】通过openid查询商家失败:', err);
      }
    }
    
    // 方法3：检查是否是管理员
    if (!hasPermission) {
      try {
        const adminResult = await db.collection('admins')
          .where({ openid: openid })
          .get();
        
        if (adminResult.data && adminResult.data.length > 0) {
          hasPermission = true;
          console.log('【更新退款状态】权限验证通过：管理员权限');
        }
      } catch (err) {
        console.warn('【更新退款状态】查询管理员信息失败:', err);
      }
    }
    
    // 如果所有验证都失败，返回无权限
    if (!hasPermission) {
      console.error('【更新退款状态】权限验证失败：所有验证方法都失败');
      return {
        code: 403,
        message: '无权操作此退款申请',
        data: null
      };
    }

    // 更新退款状态
    const updateData = {
      status: status,
      updatedAt: db.serverDate()
    };

    if (remark) {
      updateData.remark = remark;
    }

    if (status === 'approved') {
      updateData.approvedAt = db.serverDate();
      
      // 商家同意退款时，需要减少商家收入和平台管理费
      // 检查是否已经处理过（避免重复扣除）
      if (!refund.processed) {
        await processRefundDeduction(refund, order);
        // 标记已处理
        updateData.processed = true;
        updateData.processedAt = db.serverDate();
      }
    } else if (status === 'rejected') {
      updateData.rejectedAt = db.serverDate();
    } else if (status === 'completed') {
      updateData.completedAt = db.serverDate();
      
      // 退款完成时，如果之前没有处理过，也需要减少商家收入和平台管理费
      // 检查是否已经处理过（避免重复扣除）
      if (!refund.processed) {
        await processRefundDeduction(refund, order);
        // 标记已处理
        updateData.processed = true;
        updateData.processedAt = db.serverDate();
      }
    }

    await db.collection('refunds').doc(refundId).update({
      data: updateData
    });

    // 如果退款已同意，更新订单状态
    if (status === 'approved') {
      await db.collection('orders').doc(refund.orderId).update({
        data: {
          refundStatus: 'refunding',
          updatedAt: db.serverDate()
        }
      });
    }
    
    // 如果退款已完成，更新订单状态为已退款
    if (status === 'completed') {
      await db.collection('orders').doc(refund.orderId).update({
        data: {
          refundStatus: 'refunded',
          updatedAt: db.serverDate()
        }
      });
    }

    // 如果退款被拒绝，发送消息给用户
    if (status === 'rejected' && remark) {
      try {
        // 获取订单信息，获取用户openid
        const orderResult = await db.collection('orders').doc(refund.orderId).get();
        if (orderResult.data && orderResult.data.userOpenid) {
          const userOpenid = orderResult.data.userOpenid;
          
          // 获取商家信息
          const merchantResult = await db.collection('merchants')
            .where({ openid: openid })
            .get();
          
          let merchantName = '商家';
          if (merchantResult.data && merchantResult.data.length > 0) {
            merchantName = merchantResult.data[0].merchantName || merchantResult.data[0].storeName || '商家';
          }

          // 发送聊天消息给用户（直接在数据库中创建聊天消息）
          const chatId = generateChatId(openid, userOpenid);
          const messageContent = `您的退款申请（退款单号：${refund.refundNo}）已被拒绝。拒绝理由：${remark}`;
          
          // 获取用户信息
          const userResult = await db.collection('users')
            .where({ openid: userOpenid })
            .get();
          
          let userName = '用户';
          let userAvatar = '';
          if (userResult.data && userResult.data.length > 0) {
            userName = userResult.data[0].nickname || '用户';
            userAvatar = userResult.data[0].avatar || '';
          }
          
          // 创建聊天消息
          await db.collection('chat_messages').add({
            data: {
              chatId: chatId,
              fromUserId: openid,
              fromUserName: merchantName,
              fromUserAvatar: '',
              toUserId: userOpenid,
              toUserName: userName,
              toUserAvatar: userAvatar,
              content: messageContent,
              messageType: 'order',
              relatedId: refund.orderId,
              relatedTitle: `订单 ${orderResult.data.orderNo || refund.orderId}`,
              status: 'unread',
              createdAt: db.serverDate(),
              updatedAt: db.serverDate()
            }
          });
          
          // 更新或创建会话记录
          const chatResult = await db.collection('chats')
            .where({ chatId: chatId })
            .get();
          
          if (chatResult.data && chatResult.data.length > 0) {
            // 更新现有会话
            await db.collection('chats').doc(chatResult.data[0]._id).update({
              data: {
                lastMessage: messageContent,
                lastMessageTime: db.serverDate(),
                updatedAt: db.serverDate()
              }
            });
          } else {
            // 创建新会话
            await db.collection('chats').add({
              data: {
                chatId: chatId,
                userId1: openid,
                userName1: merchantName,
                userAvatar1: '',
                userId2: userOpenid,
                userName2: userName,
                userAvatar2: userAvatar,
                lastMessage: messageContent,
                lastMessageTime: db.serverDate(),
                createdAt: db.serverDate(),
                updatedAt: db.serverDate()
              }
            });
          }

          console.log('【更新退款状态】已发送拒绝消息给用户');
        }
      } catch (err) {
        console.error('【更新退款状态】发送消息失败:', err);
        // 发送消息失败不影响退款状态更新
      }
    }

    console.log('【更新退款状态】成功，退款ID:', refundId, '状态:', status);

    return {
      code: 200,
      message: '操作成功',
      data: null
    };

  } catch (error) {
    console.error('【更新退款状态】异常:', error);
    return {
      code: 500,
      message: '更新退款状态失败: ' + error.message,
      data: null
    };
  }
}

/**
 * 处理退款扣除（减少商家收入和平台管理费）
 */
async function processRefundDeduction(refund, order) {
  try {
    console.log('【处理退款扣除】开始处理退款扣除，退款ID:', refund._id);
    
    // 获取退款金额（元）
    const refundAmountYuan = parseFloat(refund.refundAmount) || 0;
    
    // 如果退款金额为0，不需要处理
    if (refundAmountYuan <= 0) {
      console.log('【处理退款扣除】退款金额为0，跳过处理');
      return;
    }
    
    // 获取订单的平台服务费比例
    const platformFeeRate = order.platformFeeRate || 0.08; // 默认8%
    
    // 计算退款金额对应的商品金额（分）
    // 退款金额可能小于订单总金额（部分退款），需要按比例计算
    const orderAmountGoodsFen = order.amountGoods || 0; // 订单商品金额（分）
    const orderAmountGoodsYuan = orderAmountGoodsFen / 100; // 订单商品金额（元）
    
    // 计算退款金额占订单商品金额的比例
    const refundRatio = orderAmountGoodsYuan > 0 ? (refundAmountYuan / orderAmountGoodsYuan) : 0;
    
    // 计算需要扣除的商品金额（分）
    const refundGoodsAmountFen = Math.round(refundAmountYuan * 100);
    
    // 计算需要扣除的平台服务费（分）= 退款商品金额 × 平台服务费比例
    const refundPlatformFeeFen = Math.round(refundGoodsAmountFen * platformFeeRate);
    
    // 计算需要扣除的商家收入（分）= 退款商品金额 - 平台服务费
    const refundMerchantIncomeFen = refundGoodsAmountFen - refundPlatformFeeFen;
    
    console.log('【处理退款扣除】计算明细:', {
      refundAmountYuan: refundAmountYuan,
      refundRatio: refundRatio,
      refundGoodsAmountFen: refundGoodsAmountFen,
      refundPlatformFeeFen: refundPlatformFeeFen,
      refundMerchantIncomeFen: refundMerchantIncomeFen,
      platformFeeRate: platformFeeRate
    });
    
    // 1. 减少商家账户余额（通过创建退款记录，在统计时扣除）
    // 这里我们创建一个退款扣除记录，用于统计时扣除
    // 实际上，我们会在统计函数中查询已完成的退款来扣除
    
    // 2. 记录退款扣除信息到退款记录中（用于统计）
    await db.collection('refunds').doc(refund._id).update({
      data: {
        refundGoodsAmount: refundGoodsAmountFen, // 退款商品金额（分）
        refundPlatformFee: refundPlatformFeeFen, // 退款平台服务费（分）
        refundMerchantIncome: refundMerchantIncomeFen, // 退款商家收入（分）
        platformFeeRate: platformFeeRate // 记录平台服务费比例
      }
    });
    
    console.log('【处理退款扣除】退款扣除处理完成');
    
  } catch (error) {
    console.error('【处理退款扣除】异常:', error);
    // 不抛出错误，避免影响退款状态更新
  }
}

/**
 * 生成会话ID（确保两个用户之间的会话ID唯一且一致）
 */
function generateChatId(userId1, userId2) {
  // 将两个用户ID排序后拼接，确保同一对用户的会话ID唯一
  const ids = [userId1, userId2].sort();
  return `chat_${ids[0]}_${ids[1]}`;
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
  const hours = padStart(chinaTime.getUTCHours(), 2, '0');
  const minutes = padStart(chinaTime.getUTCMinutes(), 2, '0');
  
  return `${year}-${month}-${day} ${hours}:${minutes}`;
}

