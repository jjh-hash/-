// 订单管理云函数
const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();

exports.main = async (event, context) => {
  try {
    const { OPENID } = cloud.getWXContext();
    const { action, data } = event;
    
    console.log('【订单管理】请求:', { action, data, openid: OPENID });
    
    // 参数验证
    if (!action) {
      return {
        code: 400,
        message: '缺少action参数'
      };
    }
    
    let result;
    
    // 根据action执行不同操作
    switch (action) {
      case 'createOrder':
        result = await createOrder(OPENID, data);
        break;
      case 'getOrderList':
        result = await getOrderList(OPENID, data);
        break;
      case 'getMerchantOrders':
        result = await getMerchantOrders(OPENID, data);
        break;
      case 'getUserOrdersForReview':
        result = await getUserOrdersForReview(OPENID, data);
        break;
      case 'updateOrderStatus':
        result = await updateOrderStatus(OPENID, data);
        break;
      case 'updateOrderPayStatus':
        result = await updateOrderPayStatus(OPENID, data);
        break;
      case 'cancelOrder':
        result = await cancelOrder(OPENID, data);
        break;
      case 'getAdminOrderList':
        result = await getAdminOrderList(OPENID, data);
        break;
      case 'completeOrder':
        result = await completeOrder(OPENID, data);
        break;
      case 'createExpressOrder':
        result = await createExpressOrder(OPENID, data);
        break;
      case 'createGamingOrder':
        result = await createGamingOrder(OPENID, data);
        break;
      case 'createRewardOrder':
        result = await createRewardOrder(OPENID, data);
        break;
      case 'getReceiveOrders':
        result = await getReceiveOrders(OPENID, data);
        break;
      case 'getAvailableOrders':
        result = await getAvailableOrders(OPENID, data);
        break;
      case 'grabOrder':
        result = await grabOrder(OPENID, data);
        break;
      case 'getPickupOrders':
        result = await getPickupOrders(OPENID, data);
        break;
      case 'confirmMerchantReady':
        result = await confirmMerchantReady(OPENID, data);
        break;
      case 'confirmPickup':
        result = await confirmPickup(OPENID, data);
        break;
      case 'getDeliverOrders':
        result = await getDeliverOrders(OPENID, data);
        break;
      case 'confirmDelivery':
        result = await confirmDelivery(OPENID, data);
        break;
      case 'getRiderTodayStats':
        result = await getRiderTodayStats(OPENID, data);
        break;
      case 'getRiderTodayOrders':
        result = await getRiderTodayOrders(OPENID, data);
        break;
      case 'getRiderTodayIncome':
        result = await getRiderTodayIncome(OPENID, data);
        break;
      case 'getRiderTotalStats':
        result = await getRiderTotalStats(OPENID, data);
        break;
      case 'getRiderWeekStats':
        result = await getRiderWeekStats(OPENID, data);
        break;
      case 'getRiderMonthStats':
        result = await getRiderMonthStats(OPENID, data);
        break;
      default:
        console.warn('【订单管理】无效的操作类型:', action);
        result = {
          code: 400,
          message: '无效的操作类型',
          action: action
        };
    }
    
    console.log('【订单管理】返回结果:', result);
    return result;
    
  } catch (error) {
    console.error('【订单管理】异常:', error);
    return {
      code: 500,
      message: '系统异常',
      error: error.message,
      stack: error.stack
    };
  }
};

/**
 * 创建订单
 */
async function createOrder(openid, data) {
  try {
    const { storeId, cartItems, cartTotal, storeInfo, address, remark, deliveryFee, deliveryType, needCutlery, cutleryQuantity, payStatus, paymentProof } = data;
    
    console.log('【创建订单】接收到的参数:', data);
    console.log('【创建订单】参数详情:', {
      storeId: storeId,
      cartItemsLength: cartItems ? cartItems.length : 0,
      cartTotal: cartTotal,
      hasStoreInfo: !!storeInfo,
      hasAddress: !!address
    });
    
    // 参数验证
    if (!storeId) {
      console.error('【创建订单】缺少storeId');
      return {
        code: 400,
        message: '缺少店铺ID',
        details: 'storeId参数为空'
      };
    }
    
    if (!cartItems || cartItems.length === 0) {
      console.error('【创建订单】购物车为空');
      return {
        code: 400,
        message: '购物车为空',
        details: 'cartItems参数为空或长度为0'
      };
    }
    
    if (cartTotal === undefined || cartTotal === null) {
      console.error('【创建订单】商品金额缺失');
      return {
        code: 400,
        message: '商品金额缺失',
        details: 'cartTotal参数为空'
      };
    }
    
    // 1. 查询用户信息
    const user = await db.collection('users')
      .where({ openid })
      .get();
    
    if (!user.data || user.data.length === 0) {
      return {
        code: 404,
        message: '用户不存在'
      };
    }
    
    const userInfo = user.data[0];
    
    // 2. 查询店铺信息
    const store = await db.collection('stores').doc(storeId).get();
    
    if (!store.data) {
      return {
        code: 404,
        message: '店铺不存在'
      };
    }
    
    // 检查店铺状态：只有营业中的店铺才能下单
    if (store.data.businessStatus !== 'open') {
      return {
        code: 403,
        message: '店铺当前休息中，暂不接收订单'
      };
    }
    
    // 检查自动接单设置：如果开启自动接单，订单状态直接设为confirmed
    // 如果未开启自动接单，订单状态为pending，需要商家确认后才能变为confirmed，骑手端才能看到
    const autoAccept = store.data.autoAccept === true;
    const initialOrderStatus = autoAccept ? 'confirmed' : 'pending';
    
    console.log('【创建订单】自动接单设置:', autoAccept, '初始订单状态:', initialOrderStatus);
    
    // 3. 获取平台配置（配送费、服务费比例、订单超时时间）
    let platformConfig = null;
    try {
      const configRes = await db.collection('platform_config').limit(1).get();
      if (configRes.data.length > 0) {
        platformConfig = configRes.data[0];
      }
    } catch (err) {
      console.warn('【创建订单】获取平台配置失败，使用默认值:', err);
    }
    
    // 默认配置值
    const defaultConfig = {
      platformFeeRate: 0.08, // 8%
      deliveryFee: 300, // 3元（分）
      orderTimeoutMinutes: 20 // 20分钟（默认值，如果数据库配置不合理则使用此值）
    };
    
    const config = platformConfig || defaultConfig;
    const platformFeeRate = config.platformFeeRate || defaultConfig.platformFeeRate;
    const platformDeliveryFee = config.deliveryFee || defaultConfig.deliveryFee; // 配送费（分）
    // 修复：使用更严格的判断，避免当值为 0 或无效值时使用默认值
    let orderTimeoutMinutes;
    if (platformConfig && platformConfig.orderTimeoutMinutes !== undefined && platformConfig.orderTimeoutMinutes !== null) {
      const configValue = parseInt(platformConfig.orderTimeoutMinutes);
      // 安全检查：如果配置值小于5分钟，认为不合理，使用默认值20分钟
      if (!isNaN(configValue) && configValue >= 5) {
        orderTimeoutMinutes = configValue;
        console.log('【创建订单】使用数据库配置的超时时间:', configValue, '分钟');
      } else {
        console.warn('【创建订单】配置的超时时间不合理:', configValue, '分钟，使用默认值:', defaultConfig.orderTimeoutMinutes, '分钟');
        orderTimeoutMinutes = defaultConfig.orderTimeoutMinutes;
      }
    } else {
      console.log('【创建订单】未找到配置，使用默认超时时间:', defaultConfig.orderTimeoutMinutes, '分钟');
      orderTimeoutMinutes = defaultConfig.orderTimeoutMinutes;
    }
    
    // 添加调试日志（强制输出，确保能看到）
    console.log('==========【创建订单】平台配置读取==========');
    console.log('hasConfig:', !!platformConfig);
    if (platformConfig) {
      console.log('platformConfig原始数据:', platformConfig);
      console.log('platformConfig.orderTimeoutMinutes原始值:', platformConfig.orderTimeoutMinutes);
      console.log('platformConfig.orderTimeoutMinutes类型:', typeof platformConfig.orderTimeoutMinutes);
    }
    console.log('defaultOrderTimeout:', defaultConfig.orderTimeoutMinutes);
    console.log('finalOrderTimeout:', orderTimeoutMinutes);
    console.log('==========================================');
    
    // 4. 生成订单号
    const orderNo = `ORD${Date.now()}${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
    
    // 5. 计算订单金额
    // 金额计算逻辑：
    // - 商品金额：顾客购买商品的金额
    // - 平台服务费：从商品金额中扣除，给平台管理端
    // - 配送费：给骑手
    // - 总金额（顾客支付）= 商品金额 + 配送费
    // - 商家收入 = 商品金额 - 平台服务费
    const amountGoodsFen = Math.round(cartTotal * 100); // 商品金额（分）
    const platformFee = Math.round(amountGoodsFen * platformFeeRate); // 平台服务费（分），从商品金额中扣除
    const deliveryFeeFen = platformDeliveryFee; // 配送费（分，从平台配置获取），给骑手
    const totalAmount = cartTotal + (deliveryFeeFen / 100); // 总金额（元）= 商品金额 + 配送费（平台服务费不加入总金额）
    const merchantIncome = cartTotal - (platformFee / 100); // 商家收入（元）= 商品金额 - 平台服务费
    
    // 计算订单超时时间（使用服务器时间）
    // 在云函数中，Date.now() 返回的就是服务器时间戳
    // 计算超时时间：当前时间 + 超时分钟数
    const nowTimestamp = Date.now(); // 云函数中的 Date.now() 就是服务器时间戳
    const expiredTimestamp = nowTimestamp + orderTimeoutMinutes * 60 * 1000;
    const expiredAt = new Date(expiredTimestamp);
    
    // 添加调试日志
    console.log('【创建订单】超时时间计算:', {
      nowTimestamp: nowTimestamp,
      nowTime: new Date(nowTimestamp).toISOString(),
      orderTimeoutMinutes: orderTimeoutMinutes,
      expiredTimestamp: expiredTimestamp,
      expiredAt: expiredAt.toISOString(),
      diffMinutes: orderTimeoutMinutes
    });
    
    // 5. 创建订单数据
    const orderData = {
      orderNo: orderNo,
      userId: userInfo._id,
      userOpenid: openid,
      storeId: storeId,
      storeName: store.data.name || storeInfo.name,
      
      // 商品信息
      items: cartItems.map(item => {
        // 处理规格信息：优先使用selectedSpecs，转换为字符串格式
        let specText = '';
        if (item.selectedSpecs && Array.isArray(item.selectedSpecs) && item.selectedSpecs.length > 0) {
          // 将selectedSpecs数组转换为字符串，格式：大碗、微辣
          specText = item.selectedSpecs.map(spec => spec.optionName).join('、');
        } else if (item.spec) {
          // 兼容旧格式
          specText = typeof item.spec === 'string' ? item.spec : JSON.stringify(item.spec);
        }
        
        return {
          productId: item.id || item.productId,
          productName: item.name || item.productName,
          price: Math.round((parseFloat(item.finalPrice || item.price) || 0) * 100), // 价格统一以分存储，优先使用finalPrice
          quantity: item.quantity,
          spec: specText, // 规格：大碗、微辣等
          image: item.image || item.coverUrl || '',
          selectedSpecs: item.selectedSpecs || [] // 保存完整的规格信息，便于后续使用
        };
      }),
      
      // 金额信息（统一以分存储）
      amountGoods: amountGoodsFen, // 商品金额（分）
      amountDelivery: deliveryFeeFen, // 配送费（分，从平台配置获取，给骑手）
      platformFee: platformFee, // 平台服务费（分），从商品金额中扣除，给平台管理端
      platformFeeRate: platformFeeRate, // 平台服务费比例（记录）
      amountDiscount: 0, // 优惠金额（分）
      amountTotal: Math.round(totalAmount * 100), // 总金额（分）= 商品金额 + 配送费（顾客支付）
      amountPayable: Math.round(totalAmount * 100), // 应付金额（分）= 总金额
      merchantIncome: Math.round(merchantIncome * 100), // 商家收入（分）= 商品金额 - 平台服务费
      
      // 订单超时时间
      // 注意：微信云数据库保存 Date 对象时会自动转换为服务器时间
      // 我们使用时间戳计算，然后转换为 Date 对象保存
      expiredAt: expiredAt,
      
      // 配送信息 - 完整保存地址信息
      address: address ? {
        name: address.name || userInfo.nickname || '用户',
        phone: address.phone || userInfo.phone || '',
        address: address.address || '未设置地址',
        addressDetail: address.addressDetail || address.address || '',
        buildingName: address.buildingName || '',
        houseNumber: address.houseNumber || ''
      } : {
        name: userInfo.nickname || '用户',
        phone: userInfo.phone || '',
        address: '未设置地址',
        addressDetail: '未设置地址',
        buildingName: '',
        houseNumber: ''
      },
      
      // 备注
      remark: remark || '',
      
      // 餐具信息
      needCutlery: needCutlery !== undefined ? needCutlery : true, // 是否需要餐具，默认需要
      cutleryQuantity: needCutlery ? (cutleryQuantity || 1) : 0, // 餐具数量，如果不需要则为0
      
      // 配送方式：delivery-外送, pickup-自取
      deliveryType: deliveryType || 'delivery',
      
      // 订单状态：根据自动接单设置决定初始状态
      orderStatus: initialOrderStatus, // pending-待确认, confirmed-已确认, preparing-制作中, ready-待配送, delivering-配送中, completed-已完成, cancelled-已取消
      payStatus: payStatus || 'unpaid', // 支付状态：使用客户端传递的值，默认为未支付（需要商家确认收到款项后更新为paid）
      paymentProof: paymentProof || '', // 支付凭证的云存储fileID
      
      // 时间戳
      createdAt: db.serverDate(),
      updatedAt: db.serverDate()
    };
    
    console.log('【创建订单】订单数据:', orderData);
    
    // 6. 保存订单到数据库
    const result = await db.collection('orders').add({
      data: orderData
    });
    
    console.log('【创建订单】订单创建成功，ID:', result._id);
    
    // 验证保存的超时时间（查询刚创建的订单）
    try {
      const savedOrder = await db.collection('orders').doc(result._id).get();
      if (savedOrder.data && savedOrder.data.expiredAt) {
        const savedExpiredAt = savedOrder.data.expiredAt;
        const now = new Date();
        let savedExpired;
        if (savedExpiredAt.getTime) {
          savedExpired = new Date(savedExpiredAt.getTime());
        } else {
          savedExpired = new Date(savedExpiredAt);
        }
        const diffMs = savedExpired.getTime() - now.getTime();
        const diffMinutes = Math.floor(diffMs / (1000 * 60));
        
        console.log('【创建订单】验证保存的超时时间:', {
          savedExpiredAt: savedExpired.toISOString(),
          now: now.toISOString(),
          diffMs: diffMs,
          diffMinutes: diffMinutes,
          expectedMinutes: orderTimeoutMinutes
        });
      }
    } catch (verifyErr) {
      console.warn('【创建订单】验证超时时间失败:', verifyErr);
    }
    
    return {
      code: 200,
      message: '订单创建成功',
      data: {
        orderId: result._id,
        orderNo: orderNo,
        amountTotal: totalAmount
      }
    };
    
  } catch (error) {
    console.error('【创建订单】异常:', error);
    return {
      code: 500,
      message: '创建订单失败',
      error: error.message
    };
  }
}

/**
 * 获取用户订单列表
 */
async function getOrderList(openid, data) {
  try {
    const { status, page = 1, pageSize = 20 } = data;
    
    console.log('【获取订单列表】参数:', { status, page, pageSize });
    
    // 查询用户
    const user = await db.collection('users')
      .where({ openid })
      .get();
    
    if (!user.data || user.data.length === 0) {
      return {
        code: 404,
        message: '用户不存在'
      };
    }
    
    const userId = user.data[0]._id;
    
    // 构建查询条件
    const whereCondition = { userId };
    if (status) {
      whereCondition.orderStatus = status;
    }
    
    // 获取平台配置（预计送达时间）
    let platformConfig = null;
    try {
      const configRes = await db.collection('platform_config').limit(1).get();
      if (configRes.data.length > 0) {
        platformConfig = configRes.data[0];
      }
    } catch (err) {
      console.warn('【获取订单列表】获取平台配置失败:', err);
    }
    const estimatedDeliveryMinutes = platformConfig?.estimatedDeliveryMinutes || 30;
    
    // 查询订单
    const result = await db.collection('orders')
      .where(whereCondition)
      .orderBy('createdAt', 'desc')
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .get();
    
    // 获取总数
    const countResult = await db.collection('orders')
      .where(whereCondition)
      .count();
    
    // 格式化订单数据
    const formattedList = result.data.map(order => {
      // 处理金额（从分转换为元）
      // 所有金额字段在数据库中都是以分为单位存储的，统一除以100转换为元
      let amountGoods = order.amountGoods || 0;
      if (typeof amountGoods === 'number') {
        // 如果金额大于等于100（1元），说明是以分为单位存储的，需要转换
        amountGoods = amountGoods >= 100 ? amountGoods / 100 : amountGoods;
      }
      
      let amountDelivery = order.amountDelivery || 0;
      if (typeof amountDelivery === 'number') {
        // 如果金额大于等于100（1元），说明是以分为单位存储的，需要转换
        amountDelivery = amountDelivery >= 100 ? amountDelivery / 100 : amountDelivery;
      }
      
      let platformFee = order.platformFee || 0;
      if (typeof platformFee === 'number') {
        // 如果金额大于等于100（1元），说明是以分为单位存储的，需要转换
        platformFee = platformFee >= 100 ? platformFee / 100 : platformFee;
      }
      
      let amountPayable = order.amountPayable || order.amountTotal || 0;
      if (typeof amountPayable === 'number') {
        // 如果金额大于等于100（1元），说明是以分为单位存储的，需要转换
        amountPayable = amountPayable >= 100 ? amountPayable / 100 : amountPayable;
      }
      
      // 计算订单超时倒计时（使用真实时间）
      const expiredMinutes = calculateExpiredMinutes(order.expiredAt, order.createdAt, order.completedAt);
      
      // 计算预计送达时间（如果订单状态为ready或之后）
      let estimatedDeliveryTime = null;
      if ((order.orderStatus === 'ready' || order.orderStatus === 'delivering' || order.orderStatus === 'completed') && order.readyAt) {
        estimatedDeliveryTime = calculateEstimatedDeliveryTime(order.readyAt, estimatedDeliveryMinutes);
      }
      
      return {
        ...order,
        amountGoods: amountGoods.toFixed(2),
        amountDelivery: amountDelivery.toFixed(2),
        platformFee: platformFee.toFixed(2),
        amountPayable: amountPayable.toFixed(2),
        expiredAt: order.expiredAt ? formatDate(order.expiredAt) : null,
        expiredMinutes: expiredMinutes, // 剩余分钟数，负数表示已超时
        readyAt: order.readyAt ? formatDate(order.readyAt) : null,
        estimatedDeliveryTime: estimatedDeliveryTime, // 预计送达时间
        estimatedDeliveryMinutes: estimatedDeliveryMinutes, // 预计配送时间配置值（分钟）
        createdAt: formatDate(order.createdAt),
        riderOpenid: order.riderOpenid || null // 骑手openid，用于判断是否已接单
      };
    });
    
    console.log('【获取订单列表】查询结果:', formattedList.length, '条');
    
    return {
      code: 200,
      message: 'ok',
      data: {
        list: formattedList,
        total: countResult.total,
        page: page,
        pageSize: pageSize
      }
    };
    
  } catch (error) {
    console.error('【获取订单列表】异常:', error);
    return {
      code: 500,
      message: '获取订单列表失败',
      error: error.message
    };
  }
}

/**
 * 获取商家订单列表
 */
async function getMerchantOrders(openid, data) {
  try {
    const { status, page = 1, pageSize = 20, merchantId, storeId: providedStoreId } = data;
    
    console.log('【获取商家订单】参数:', { status, page, pageSize, merchantId, providedStoreId });
    
    let storeId = providedStoreId;
    let merchantInfo = null;
    
    // 如果提供了 merchantId，优先使用 merchantId 查询
    if (merchantId) {
      console.log('【获取商家订单】使用提供的 merchantId:', merchantId);
      const merchant = await db.collection('merchants').doc(merchantId).get();
      if (merchant.data) {
        merchantInfo = merchant.data;
        // 验证：如果是账户密码登录，需要验证 openid 是否匹配（安全验证）
        // 但账户密码登录时，openid 是当前微信用户的，不是商家的，所以暂时跳过验证
        storeId = merchantInfo.storeId || merchantInfo._id;
      }
    }
    
    // 如果没有提供 merchantId 或查询失败，使用 openid 查询（微信登录场景）
    if (!merchantInfo) {
      console.log('【获取商家订单】使用 openid 查询商家:', openid);
      const merchant = await db.collection('merchants')
        .where({ openid })
        .get();
      
      if (!merchant.data || merchant.data.length === 0) {
        return {
          code: 404,
          message: '商家不存在'
        };
      }
      
      merchantInfo = merchant.data[0];
      storeId = merchantInfo.storeId || merchantInfo._id;
    }
    
    console.log('【获取商家订单】店铺ID:', storeId);
    
    // 2. 构建查询条件
    const whereCondition = { storeId };
    if (status) {
      whereCondition.orderStatus = status;
    }
    
    // 3. 查询订单
    const result = await db.collection('orders')
      .where(whereCondition)
      .orderBy('createdAt', 'desc')
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .get();
    
    // 4. 获取总数
    const countResult = await db.collection('orders')
      .where(whereCondition)
      .count();
    
    // 格式化订单数据
    const formattedList = result.data.map(order => {
      // 处理金额（从分转换为元）
      // 所有金额字段在数据库中都是以分为单位存储的，统一除以100转换为元
      let amountGoods = order.amountGoods || 0;
      if (typeof amountGoods === 'number') {
        // 如果金额大于等于100（1元），说明是以分为单位存储的，需要转换
        amountGoods = amountGoods >= 100 ? amountGoods / 100 : amountGoods;
      }
      
      let amountDelivery = order.amountDelivery || 0;
      if (typeof amountDelivery === 'number') {
        // 如果金额大于等于100（1元），说明是以分为单位存储的，需要转换
        amountDelivery = amountDelivery >= 100 ? amountDelivery / 100 : amountDelivery;
      }
      
      let platformFee = order.platformFee || 0;
      if (typeof platformFee === 'number') {
        // 如果金额大于等于100（1元），说明是以分为单位存储的，需要转换
        platformFee = platformFee >= 100 ? platformFee / 100 : platformFee;
      }
      
      let amountPayable = order.amountPayable || order.amountTotal || 0;
      if (typeof amountPayable === 'number') {
        // 如果金额大于等于100（1元），说明是以分为单位存储的，需要转换
        amountPayable = amountPayable >= 100 ? amountPayable / 100 : amountPayable;
      }
      
      // 计算订单超时倒计时（使用真实时间）
      const expiredMinutes = calculateExpiredMinutes(order.expiredAt, order.createdAt, order.completedAt);
      
      return {
        ...order,
        amountGoods: amountGoods.toFixed(2),
        amountDelivery: amountDelivery.toFixed(2),
        platformFee: platformFee.toFixed(2),
        amountPayable: amountPayable.toFixed(2),
        amountTotal: amountPayable.toFixed(2), // 兼容字段
        expiredAt: order.expiredAt ? formatDate(order.expiredAt) : null,
        expiredMinutes: expiredMinutes, // 剩余分钟数，负数表示已超时
        readyAt: order.readyAt ? formatDate(order.readyAt) : null,
        createdAt: formatDate(order.createdAt),
        refundStatus: order.refundStatus || null // 退款状态
      };
    });
    
    // 查询退款申请信息
    const orderIds = formattedList.map(order => order._id);
    let refundsMap = {};
    if (orderIds.length > 0) {
      try {
        const refundsResult = await db.collection('refunds')
          .where({
            orderId: db.command.in(orderIds),
            status: db.command.in(['pending', 'processing', 'approved'])
          })
          .get();
        
        // 构建订单ID到退款申请的映射
        refundsResult.data.forEach(refund => {
          refundsMap[refund.orderId] = {
            refundId: refund._id,
            refundNo: refund.refundNo,
            refundReason: refund.refundReason,
            refundReasonText: refund.refundReasonText,
            refundAmount: refund.refundAmount,
            status: refund.status,
            images: refund.images || [],
            selectedItems: refund.selectedItems || [],
            createdAt: formatDate(refund.createdAt)
          };
        });
      } catch (err) {
        console.warn('【获取商家订单】查询退款申请失败:', err);
      }
    }
    
    // 将退款申请信息添加到订单中
    const finalList = formattedList.map(order => {
      const refundInfo = refundsMap[order._id];
      return {
        ...order,
        refundInfo: refundInfo || null
      };
    });
    
    console.log('【获取商家订单】查询结果:', finalList.length, '条');
    
    return {
      code: 200,
      message: 'ok',
      data: {
        list: finalList,
        total: countResult.total,
        page: page,
        pageSize: pageSize
      }
    };
    
  } catch (error) {
    console.error('【获取商家订单】异常:', error);
    return {
      code: 500,
      message: '获取商家订单失败',
      error: error.message
    };
  }
}

/**
 * 更新订单状态
 */
async function updateOrderStatus(openid, data) {
  try {
    const { orderId, status } = data;
    
    console.log('【更新订单状态】参数:', { orderId, status });
    
    if (!orderId || !status) {
      return {
        code: 400,
        message: '缺少必要参数'
      };
    }
    
    // 获取订单信息
    const orderResult = await db.collection('orders').doc(orderId).get();
    if (!orderResult.data) {
      return {
        code: 404,
        message: '订单不存在'
      };
    }
    
    const order = orderResult.data;
    
    // 限制：商家不能直接将订单状态更新为 completed（已完成）
    // 只有骑手通过 confirmDelivery 接口才能将订单状态更新为 completed
    if (status === 'completed') {
      return {
        code: 403,
        message: '商家不能直接完成订单，订单完成需要骑手确认送达'
      };
    }
    
    // 更新订单状态
    const updateData = {
      orderStatus: status,
      updatedAt: db.serverDate()
    };
    
    // 如果订单状态变为ready（出餐），记录出餐时间
    if (status === 'ready' && !order.readyAt) {
      updateData.readyAt = db.serverDate();
      console.log('【更新订单状态】记录出餐时间');
    }
    
    await db.collection('orders').doc(orderId).update({
      data: updateData
    });
    
    console.log('【更新订单状态】更新成功');
    
    return {
      code: 200,
      message: '订单状态更新成功'
    };
    
  } catch (error) {
    console.error('【更新订单状态】异常:', error);
    return {
      code: 500,
      message: '更新订单状态失败',
      error: error.message
    };
  }
}

/**
 * 更新订单支付状态
 */
async function updateOrderPayStatus(openid, data) {
  try {
    const { orderId, payStatus } = data;
    
    console.log('【更新订单支付状态】参数:', { orderId, payStatus });
    
    if (!orderId || !payStatus) {
      return {
        code: 400,
        message: '缺少必要参数'
      };
    }
    
    if (payStatus !== 'paid' && payStatus !== 'unpaid') {
      return {
        code: 400,
        message: '无效的支付状态'
      };
    }
    
    // 获取订单信息
    const orderResult = await db.collection('orders').doc(orderId).get();
    if (!orderResult.data) {
      return {
        code: 404,
        message: '订单不存在'
      };
    }
    
    const order = orderResult.data;
    
    // 验证权限：只有商家可以更新支付状态
    // 通过订单的storeId查询店铺，验证商家权限
    let hasPermission = false;
    
    if (order.storeId) {
      try {
        const merchantResult = await db.collection('merchants')
          .where({ 
            openid: openid,
            status: db.command.in(['active', 'pending'])
          })
          .get();
        
        if (merchantResult.data && merchantResult.data.length > 0) {
          const merchant = merchantResult.data[0];
          
          // 查询商家关联的店铺
          const storeResult = await db.collection('stores')
            .where({ merchantId: merchant._id })
            .get();
          
          if (storeResult.data && storeResult.data.length > 0) {
            const store = storeResult.data.find(s => s._id === order.storeId);
            if (store) {
              hasPermission = true;
              console.log('【更新订单支付状态】权限验证通过：商家权限');
            }
          }
        }
      } catch (err) {
        console.warn('【更新订单支付状态】权限验证失败:', err);
      }
    }
    
    // 检查是否是管理员
    if (!hasPermission) {
      try {
        const adminResult = await db.collection('admins')
          .where({ openid: openid })
          .get();
        
        if (adminResult.data && adminResult.data.length > 0) {
          hasPermission = true;
          console.log('【更新订单支付状态】权限验证通过：管理员权限');
        }
      } catch (err) {
        console.warn('【更新订单支付状态】查询管理员失败:', err);
      }
    }
    
    if (!hasPermission) {
      return {
        code: 403,
        message: '无权更新此订单的支付状态'
      };
    }
    
    // 更新订单支付状态
    await db.collection('orders').doc(orderId).update({
      data: {
        payStatus: payStatus,
        updatedAt: db.serverDate()
      }
    });
    
    console.log('【更新订单支付状态】更新成功，订单号:', order.orderNo, '支付状态:', payStatus);
    
    return {
      code: 200,
      message: '支付状态更新成功'
    };
    
  } catch (error) {
    console.error('【更新订单支付状态】异常:', error);
    return {
      code: 500,
      message: '更新支付状态失败',
      error: error.message
    };
  }
}

/**
 * 获取用户在某店铺可评论的订单列表
 * 条件：当前用户(openid) + 指定店铺 + 已支付 + 已完成 + 未评价
 */
async function getUserOrdersForReview(openid, data) {
  try {
    const { storeId, page = 1, pageSize = 20 } = data || {};

    if (!storeId) {
      return { code: 400, message: '缺少店铺ID' };
    }

    // 查询符合条件的订单
    const where = {
      storeId: storeId,
      userOpenid: openid,
      payStatus: 'paid',
      orderStatus: 'completed',
      // 未评价：hasReview 不存在或不为 true
      hasReview: db.command.neq(true)
    };

    const listRes = await db.collection('orders')
      .where(where)
      .orderBy('createdAt', 'desc')
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .get();

    const countRes = await db.collection('orders')
      .where(where)
      .count();

    // 仅返回前端需要的字段
    const list = (listRes.data || []).map(o => ({
      _id: o._id,
      orderNo: o.orderNo,
      createdAt: o.createdAt,
      amountGoods: o.amountGoods,
      amountDelivery: o.amountDelivery,
      amountTotal: o.amountTotal
    }));

    return {
      code: 200,
      message: 'ok',
      data: { list, total: countRes.total, page, pageSize }
    };
  } catch (error) {
    console.error('【获取可评论订单】异常:', error);
    return { code: 500, message: '获取可评论订单失败', error: error.message };
  }
}

/**
 * 更新销售统计
 */
async function updateSalesStatistics(order) {
  try {
    const { storeId, amountTotal, amountGoods, amountDelivery, createdAt, items } = order;
    
    console.log('【更新销售统计】开始更新，参数:', { 
      storeId, 
      amountTotal, 
      itemsCount: items ? items.length : 0,
      hasItems: !!items
    });
    
    if (!storeId) {
      console.warn('【更新销售统计】店铺ID不存在，跳过更新');
      return;
    }
    
    // 获取今天的日期（YYYY-MM-DD格式）- 使用中国时区（UTC+8）
    const now = new Date();
    const chinaTimeOffset = 8 * 60 * 60 * 1000; // 8小时的毫秒数
    const chinaTime = new Date(now.getTime() + chinaTimeOffset);
    const dateStr = `${chinaTime.getUTCFullYear()}-${String(chinaTime.getUTCMonth() + 1).padStart(2, '0')}-${String(chinaTime.getUTCDate()).padStart(2, '0')}`;
    
    // 获取当前月份（YYYY-MM格式），用于月售统计
    const monthStr = `${chinaTime.getUTCFullYear()}-${String(chinaTime.getUTCMonth() + 1).padStart(2, '0')}`;
    
    // 1. 更新日销售统计（如果sales_statistics集合存在）
    try {
      const statsResult = await db.collection('sales_statistics')
        .where({
          storeId: storeId,
          date: dateStr
        })
        .get();
      
      if (statsResult.data && statsResult.data.length > 0) {
        // 更新现有统计
        const stats = statsResult.data[0];
        await db.collection('sales_statistics').doc(stats._id).update({
          data: {
            orderCount: db.command.inc(1),
            totalSales: db.command.inc(amountTotal),
            totalGoods: db.command.inc(amountGoods),
            totalDelivery: db.command.inc(amountDelivery),
            updatedAt: db.serverDate()
          }
        });
        console.log('【更新销售统计】日统计更新成功');
      } else {
        // 创建新的统计记录
        await db.collection('sales_statistics').add({
          data: {
            storeId: storeId,
            date: dateStr,
            orderCount: 1,
            totalSales: amountTotal,
            totalGoods: amountGoods,
            totalDelivery: amountDelivery,
            createdAt: db.serverDate(),
            updatedAt: db.serverDate()
          }
        });
        console.log('【更新销售统计】日统计创建成功');
      }
    } catch (err) {
      // 如果sales_statistics集合不存在，跳过日统计更新，不影响月售更新
      console.warn('【更新销售统计】日统计更新失败（集合可能不存在），跳过:', err.message);
    }
    
    // 2. 更新商品的月销量（如果订单有商品信息）
    if (items && Array.isArray(items) && items.length > 0) {
      console.log('【更新商品销量】开始更新商品销量，商品数量:', items.length);
      for (const item of items) {
        if (item.productId) {
          try {
            const quantity = item.quantity || 1;
            console.log(`【更新商品销量】更新商品 ${item.productId}，数量: ${quantity}`);
            
            // 使用增量更新：直接增加商品的销量
            await db.collection('products').doc(item.productId).update({
              data: {
                sales: db.command.inc(quantity), // 增量更新销量
                updatedAt: db.serverDate()
              }
            });
            
            console.log(`【更新商品销量】商品 ${item.productId} 销量增加成功: ${quantity}`);
          } catch (err) {
            console.error(`【更新商品销量】商品 ${item.productId} 更新失败:`, err);
            // 不影响主流程，继续处理下一个商品
          }
        } else {
          console.warn('【更新商品销量】商品项缺少productId:', item);
        }
      }
    } else {
      console.warn('【更新商品销量】订单没有商品信息，items:', items);
    }
    
    // 3. 更新店铺的月销量（使用增量更新）
    try {
      console.log('【更新店铺月销量】开始更新店铺销量，店铺ID:', storeId);
      
      // 先检查店铺是否存在
      const storeDoc = await db.collection('stores').doc(storeId).get();
      if (!storeDoc.data) {
        console.error(`【更新店铺月销量】店铺不存在，店铺ID: ${storeId}，跳过更新`);
      } else {
        console.log(`【更新店铺月销量】店铺存在，当前月销量: ${storeDoc.data.monthlySales || storeDoc.data.sales || 0}`);
        
        await db.collection('stores').doc(storeId).update({
          data: {
            monthlySales: db.command.inc(1), // 月销量+1（订单数）
            sales: db.command.inc(1), // 同时更新sales字段（兼容）
            updatedAt: db.serverDate()
          }
        });
        
        console.log(`【更新店铺月销量】店铺 ${storeId} 月销量+1 成功`);
        
        // 验证更新结果
        const updatedStore = await db.collection('stores').doc(storeId).get();
        if (updatedStore.data) {
          console.log(`【更新店铺月销量】更新后店铺月销量: ${updatedStore.data.monthlySales || updatedStore.data.sales || 0}`);
        }
      }
    } catch (err) {
      console.error('【更新店铺月销量】失败:', err);
      console.error('【更新店铺月销量】错误详情:', err.message, err.stack);
      // 不影响主流程
    }
    
    console.log('【更新销售统计】全部更新完成');
    
  } catch (error) {
    console.error('【更新销售统计】异常:', error);
    console.error('【更新销售统计】异常详情:', error.message, error.stack);
    // 不影响订单状态更新，只记录错误
  }
}

/**
 * 取消订单
 */
async function cancelOrder(openid, data) {
  try {
    const { orderId } = data;
    
    console.log('【取消订单】参数:', { orderId, openid });
    
    if (!orderId) {
      return {
        code: 400,
        message: '缺少订单ID'
      };
    }
    
    // 获取订单信息
    const orderResult = await db.collection('orders').doc(orderId).get();
    if (!orderResult.data) {
      return {
        code: 404,
        message: '订单不存在'
      };
    }
    
    const order = orderResult.data;
    
    // 验证权限：订单创建者或商家可以取消订单
    let hasPermission = false;
    
    // 1. 检查是否是订单创建者
    if (order.userOpenid && order.userOpenid === openid) {
      hasPermission = true;
      console.log('【取消订单】权限验证通过：订单创建者');
    }
    
    // 2. 检查是否是商家（未支付订单允许商家取消）
    if (!hasPermission && order.storeId) {
      try {
        // 查询商家信息
        const merchantResult = await db.collection('merchants')
          .where({ 
            openid: openid,
            status: db.command.in(['active', 'pending'])
          })
          .get();
        
        if (merchantResult.data && merchantResult.data.length > 0) {
          const merchant = merchantResult.data[0];
          
          // 查询商家关联的店铺
          const storeResult = await db.collection('stores')
            .where({ merchantId: merchant._id })
            .get();
          
          if (storeResult.data && storeResult.data.length > 0) {
            const store = storeResult.data.find(s => s._id === order.storeId);
            if (store) {
              // 商家只能取消未支付的订单
              if (order.payStatus === 'unpaid') {
                hasPermission = true;
                console.log('【取消订单】权限验证通过：商家取消未支付订单');
              } else {
                console.log('【取消订单】商家只能取消未支付的订单');
              }
            }
          }
        }
      } catch (err) {
        console.warn('【取消订单】商家权限验证失败:', err);
      }
    }
    
    // 3. 检查是否是管理员
    if (!hasPermission) {
      try {
        const adminResult = await db.collection('admins')
          .where({ openid: openid })
          .get();
        
        if (adminResult.data && adminResult.data.length > 0) {
          hasPermission = true;
          console.log('【取消订单】权限验证通过：管理员权限');
        }
      } catch (err) {
        console.warn('【取消订单】查询管理员失败:', err);
      }
    }
    
    if (!hasPermission) {
      return {
        code: 403,
        message: '无权取消此订单'
      };
    }
    
    // 验证订单状态：只有待确认、已确认、制作中的订单可以取消
    const allowedStatuses = ['pending', 'confirmed', 'preparing'];
    if (!allowedStatuses.includes(order.orderStatus)) {
      return {
        code: 400,
        message: `订单状态为"${getOrderStatusText(order.orderStatus)}"，无法取消`
      };
    }
    
    // 如果订单已支付，需要处理退款（这里暂时只更新状态，退款功能后续实现）
    if (order.payStatus === 'paid') {
      console.log('【取消订单】订单已支付，需要处理退款');
      // TODO: 后续实现退款逻辑
    }
    
    // 如果订单已完成，需要减少销量
    if (order.orderStatus === 'completed' && order.storeId) {
      await decreaseSalesStatistics(order);
    }
    
    // 更新订单状态为已取消
    await db.collection('orders').doc(orderId).update({
      data: {
        orderStatus: 'cancelled',
        cancelledAt: db.serverDate(),
        updatedAt: db.serverDate()
      }
    });
    
    console.log('【取消订单】取消成功，订单号:', order.orderNo);
    
    return {
      code: 200,
      message: '订单已取消'
    };
    
  } catch (error) {
    console.error('【取消订单】异常:', error);
    return {
      code: 500,
      message: '取消订单失败',
      error: error.message
    };
  }
}

/**
 * 减少销售统计（订单取消时调用）
 */
async function decreaseSalesStatistics(order) {
  try {
    const { storeId, items } = order;
    
    if (!storeId) {
      return;
    }
    
    // 1. 减少商品的月销量
    if (items && Array.isArray(items) && items.length > 0) {
      for (const item of items) {
        if (item.productId) {
          try {
            await db.collection('products').doc(item.productId).update({
              data: {
                sales: db.command.inc(-(item.quantity || 1)), // 减少销量
                updatedAt: db.serverDate()
              }
            });
            
            console.log(`【减少商品销量】商品 ${item.productId} 销量减少: ${item.quantity || 1}`);
          } catch (err) {
            console.error(`【减少商品销量】商品 ${item.productId} 更新失败:`, err);
          }
        }
      }
    }
    
    // 2. 减少店铺的月销量
    try {
      await db.collection('stores').doc(storeId).update({
        data: {
          monthlySales: db.command.inc(-1), // 月销量-1
          sales: db.command.inc(-1), // 同时更新sales字段（兼容）
          updatedAt: db.serverDate()
        }
      });
      
      console.log(`【减少店铺月销量】店铺 ${storeId} 月销量-1`);
    } catch (err) {
      console.error('【减少店铺月销量】失败:', err);
    }
    
  } catch (error) {
    console.error('【减少销售统计】异常:', error);
  }
}

// 获取订单状态文本（辅助函数）
function getOrderStatusText(status) {
  const statusMap = {
    'pending': '待确认',
    'confirmed': '已确认',
    'preparing': '制作中',
    'ready': '待配送',
    'delivering': '配送中',
    'completed': '已完成',
    'cancelled': '已取消'
  };
  return statusMap[status] || '未知状态';
}

/**
 * 获取退款状态文本
 */
function getRefundStatusText(status) {
  const statusMap = {
    'pending': '待处理',
    'processing': '处理中',
    'approved': '已同意',
    'rejected': '已拒绝',
    'completed': '已完成'
  };
  return statusMap[status] || '未知状态';
}

/**
 * 格式化日期时间
 * 处理云数据库的Date对象和标准Date对象
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
  const hours = String(chinaTime.getUTCHours()).padStart(2, '0');
  const minutes = String(chinaTime.getUTCMinutes()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}`;
}

/**
 * 计算订单超时倒计时（返回剩余分钟数，负数表示已超时）
 * 使用真实时间：如果订单已完成，使用完成时间；如果未完成，使用当前服务器时间
 * 注意：此函数在云函数中执行，new Date() 就是服务器时间
 */
function calculateExpiredMinutes(expiredAt, createdAt, completedAt) {
  if (!expiredAt) return null;
  
  try {
    // 获取真实时间：如果订单已完成，使用完成时间；否则使用当前服务器时间
    let realTime;
    if (completedAt) {
      // 订单已完成，使用完成时间
      // 处理云数据库的Date对象
      if (completedAt instanceof Date) {
        realTime = completedAt;
      } else if (completedAt.getTime) {
        // 云数据库的Date对象有getTime方法
        realTime = new Date(completedAt.getTime());
      } else {
        // 字符串或其他格式
        realTime = new Date(completedAt);
      }
    } else {
      // 订单未完成，使用当前服务器时间（云函数中的 new Date() 就是服务器时间）
      realTime = new Date();
    }
    
    // 解析超时时间
    let expired;
    if (expiredAt instanceof Date) {
      expired = expiredAt;
    } else if (expiredAt.getTime) {
      // 云数据库的Date对象
      expired = new Date(expiredAt.getTime());
    } else if (typeof expiredAt === 'string') {
      // 字符串格式，尝试解析
      expired = new Date(expiredAt);
    } else if (typeof expiredAt === 'object' && expiredAt.type === 'date') {
      // 云数据库的特殊日期对象格式 { type: 'date', date: '2025-11-11T14:53:00.000Z' }
      if (expiredAt.date) {
        expired = new Date(expiredAt.date);
      } else {
        expired = new Date(expiredAt);
      }
    } else {
      // 其他格式
      expired = new Date(expiredAt);
    }
    
    // 验证时间是否有效
    if (isNaN(realTime.getTime()) || isNaN(expired.getTime())) {
      console.warn('【计算超时时间】时间解析失败:', { 
        expiredAt, 
        completedAt,
        realTime: realTime.getTime(),
        expired: expired.getTime()
      });
      return null;
    }
    
    // 计算差值（毫秒）
    const diffMs = expired.getTime() - realTime.getTime();
    
    // 转换为分钟数（使用 Math.floor 向下取整，更准确）
    const minutes = Math.floor(diffMs / (1000 * 60));
    
    // 添加调试日志（仅在异常情况下记录，避免日志过多）
    if (minutes < 5 && minutes >= 0) {
      console.log('【计算超时时间】剩余时间较短:', {
        expiredAt: expired.toISOString(),
        realTime: realTime.toISOString(),
        diffMs: diffMs,
        minutes: minutes
      });
    }
    
    return minutes;
  } catch (error) {
    console.error('【计算超时时间】异常:', error);
    return null;
  }
}

/**
 * 计算预计送达时间
 */
function calculateEstimatedDeliveryTime(readyAt, estimatedDeliveryMinutes) {
  if (!readyAt || !estimatedDeliveryMinutes) return null;
  const ready = readyAt instanceof Date ? readyAt : new Date(readyAt);
  const estimated = new Date(ready.getTime() + estimatedDeliveryMinutes * 60 * 1000);
  return formatDate(estimated);
}

/**
 * 获取管理员订单列表（所有订单）
 */
async function getAdminOrderList(openid, data) {
  try {
    const { filter, category, page = 1, pageSize = 20, orderId } = data;
    
    console.log('【获取管理员订单列表】参数:', { filter, category, page, pageSize, orderId });
    
    // 如果提供了订单ID，直接查询单个订单（优化性能）
    if (orderId) {
      try {
        const orderResult = await db.collection('orders').doc(orderId).get();
        if (!orderResult.data) {
          return {
            code: 0,
            message: 'ok',
            data: {
              list: [],
              hasMore: false,
              total: 0,
              page: 1,
              pageSize: 1
            }
          };
        }
        
        // 使用单个订单的格式化逻辑（复用下面的格式化代码）
        const order = orderResult.data;
        
        // 获取店铺信息
        let storeInfo = null;
        if (order.storeId) {
          try {
            const storeResult = await db.collection('stores')
              .doc(order.storeId)
              .field({
                _id: true,
                name: true,
                logoUrl: true,
                avatar: true,
                address: true
              })
              .get();
            
            if (storeResult.data) {
              let logoUrl = storeResult.data.logoUrl || storeResult.data.avatar || '';
              if (logoUrl && logoUrl.includes('cloud://')) {
                const cloudMatch = logoUrl.match(/cloud:\/\/[^\/]+(?:\/[^"]*)?/);
                if (cloudMatch) {
                  logoUrl = cloudMatch[0];
                }
              }
              storeInfo = {
                name: storeResult.data.name || '未知店铺',
                logoUrl: logoUrl || '/pages/小标/商家.png',
                address: storeResult.data.address || '未知地址'
              };
            }
          } catch (err) {
            console.warn('获取店铺信息失败:', err);
          }
        }
        
        // 获取用户信息（无店铺订单）
        let userMap = new Map();
        if (order.orderType === 'gaming' || order.orderType === 'reward' || order.orderType === 'express') {
          if (order.userId) {
            try {
              const userResult = await db.collection('users')
                .doc(order.userId)
                .field({
                  _id: true,
                  nickname: true,
                  avatarUrl: true,
                  avatar: true
                })
                .get();
              
              if (userResult.data) {
                userMap.set(order.userId, userResult.data);
              }
            } catch (err) {
              console.warn('获取用户信息失败:', err);
            }
          }
        }
        
        // 格式化订单（复用下面的格式化逻辑）
        // 获取订单商品
        let orderItems = order.items || [];
        if (!orderItems || orderItems.length === 0) {
          try {
            const itemsResult = await db.collection('order_items')
              .where({ orderId: order._id })
              .get();
            if (itemsResult.data && itemsResult.data.length > 0) {
              orderItems = itemsResult.data.map(item => ({
                productId: item.productId,
                productName: item.nameSnap || item.name || '未知商品',
                price: item.priceSnap || item.price || 0,
                quantity: item.qty || item.quantity || 1,
                spec: item.attrsSnap ? (typeof item.attrsSnap === 'string' ? item.attrsSnap : JSON.stringify(item.attrsSnap)) : (item.spec || ''),
                image: item.image || ''
              }));
            }
          } catch (err) {
            console.warn('获取订单商品失败:', err);
          }
        }
        
        // 格式化商品数据
        const formattedItems = orderItems.map((item, index) => {
          let specText = '';
          if (item.spec) {
            if (typeof item.spec === 'string') {
              try {
                const specObj = JSON.parse(item.spec);
                if (typeof specObj === 'object') {
                  specText = Object.values(specObj).join(' ');
                } else {
                  specText = item.spec;
                }
              } catch (e) {
                specText = item.spec;
              }
            } else if (typeof item.spec === 'object') {
              specText = Object.values(item.spec).join(' ');
            } else {
              specText = String(item.spec);
            }
          }
          
          let price = item.price || 0;
          if (typeof price === 'number') {
            if (price > 1000) price = price / 100;
          } else if (typeof price === 'string') {
            price = parseFloat(price) || 0;
            if (price > 1000) price = price / 100;
          }
          
          return {
            id: item.productId || item.id || `item_${index}`,
            name: item.productName || item.name || '未知商品',
            spec: specText,
            price: price.toFixed(2),
            quantity: item.quantity || item.qty || 1,
            image: item.image || ''
          };
        });
        
        // 处理金额
        let amountGoods = order.amountGoods || 0;
        if (typeof amountGoods === 'number') {
          amountGoods = amountGoods >= 100 ? amountGoods / 100 : amountGoods;
        } else if (typeof amountGoods === 'string') {
          amountGoods = parseFloat(amountGoods) || 0;
          if (amountGoods >= 100) amountGoods = amountGoods / 100;
        }
        
        let amountDelivery = order.amountDelivery || 0;
        if (typeof amountDelivery === 'number') {
          amountDelivery = amountDelivery >= 100 ? amountDelivery / 100 : amountDelivery;
        } else if (typeof amountDelivery === 'string') {
          amountDelivery = parseFloat(amountDelivery) || 0;
          if (amountDelivery >= 100) amountDelivery = amountDelivery / 100;
        }
        
        let platformFee = order.platformFee || 0;
        if (typeof platformFee === 'number') {
          platformFee = platformFee >= 100 ? platformFee / 100 : platformFee;
        } else if (typeof platformFee === 'string') {
          platformFee = parseFloat(platformFee) || 0;
          if (platformFee >= 100) platformFee = platformFee / 100;
        }
        
        let amountPayable = order.amountPayable || order.amountTotal || 0;
        if (typeof amountPayable === 'number') {
          amountPayable = amountPayable >= 100 ? amountPayable / 100 : amountPayable;
        } else if (typeof amountPayable === 'string') {
          amountPayable = parseFloat(amountPayable) || 0;
          if (amountPayable >= 100) amountPayable = amountPayable / 100;
        }
        
        if (amountPayable === 0 && (amountGoods > 0 || amountDelivery > 0)) {
          amountPayable = amountGoods + amountDelivery;
        }
        
        if (amountGoods === 0 && formattedItems.length > 0) {
          amountGoods = formattedItems.reduce((sum, item) => {
            return sum + (parseFloat(item.price) * item.quantity);
          }, 0);
        }
        
        // 处理用户信息
        let userAvatarUrl = null;
        let userNickname = '用户';
        if (order.orderType === 'gaming' || order.orderType === 'reward' || order.orderType === 'express') {
          const userInfo = order.userInfo || (order.userId ? userMap.get(order.userId) : null);
          if (userInfo) {
            userNickname = userInfo.nickname || '用户';
            userAvatarUrl = userInfo.avatarUrl || userInfo.avatar || '';
          }
        }
        
        // 处理商家收入
        let merchantIncome = order.merchantIncome || 0;
        if (typeof merchantIncome === 'number') {
          if (merchantIncome >= 100) merchantIncome = merchantIncome / 100;
        } else if (typeof merchantIncome === 'string') {
          merchantIncome = parseFloat(merchantIncome) || 0;
          if (merchantIncome >= 100) merchantIncome = merchantIncome / 100;
        }
        
        if (merchantIncome === 0 && amountGoods > 0) {
          merchantIncome = amountGoods - platformFee;
        }
        
        // 查询退款信息
        let refundInfo = null;
        try {
          const refundsResult = await db.collection('refunds')
            .where({ orderId: order._id })
            .orderBy('createdAt', 'desc')
            .limit(1)
            .get();
          
          if (refundsResult.data && refundsResult.data.length > 0) {
            const refund = refundsResult.data[0];
            refundInfo = {
              refundId: refund._id,
              refundNo: refund.refundNo,
              status: refund.status,
              refundAmount: refund.refundAmount || 0,
              refundStatusText: getRefundStatusText(refund.status),
              createdAt: formatDate(refund.createdAt),
              completedAt: refund.completedAt ? formatDate(refund.completedAt) : null
            };
          }
        } catch (error) {
          console.warn('查询退款信息失败:', error);
        }
        
        // 格式化订单
        const formattedOrder = {
          id: order._id,
          orderNo: order.orderNo || order._id,
          createdAt: formatDate(order.createdAt),
          payStatus: order.payStatus || 'unpaid',
          orderStatus: order.orderStatus || 'pending',
          refundStatus: order.refundStatus || null,
          statusText: getStatusText(order.payStatus, order.orderStatus),
          isNonStoreOrder: order.orderType === 'gaming' || order.orderType === 'reward' || order.orderType === 'express',
          orderType: order.orderType || 'normal',
          storeLogo: storeInfo?.logoUrl || '/pages/小标/商家.png',
          storeName: storeInfo?.name || order.storeName || '未知店铺',
          storeAddress: storeInfo?.address || (order.address && (order.address.address || order.address.addressDetail)) || '未知地址',
          userInfo: order.userInfo || (order.userId ? userMap.get(order.userId) : null),
          userNickname: userNickname,
          userAvatar: userAvatarUrl,
          amountGoods: amountGoods.toFixed(2),
          amountDelivery: amountDelivery.toFixed(2),
          amountPayable: amountPayable.toFixed(2),
          platformFee: platformFee.toFixed(2),
          merchantIncome: merchantIncome.toFixed(2),
          platformFeeRate: order.platformFeeRate || 0.08,
          refundInfo: refundInfo,
          items: formattedItems,
          address: order.address || null,
          paymentProof: order.paymentProof || '' // 支付凭证的云存储fileID
        };
        
        return {
          code: 0,
          message: 'ok',
          data: {
            list: [formattedOrder],
            hasMore: false,
            total: 1,
            page: 1,
            pageSize: 1
          }
        };
      } catch (error) {
        console.error('【获取管理员订单列表】查询单个订单失败:', error);
        return {
          code: 0,
          message: 'ok',
          data: {
            list: [],
            hasMore: false,
            total: 0,
            page: 1,
            pageSize: 1
          }
        };
      }
    }
    
    // 构建查询条件
    const whereCondition = {};
    
    // 根据订单类型分类设置查询条件
    if (category && category !== 'all') {
      if (category === 'restaurant') {
        // 餐饮：普通订单（有店铺的订单，且订单类型不是gaming、reward、express）
        whereCondition.storeId = db.command.neq(null);
        whereCondition.orderType = db.command.nin(['gaming', 'reward', 'express']);
      } else {
        // 其他分类：匹配订单类型
        whereCondition.orderType = category;
      }
    }
    
    // 根据状态筛选条件设置查询条件
    if (filter && filter !== 'all') {
      if (filter === 'unpaid') {
        whereCondition.payStatus = 'unpaid';
      } else if (filter === 'paid') {
        whereCondition.payStatus = 'paid';
      } else if (filter === 'completed') {
        whereCondition.orderStatus = 'completed';
      } else if (filter === 'cancelled') {
        whereCondition.orderStatus = 'cancelled';
      } else if (filter === 'refunding') {
        whereCondition.refundStatus = 'refunding';
      } else if (filter === 'refunded') {
        whereCondition.refundStatus = 'refunded';
      }
    }
    
    // 查询订单（管理员可以查看所有订单）
    const result = await db.collection('orders')
      .where(whereCondition)
      .orderBy('createdAt', 'desc')
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .get();
    
    // 获取总数
    const countResult = await db.collection('orders')
      .where(whereCondition)
      .count();
    
    // 批量获取店铺信息（优化：减少数据库查询次数）
    const storeIds = [...new Set(result.data.map(order => order.storeId).filter(id => id))];
    const storeMap = new Map();
    
    // 批量获取用户信息（用于无店铺订单）
    const userIds = [...new Set(result.data
      .filter(order => (order.orderType === 'gaming' || order.orderType === 'reward' || order.orderType === 'express') && !order.userInfo && order.userId)
      .map(order => order.userId)
      .filter(id => id))];
    const userMap = new Map();
    
    if (userIds.length > 0) {
      try {
        const usersResult = await db.collection('users')
          .where({
            _id: db.command.in(userIds)
          })
          .field({
            _id: true,
            nickname: true,
            avatarUrl: true,
            avatar: true,
            phone: true
          })
          .get();
        
        usersResult.data.forEach(user => {
          userMap.set(user._id, {
            nickname: user.nickname || '用户',
            avatarUrl: user.avatarUrl || user.avatar || '',
            phone: user.phone || ''
          });
        });
        
        console.log('【获取管理员订单列表】批量获取用户信息:', userMap.size, '条');
      } catch (err) {
        console.warn('批量获取用户信息失败:', err);
      }
    }
    
    if (storeIds.length > 0) {
      try {
        const storesResult = await db.collection('stores')
          .where({
            _id: db.command.in(storeIds)
          })
          .field({
            _id: true,
            name: true,
            logoUrl: true,
            avatar: true,
            address: true,
            deliveryArea: true
          })
          .get();
        
        storesResult.data.forEach(store => {
          // 处理logoUrl，确保格式正确
          let logoUrl = store.logoUrl || store.avatar || '';
          
          // 清理logoUrl中的错误路径前缀
          if (logoUrl && logoUrl.includes('cloud://')) {
            const cloudMatch = logoUrl.match(/cloud:\/\/[^\/]+(?:\/[^"]*)?/);
            if (cloudMatch) {
              logoUrl = cloudMatch[0];
            }
          }
          
          storeMap.set(store._id, {
            name: store.name || '未知店铺',
            logoUrl: logoUrl || '/pages/小标/商家.png',
            address: store.address || store.deliveryArea || '未知地址'
          });
        });
      } catch (err) {
        console.warn('批量获取店铺信息失败:', err);
      }
    }
    
    // 批量获取订单商品（优化：减少数据库查询次数）
    const orderIds = result.data.map(order => order._id);
    const orderItemsMap = new Map();
    
    try {
      const itemsResult = await db.collection('order_items')
        .where({
          orderId: db.command.in(orderIds)
        })
        .get();
      
      // 按订单ID分组
      itemsResult.data.forEach(item => {
        if (!orderItemsMap.has(item.orderId)) {
          orderItemsMap.set(item.orderId, []);
        }
        orderItemsMap.get(item.orderId).push(item);
      });
    } catch (err) {
      console.warn('批量获取订单商品失败:', err);
    }
    
    // 格式化订单数据
    const orderList = [];
    for (const order of result.data) {
      const storeInfo = storeMap.get(order.storeId) || null;
      
      // 获取订单商品（优先使用订单的items字段，否则使用order_items集合的数据）
      let orderItems = order.items || [];
      
      // 如果订单中没有items字段，使用order_items集合的数据
      if (!orderItems || orderItems.length === 0) {
        const itemsFromCollection = orderItemsMap.get(order._id) || [];
        if (itemsFromCollection.length > 0) {
          orderItems = itemsFromCollection.map(item => ({
            productId: item.productId,
            productName: item.nameSnap || item.name || '未知商品',
            price: item.priceSnap || item.price || 0,
            quantity: item.qty || item.quantity || 1,
            spec: item.attrsSnap ? (typeof item.attrsSnap === 'string' ? item.attrsSnap : JSON.stringify(item.attrsSnap)) : (item.spec || ''),
            image: item.image || ''
          }));
        }
      }
      
      // 格式化订单商品数据
      const formattedItems = orderItems.map((item, index) => {
        // 处理规格信息
        let specText = '';
        if (item.spec) {
          if (typeof item.spec === 'string') {
            try {
              const specObj = JSON.parse(item.spec);
              if (typeof specObj === 'object') {
                specText = Object.values(specObj).join(' ');
              } else {
                specText = item.spec;
              }
            } catch (e) {
              specText = item.spec;
            }
          } else if (typeof item.spec === 'object') {
            specText = Object.values(item.spec).join(' ');
          } else {
            specText = String(item.spec);
          }
        }
        
        // 处理价格（确保从分转换为元）
        let price = item.price || 0;
        if (typeof price === 'number') {
          // 如果价格大于1000，可能是以分为单位存储的
          if (price > 1000) {
            price = price / 100;
          }
          // 如果价格小于1，可能是已经是元为单位
        } else if (typeof price === 'string') {
          price = parseFloat(price) || 0;
          // 如果字符串价格大于1000，可能是以分为单位
          if (price > 1000) {
            price = price / 100;
          }
        }
        
        return {
          id: item.productId || item.id || `item_${index}`,
          name: item.productName || item.name || '未知商品',
          spec: specText,
          price: price.toFixed(2),
          quantity: item.quantity || item.qty || 1,
          image: item.image || ''
        };
      });
      
      // 处理金额（确保从分转换为元）
      let amountGoods = order.amountGoods || 0;
      if (typeof amountGoods === 'number') {
        // 如果金额大于等于100（1元），说明是以分为单位存储的，需要转换
        amountGoods = amountGoods >= 100 ? amountGoods / 100 : amountGoods;
      } else if (typeof amountGoods === 'string') {
        amountGoods = parseFloat(amountGoods) || 0;
        if (amountGoods >= 100) {
          amountGoods = amountGoods / 100;
        }
      }
      
      let amountDelivery = order.amountDelivery || 0;
      if (typeof amountDelivery === 'number') {
        // 如果金额大于等于100（1元），说明是以分为单位存储的，需要转换
        amountDelivery = amountDelivery >= 100 ? amountDelivery / 100 : amountDelivery;
      } else if (typeof amountDelivery === 'string') {
        amountDelivery = parseFloat(amountDelivery) || 0;
        if (amountDelivery >= 100) {
          amountDelivery = amountDelivery / 100;
        }
      }
      
      let platformFee = order.platformFee || 0;
      if (typeof platformFee === 'number') {
        // 如果金额大于等于100（1元），说明是以分为单位存储的，需要转换
        platformFee = platformFee >= 100 ? platformFee / 100 : platformFee;
      } else if (typeof platformFee === 'string') {
        platformFee = parseFloat(platformFee) || 0;
        if (platformFee >= 100) {
          platformFee = platformFee / 100;
        }
      }
      
      let amountPayable = order.amountPayable || order.amountTotal || 0;
      if (typeof amountPayable === 'number') {
        // 如果金额大于等于100（1元），说明是以分为单位存储的，需要转换
        amountPayable = amountPayable >= 100 ? amountPayable / 100 : amountPayable;
      } else if (typeof amountPayable === 'string') {
        amountPayable = parseFloat(amountPayable) || 0;
        if (amountPayable >= 100) {
          amountPayable = amountPayable / 100;
        }
      }
      
      // 如果金额为0，尝试从商品金额和配送费计算
      if (amountPayable === 0 && (amountGoods > 0 || amountDelivery > 0)) {
        amountPayable = amountGoods + amountDelivery;
      }
      
      // 如果没有商品金额，从商品列表计算
      if (amountGoods === 0 && formattedItems.length > 0) {
        amountGoods = formattedItems.reduce((sum, item) => {
          return sum + (parseFloat(item.price) * item.quantity);
        }, 0);
      }
      
      // 格式化订单数据
      // 处理用户头像URL（确保云存储URL格式正确）
      let userAvatarUrl = null;
      let userNickname = '用户';
      
      if (order.orderType === 'gaming' || order.orderType === 'reward' || order.orderType === 'express') {
        const userInfo = order.userInfo || (order.userId ? userMap.get(order.userId) : null);
        if (userInfo) {
          userNickname = userInfo.nickname || '用户';
          userAvatarUrl = userInfo.avatarUrl || userInfo.avatar || '';
          // 处理云存储URL，确保格式正确
          if (userAvatarUrl && userAvatarUrl.startsWith('cloud://')) {
            // 云存储URL，保持原样（小程序会自动处理）
            userAvatarUrl = userAvatarUrl;
          } else if (userAvatarUrl && !userAvatarUrl.startsWith('http') && !userAvatarUrl.startsWith('/')) {
            // 相对路径，可能需要添加前缀
            userAvatarUrl = userAvatarUrl;
          }
        } else {
          console.warn('【获取管理员订单列表】订单', order.orderNo, '未找到用户信息，userId:', order.userId);
        }
      }
      
      // 处理商家收入（platformFee已经在上面处理过了）
      let merchantIncome = order.merchantIncome || 0;
      if (typeof merchantIncome === 'number') {
        if (merchantIncome >= 100) {
          merchantIncome = merchantIncome / 100; // 从分转换为元
        }
      } else if (typeof merchantIncome === 'string') {
        merchantIncome = parseFloat(merchantIncome) || 0;
        if (merchantIncome >= 100) {
          merchantIncome = merchantIncome / 100;
        }
      }
      
      // 如果没有商家收入，计算：商家收入 = 商品金额 - 平台服务费
      if (merchantIncome === 0 && amountGoods > 0) {
        merchantIncome = amountGoods - platformFee;
      }
      
      // 查询退款信息
      let refundInfo = null;
      try {
        const refundsResult = await db.collection('refunds')
          .where({
            orderId: order._id
          })
          .orderBy('createdAt', 'desc')
          .limit(1)
          .get();
        
        if (refundsResult.data && refundsResult.data.length > 0) {
          const refund = refundsResult.data[0];
          refundInfo = {
            refundId: refund._id,
            refundNo: refund.refundNo,
            status: refund.status,
            refundAmount: refund.refundAmount || 0,
            refundStatusText: getRefundStatusText(refund.status),
            createdAt: formatDate(refund.createdAt),
            completedAt: refund.completedAt ? formatDate(refund.completedAt) : null
          };
        }
      } catch (error) {
        console.warn('【获取管理员订单列表】查询退款信息失败:', error);
      }
      
      const formattedOrder = {
        id: order._id,
        orderNo: order.orderNo || order._id,
        createdAt: formatDate(order.createdAt),
        payStatus: order.payStatus || 'unpaid',
        orderStatus: order.orderStatus || 'pending',
        refundStatus: order.refundStatus || null, // 退款状态
        statusText: getStatusText(order.payStatus, order.orderStatus),
        // 判断是否为无店铺订单（游戏陪玩、悬赏、代拿快递）
        isNonStoreOrder: order.orderType === 'gaming' || order.orderType === 'reward' || order.orderType === 'express',
        orderType: order.orderType || 'normal',
        // 店铺信息（有店铺订单）
        storeLogo: storeInfo?.logoUrl || '/pages/小标/商家.png',
        storeName: storeInfo?.name || order.storeName || '未知店铺',
        storeAddress: storeInfo?.address || (order.address && (order.address.address || order.address.addressDetail)) || '未知地址',
        // 用户信息（无店铺订单）- 优先使用订单中保存的，否则从用户表查询
        userInfo: order.userInfo || (order.userId ? userMap.get(order.userId) : null),
        userNickname: userNickname,
        userAvatar: userAvatarUrl,
        // 金额信息
        amountGoods: amountGoods.toFixed(2),
        amountDelivery: amountDelivery.toFixed(2),
        amountPayable: amountPayable.toFixed(2),
        platformFee: platformFee.toFixed(2), // 平台服务费
        merchantIncome: merchantIncome.toFixed(2), // 商家收入
        platformFeeRate: order.platformFeeRate || 0.08, // 平台服务费比例
        // 退款信息
        refundInfo: refundInfo,
        // 商品列表
        items: formattedItems,
        // 支付凭证
        paymentProof: order.paymentProof || '' // 支付凭证的云存储fileID
      };
      
      orderList.push(formattedOrder);
    }
    
    console.log('【获取管理员订单列表】查询结果:', orderList.length, '条');
    
    return {
      code: 0,
      message: 'ok',
      data: {
        list: orderList,
        hasMore: (page * pageSize) < countResult.total,
        total: countResult.total,
        page: page,
        pageSize: pageSize
      }
    };
    
  } catch (error) {
    console.error('【获取管理员订单列表】异常:', error);
    return {
      code: 500,
      message: '获取订单列表失败',
      error: error.message
    };
  }
}

/**
 * 完成订单
 */
async function completeOrder(openid, data) {
  try {
    const { orderId } = data;
    
    console.log('【完成订单】参数:', { orderId });
    
    if (!orderId) {
      return {
        code: 400,
        message: '缺少订单ID'
      };
    }
    
    // 获取订单信息
    const orderDoc = await db.collection('orders').doc(orderId).get();
    if (!orderDoc.data) {
      return {
        code: 404,
        message: '订单不存在'
      };
    }
    
    const order = orderDoc.data;
    
    // 更新订单状态为已完成，并记录完成时间
    await db.collection('orders').doc(orderId).update({
      data: {
        orderStatus: 'completed',
        completedAt: db.serverDate(), // 记录订单完成时间
        updatedAt: db.serverDate()
      }
    });
    
    // 更新销售统计
    if (order.storeId) {
      await updateSalesStatistics(order);
    }
    
    console.log('【完成订单】完成成功');
    
    return {
      code: 0,
      message: '订单已完成'
    };
    
  } catch (error) {
    console.error('【完成订单】异常:', error);
    return {
      code: 500,
      message: '完成订单失败',
      error: error.message
    };
  }
}

/**
 * 获取状态文本
 */
function getStatusText(payStatus, orderStatus) {
  if (payStatus === 'unpaid') {
    return '待支付';
  } else if (payStatus === 'paid') {
    if (orderStatus === 'completed') {
      return '已完成';
    } else if (orderStatus === 'cancelled') {
      return '已取消';
    } else {
      return '已支付';
    }
  } else if (orderStatus === 'cancelled') {
  } else if (orderStatus === 'completed') {
    return '已完成';
  }
  return '进行中';
}

/**
 * 创建代拿快递订单
 */
async function createExpressOrder(openid, data) {
  try {
    const { pickupLocation, deliveryLocation, packageSizes, images, pickupCode, address, totalPrice } = data;
    
    console.log('【创建代拿快递订单】接收到的参数:', data);
    
    // 参数验证
    if (!pickupLocation) {
      return {
        code: 400,
        message: '缺少取件位置'
      };
    }
    
    if (!deliveryLocation) {
      return {
        code: 400,
        message: '缺少送达位置'
      };
    }
    
    if (!packageSizes || packageSizes.length === 0) {
      return {
        code: 400,
        message: '请选择包裹类型'
      };
    }
    
    if (!pickupCode || !pickupCode.trim()) {
      return {
        code: 400,
        message: '请输入取件码'
      };
    }
    
    if (!address) {
      return {
        code: 400,
        message: '请选择收货地址'
      };
    }
    
    // 1. 查询用户信息
    const user = await db.collection('users')
      .where({ openid })
      .get();
    
    if (!user.data || user.data.length === 0) {
      return {
        code: 404,
        message: '用户不存在'
      };
    }
    
    const userInfo = user.data[0];
    
    // 2. 生成订单号
    const orderNo = `EXP${Date.now()}${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
    
    // 3. 计算订单金额（单位：分）
    const totalAmountFen = Math.round(totalPrice * 100);
    
    // 4. 创建订单数据
    const orderData = {
      orderNo: orderNo,
      orderType: 'express', // 订单类型：代拿快递
      userId: userInfo._id,
      userOpenid: openid,
      
      // 代拿快递特有信息
      pickupLocation: pickupLocation, // 取件位置
      deliveryLocation: deliveryLocation, // 送达位置
      pickupCode: pickupCode.trim(), // 取件码
      images: images || [], // 图片（云存储fileID数组）
      
      // 包裹信息
      packageSizes: packageSizes.map(pkg => ({
        id: pkg.id,
        name: pkg.name,
        description: pkg.description,
        price: Math.round(pkg.price * 100), // 价格（分）
        quantity: pkg.quantity
      })),
      
      // 金额信息（统一以分存储）
      amountGoods: totalAmountFen, // 商品金额（分）
      amountDelivery: 0, // 配送费（分，代拿快递无配送费）
      platformFee: 0, // 平台服务费（分）
      amountDiscount: 0, // 优惠金额（分）
      amountTotal: totalAmountFen, // 总金额（分）
      amountPayable: totalAmountFen, // 应付金额（分）
      
      // 配送信息 - 完整保存地址信息
      address: address ? {
        name: address.name || userInfo.nickname || '用户',
        phone: address.phone || userInfo.phone || '',
        address: address.addressDetail || '未设置地址',
        addressDetail: address.addressDetail || '',
        buildingName: address.buildingName || '',
        houseNumber: address.houseNumber || ''
      } : {
        name: userInfo.nickname || '用户',
        phone: userInfo.phone || '',
        address: '未设置地址',
        addressDetail: '未设置地址',
        buildingName: '',
        houseNumber: ''
      },
      
      // 订单状态
      orderStatus: 'pending', // pending-待确认, confirmed-已确认, preparing-准备中, delivering-配送中, completed-已完成, cancelled-已取消
      payStatus: 'paid', // 模拟已支付
      
      // 用户信息（用于无店铺订单显示）
      userInfo: {
        nickname: userInfo.nickname || '用户',
        avatarUrl: userInfo.avatarUrl || userInfo.avatar || '',
        phone: userInfo.phone || ''
      },
      
      // 时间戳
      createdAt: db.serverDate(),
      updatedAt: db.serverDate()
    };
    
    console.log('【创建代拿快递订单】订单数据:', orderData);
    
    // 5. 保存订单到数据库
    const result = await db.collection('orders').add({
      data: orderData
    });
    
    console.log('【创建代拿快递订单】订单创建成功，ID:', result._id);
    
    return {
      code: 200,
      message: '订单创建成功',
      data: {
        orderId: result._id,
        orderNo: orderNo,
        amountTotal: totalPrice
      }
    };
    
  } catch (error) {
    console.error('【创建代拿快递订单】异常:', error);
    return {
      code: 500,
      message: '创建订单失败',
      error: error.message
    };
  }
}

/**
 * 创建游戏陪玩订单
 */
async function createGamingOrder(openid, data) {
  try {
    const { gameType, sessionDuration, requirements, selectedRequirements, bounty, pricePerHour, address, totalPrice } = data;
    
    console.log('【创建游戏陪玩订单】接收到的参数:', data);
    
    // 参数验证
    if (!gameType) {
      return {
        code: 400,
        message: '请选择游戏类型'
      };
    }
    
    if (!sessionDuration || sessionDuration < 1) {
      return {
        code: 400,
        message: '开黑时间至少1小时'
      };
    }
    
    if (!requirements.trim() && (!selectedRequirements || selectedRequirements.length === 0)) {
      return {
        code: 400,
        message: '请输入开黑要求或选择标签'
      };
    }
    
    if (!address) {
      return {
        code: 400,
        message: '请选择收货地址'
      };
    }
    
    // 1. 查询用户信息
    const user = await db.collection('users')
      .where({ openid })
      .get();
    
    if (!user.data || user.data.length === 0) {
      return {
        code: 404,
        message: '用户不存在'
      };
    }
    
    const userInfo = user.data[0];
    
    // 2. 生成订单号
    const orderNo = `GAM${Date.now()}${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
    
    // 3. 计算订单金额（单位：分）- 已取消基础费用，只计算赏金
    const totalAmountFen = Math.round(totalPrice * 100);
    const bountyFen = Math.round((bounty || 0) * 100);
    
    // 4. 创建订单数据
    const orderData = {
      orderNo: orderNo,
      orderType: 'gaming', // 订单类型：游戏陪玩
      userId: userInfo._id,
      userOpenid: openid,
      
      // 游戏陪玩特有信息
      gameType: gameType, // 游戏类型
      sessionDuration: sessionDuration, // 开黑时长（小时）
      requirements: requirements.trim(), // 开黑要求文本
      selectedRequirements: selectedRequirements || [], // 选中的要求标签
      bounty: bountyFen, // 赏金（分）
      pricePerHour: Math.round((pricePerHour || 0) * 100), // 每小时价格（分，已取消基础费用，保留字段）
      
      // 金额信息（统一以分存储）- 已取消基础费用
      amountGoods: bountyFen, // 商品金额（分）= 赏金
      amountDelivery: 0, // 配送费（分，游戏陪玩无配送费）
      platformFee: 0, // 平台服务费（分）
      amountDiscount: 0, // 优惠金额（分）
      amountTotal: totalAmountFen, // 总金额（分）
      amountPayable: totalAmountFen, // 应付金额（分）
      
      // 配送信息 - 完整保存地址信息
      address: address ? {
        name: address.name || userInfo.nickname || '用户',
        phone: address.phone || userInfo.phone || '',
        address: address.addressDetail || '未设置地址',
        addressDetail: address.addressDetail || '',
        buildingName: address.buildingName || '',
        houseNumber: address.houseNumber || ''
      } : {
        name: userInfo.nickname || '用户',
        phone: userInfo.phone || '',
        address: '未设置地址',
        addressDetail: '未设置地址',
        buildingName: '',
        houseNumber: ''
      },
      
      // 订单状态
      orderStatus: 'pending', // pending-待确认, confirmed-已确认, preparing-准备中, delivering-配送中, completed-已完成, cancelled-已取消
      payStatus: 'paid', // 模拟已支付
      
      // 用户信息（用于无店铺订单显示）
      userInfo: {
        nickname: userInfo.nickname || '用户',
        avatarUrl: userInfo.avatarUrl || userInfo.avatar || '',
        phone: userInfo.phone || ''
      },
      
      // 时间戳
      createdAt: db.serverDate(),
      updatedAt: db.serverDate()
    };
    
    console.log('【创建游戏陪玩订单】订单数据:', orderData);
    
    // 5. 保存订单到数据库
    const result = await db.collection('orders').add({
      data: orderData
    });
    
    console.log('【创建游戏陪玩订单】订单创建成功，ID:', result._id);
    
    return {
      code: 200,
      message: '订单创建成功',
      data: {
        orderId: result._id,
        orderNo: orderNo,
        amountTotal: totalPrice
      }
    };
    
  } catch (error) {
    console.error('【创建游戏陪玩订单】异常:', error);
    return {
      code: 500,
      message: '创建订单失败',
      error: error.message
    };
  }
}

/**
 * 创建悬赏订单
 */
async function createRewardOrder(openid, data) {
  try {
    const { helpLocation, helpContent, category, images, remarks, bounty, address, totalPrice } = data;
    
    console.log('【创建悬赏订单】接收到的参数:', data);
    
    // 参数验证
    if (!helpLocation) {
      return {
        code: 400,
        message: '请选择帮助地点'
      };
    }
    
    if (!helpContent || !helpContent.trim()) {
      return {
        code: 400,
        message: '请输入帮助内容'
      };
    }
    
    if (!category) {
      return {
        code: 400,
        message: '请选择帮助类别'
      };
    }
    
    if (!address) {
      return {
        code: 400,
        message: '请选择收货地址'
      };
    }
    
    // 1. 查询用户信息
    const user = await db.collection('users')
      .where({ openid })
      .get();
    
    if (!user.data || user.data.length === 0) {
      return {
        code: 404,
        message: '用户不存在'
      };
    }
    
    const userInfo = user.data[0];
    
    // 2. 生成订单号
    const orderNo = `REW${Date.now()}${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
    
    // 3. 计算订单金额（单位：分）
    const totalAmountFen = Math.round(totalPrice * 100);
    const bountyFen = Math.round((bounty || 0) * 100);
    
    // 4. 创建订单数据
    const orderData = {
      orderNo: orderNo,
      orderType: 'reward', // 订单类型：悬赏
      userId: userInfo._id,
      userOpenid: openid,
      
      // 悬赏订单特有信息
      helpLocation: helpLocation, // 帮助地点
      helpContent: helpContent.trim(), // 帮助内容
      category: category, // 帮助类别
      images: images || [], // 图片（云存储fileID数组）
      remarks: remarks.trim() || '', // 备注
      bounty: bountyFen, // 赏金（分）
      
      // 金额信息（统一以分存储）
      amountGoods: bountyFen, // 商品金额（分）= 赏金
      amountDelivery: 0, // 配送费（分，悬赏无配送费）
      platformFee: 0, // 平台服务费（分）
      amountDiscount: 0, // 优惠金额（分）
      amountTotal: totalAmountFen, // 总金额（分）
      amountPayable: totalAmountFen, // 应付金额（分）
      
      // 配送信息 - 完整保存地址信息
      address: address ? {
        name: address.name || userInfo.nickname || '用户',
        phone: address.phone || userInfo.phone || '',
        address: address.addressDetail || '未设置地址',
        addressDetail: address.addressDetail || '',
        buildingName: address.buildingName || '',
        houseNumber: address.houseNumber || ''
      } : {
        name: userInfo.nickname || '用户',
        phone: userInfo.phone || '',
        address: '未设置地址',
        addressDetail: '未设置地址',
        buildingName: '',
        houseNumber: ''
      },
      
      // 订单状态
      orderStatus: 'pending', // pending-待确认, confirmed-已确认, preparing-准备中, delivering-配送中, completed-已完成, cancelled-已取消
      payStatus: 'paid', // 模拟已支付
      
      // 用户信息（用于无店铺订单显示）
      userInfo: {
        nickname: userInfo.nickname || '用户',
        avatarUrl: userInfo.avatarUrl || userInfo.avatar || '',
        phone: userInfo.phone || ''
      },
      
      // 时间戳
      createdAt: db.serverDate(),
      updatedAt: db.serverDate()
    };
    
    console.log('【创建悬赏订单】订单数据:', orderData);
    
    // 5. 保存订单到数据库
    const result = await db.collection('orders').add({
      data: orderData
    });
    
    console.log('【创建悬赏订单】订单创建成功，ID:', result._id);
    
    return {
      code: 200,
      message: '订单创建成功',
      data: {
        orderId: result._id,
        orderNo: orderNo,
        amountTotal: totalPrice
      }
    };
    
  } catch (error) {
    console.error('【创建悬赏订单】异常:', error);
    return {
      code: 500,
      message: '创建订单失败',
      error: error.message
    };
  }
}

/**
 * 获取接单订单列表（个人对接个人订单：游戏陪玩、悬赏、代拿快递）
 */
async function getReceiveOrders(openid, data) {
  try {
    const { status, page = 1, pageSize = 50 } = data;
    
    console.log('【获取接单订单列表】参数:', { status, page, pageSize });
    
    // 构建查询条件：只查询游戏陪玩、悬赏、代拿快递订单
    const whereCondition = {
      orderType: db.command.in(['gaming', 'reward', 'express'])
    };
    
    // 根据状态筛选（如果不传status，则查询所有状态的订单，但排除已取消的）
    if (status) {
      whereCondition.orderStatus = status;
    } else {
      // 如果没有指定状态，查询所有状态的订单，但排除已取消的
      whereCondition.orderStatus = db.command.neq('cancelled');
    }
    
    // 查询订单
    const result = await db.collection('orders')
      .where(whereCondition)
      .orderBy('createdAt', 'desc')
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .get();
    
    // 获取总数
    const countResult = await db.collection('orders')
      .where(whereCondition)
      .count();
    
    // 格式化订单数据
    const formattedList = result.data.map(order => {
      // 处理金额（从分转换为元）
      let amountGoods = order.amountGoods || 0;
      if (typeof amountGoods === 'number') {
        amountGoods = amountGoods >= 100 ? amountGoods / 100 : amountGoods;
      }
      
      let amountDelivery = order.amountDelivery || 0;
      if (typeof amountDelivery === 'number') {
        amountDelivery = amountDelivery >= 100 ? amountDelivery / 100 : amountDelivery;
      }
      
      let platformFee = order.platformFee || 0;
      if (typeof platformFee === 'number') {
        platformFee = platformFee >= 100 ? platformFee / 100 : platformFee;
      }
      
      let amountTotal = order.amountTotal || order.amountPayable || 0;
      if (typeof amountTotal === 'number') {
        amountTotal = amountTotal >= 100 ? amountTotal / 100 : amountTotal;
      }
      
      // 计算订单超时倒计时（使用真实时间）
      const expiredMinutes = calculateExpiredMinutes(order.expiredAt, order.createdAt, order.completedAt);
      
      // 处理订单商品/服务信息
      let items = [];
      if (order.orderType === 'express') {
        // 代拿快递订单，使用 packageSizes
        if (order.packageSizes && Array.isArray(order.packageSizes)) {
          items = order.packageSizes.map(pkg => ({
            productId: pkg.id || '',
            productName: `${pkg.name}${pkg.description ? '(' + pkg.description + ')' : ''}`,
            price: (pkg.price >= 100 ? pkg.price / 100 : pkg.price).toFixed(2),
            quantity: pkg.quantity || 1,
            spec: '',
            image: ''
          }));
        }
      } else if (order.orderType === 'gaming') {
        // 游戏陪玩订单
        const requirements = order.selectedRequirements && order.selectedRequirements.length > 0 
          ? order.selectedRequirements.join('、') 
          : (order.requirements || '');
        items = [{
          productId: 'gaming',
          productName: `${order.gameType || '游戏陪玩'} - ${order.sessionDuration || 1}小时`,
          price: (order.bounty >= 100 ? order.bounty / 100 : order.bounty).toFixed(2),
          quantity: 1,
          spec: requirements ? `要求：${requirements}` : '',
          image: ''
        }];
      } else if (order.orderType === 'reward') {
        // 悬赏订单
        items = [{
          productId: 'reward',
          productName: order.category || '悬赏任务',
          price: (order.bounty >= 100 ? order.bounty / 100 : order.bounty).toFixed(2),
          quantity: 1,
          spec: order.helpContent ? `内容：${order.helpContent}` : '',
          image: order.images && order.images.length > 0 ? order.images[0] : ''
        }];
      }
      
      return {
        ...order,
        amountGoods: amountGoods.toFixed(2),
        amountDelivery: amountDelivery.toFixed(2),
        platformFee: platformFee.toFixed(2),
        amountTotal: amountTotal.toFixed(2),
        amountPayable: amountTotal.toFixed(2),
        expiredAt: order.expiredAt ? formatDate(order.expiredAt) : null,
        expiredMinutes: expiredMinutes,
        readyAt: order.readyAt ? formatDate(order.readyAt) : null,
        createdAt: formatDate(order.createdAt),
        items: items
      };
    });
    
    console.log('【获取接单订单列表】查询结果:', formattedList.length, '条');
    
    return {
      code: 200,
      message: 'ok',
      data: {
        list: formattedList,
        total: countResult.total,
        page: page,
        pageSize: pageSize
      }
    };
    
  } catch (error) {
    console.error('【获取接单订单列表】异常:', error);
    return {
      code: 500,
      message: '获取接单订单列表失败',
      error: error.message
    };
  }
}

/**
 * 获取可抢订单列表（待抢单）
 * 查询状态为 ready 或 confirmed 且未分配骑手的订单
 */
async function getAvailableOrders(openid, data) {
  try {
    const { page = 1, pageSize = 20 } = data || {};
    
    console.log('【获取可抢订单列表】参数:', { page, pageSize });
    
    // 查询条件：状态为 ready 或 confirmed，且未分配骑手（riderOpenid 不存在或为空）
    // 只查询普通外卖订单（排除 gaming、reward、express）
    // 只查询已支付的订单（payStatus === 'paid'）
    // 注意：普通外卖订单可能没有 orderType 字段，所以使用 or 条件来处理
    // 同时处理 orderType 不存在、null 或者不在排除列表中的情况
    const whereCondition = db.command.or([
      {
        orderStatus: db.command.in(['ready', 'confirmed']),
        riderOpenid: db.command.exists(false),
        payStatus: 'paid', // 只返回已支付的订单
        orderType: db.command.exists(false) // orderType 不存在（普通外卖订单）
      },
      {
        orderStatus: db.command.in(['ready', 'confirmed']),
        riderOpenid: db.command.exists(false),
        payStatus: 'paid', // 只返回已支付的订单
        orderType: null // orderType 为 null（普通外卖订单）
      },
      {
        orderStatus: db.command.in(['ready', 'confirmed']),
        riderOpenid: db.command.exists(false),
        payStatus: 'paid', // 只返回已支付的订单
        orderType: db.command.nin(['gaming', 'reward', 'express']) // orderType 存在但不等于这些值
      }
    ]);
    
    console.log('【获取可抢订单列表】查询条件:', JSON.stringify(whereCondition));
    
    // 查询订单
    const result = await db.collection('orders')
      .where(whereCondition)
      .orderBy('createdAt', 'desc')
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .get();
    
    console.log('【获取可抢订单列表】查询到订单数量:', result.data.length);
    
    // 获取总数
    const countResult = await db.collection('orders')
      .where(whereCondition)
      .count();
    
    console.log('【获取可抢订单列表】订单总数:', countResult.total);
    
    // 过滤已删除店铺的订单
    const validOrders = [];
    const storeIds = [...new Set(result.data.map(order => order.storeId).filter(id => id))];
    
    // 批量查询店铺信息
    const storeMap = new Map();
    if (storeIds.length > 0) {
      try {
        const storePromises = storeIds.map(storeId => 
          db.collection('stores').doc(storeId).get().catch(() => null)
        );
        const storeResults = await Promise.all(storePromises);
        
        storeResults.forEach((storeResult, index) => {
          if (storeResult && storeResult.data) {
            storeMap.set(storeIds[index], storeResult.data);
          }
        });
      } catch (err) {
        console.warn('【获取可抢订单列表】批量查询店铺信息失败:', err);
      }
    }
    
    // 只保留店铺存在的订单
    for (const order of result.data) {
      if (!order.storeId) {
        // 没有店铺ID的订单跳过（理论上不应该出现）
        continue;
      }
      
      if (storeMap.has(order.storeId)) {
        // 店铺存在，添加到有效订单列表
        validOrders.push(order);
      } else {
        // 店铺不存在，跳过此订单
        console.log(`【获取可抢订单列表】订单 ${order._id} 的店铺 ${order.storeId} 不存在，已过滤`);
      }
    }
    
    // 格式化订单数据
    const formattedList = validOrders.map(order => formatRiderOrder(order));
    
    console.log('【获取可抢订单列表】查询结果:', result.data.length, '条，有效订单:', formattedList.length, '条');
    
    return {
      code: 200,
      message: 'ok',
      data: {
        list: formattedList,
        total: formattedList.length, // 返回实际有效订单数
        page: page,
        pageSize: pageSize
      }
    };
    
  } catch (error) {
    console.error('【获取可抢订单列表】异常:', error);
    return {
      code: 500,
      message: '获取可抢订单列表失败',
      error: error.message
    };
  }
}

/**
 * 骑手接单
 */
async function grabOrder(openid, data) {
  try {
    const { orderId } = data;
    
    console.log('【骑手接单】参数:', { orderId, riderOpenid: openid });
    
    if (!orderId) {
      return {
        code: 400,
        message: '缺少订单ID'
      };
    }
    
    // 检查骑手审核状态
    let riderStatus = 'not_registered';
    try {
      const riderQuery = await db.collection('riders')
        .where({ openid: openid })
        .get();
      
      if (riderQuery.data && riderQuery.data.length > 0) {
        riderStatus = riderQuery.data[0].status || 'pending';
      }
    } catch (error) {
      // 如果集合不存在，说明未注册
      if (error.errCode === -502005 || error.message.includes('collection not exist')) {
        riderStatus = 'not_registered';
      } else {
        console.error('【骑手接单】查询骑手状态失败:', error);
      }
    }
    
    // 只有审核通过的骑手才能接单
    if (riderStatus !== 'approved') {
      let message = '';
      if (riderStatus === 'not_registered') {
        message = '您还未注册骑手，请先注册';
      } else if (riderStatus === 'pending') {
        message = '您的申请正在审核中，审核通过后才能接单';
      } else if (riderStatus === 'rejected') {
        message = '您的申请未通过审核，请联系管理员';
      } else {
        message = '您暂无接单权限';
      }
      
      return {
        code: 403,
        message: message
      };
    }
    
    // 获取订单信息
    const orderResult = await db.collection('orders').doc(orderId).get();
    if (!orderResult.data) {
      return {
        code: 404,
        message: '订单不存在'
      };
    }
    
    const order = orderResult.data;
    
    // 检查订单状态
    if (order.orderStatus !== 'ready' && order.orderStatus !== 'confirmed') {
      return {
        code: 400,
        message: '订单状态不允许接单'
      };
    }
    
    // 检查是否已被其他骑手接单
    if (order.riderOpenid && order.riderOpenid !== openid) {
      return {
        code: 400,
        message: '订单已被其他骑手接单'
      };
    }
    
    // 更新订单：分配骑手
    await db.collection('orders').doc(orderId).update({
      data: {
        riderOpenid: openid,
        updatedAt: db.serverDate()
      }
    });
    
    console.log('【骑手接单】接单成功');
    
    return {
      code: 200,
      message: '接单成功'
    };
    
  } catch (error) {
    console.error('【骑手接单】异常:', error);
    return {
      code: 500,
      message: '接单失败',
      error: error.message
    };
  }
}

/**
 * 获取待取货订单列表
 * 查询当前骑手已接单但未取餐的订单
 */
async function getPickupOrders(openid, data) {
  try {
    const { page = 1, pageSize = 20 } = data || {};
    
    console.log('【获取待取货订单列表】参数:', { page, pageSize, riderOpenid: openid });
    
    // 查询条件：当前骑手已接单，状态为 confirmed 或 ready，且未取餐（状态不是 delivering）
    // 注意：普通外卖订单可能没有 orderType 字段，所以使用 or 条件来处理
    const whereCondition = db.command.or([
      {
        riderOpenid: openid,
        orderStatus: db.command.in(['confirmed', 'ready']),
        orderType: db.command.exists(false) // orderType 不存在（普通外卖订单）
      },
      {
        riderOpenid: openid,
        orderStatus: db.command.in(['confirmed', 'ready']),
        orderType: db.command.nin(['gaming', 'reward', 'express']) // orderType 存在但不等于这些值
      }
    ]);
    
    // 查询订单
    const result = await db.collection('orders')
      .where(whereCondition)
      .orderBy('createdAt', 'desc')
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .get();
    
    // 获取总数
    const countResult = await db.collection('orders')
      .where(whereCondition)
      .count();
    
    // 过滤已删除店铺的订单
    const validOrders = [];
    const storeIds = [...new Set(result.data.map(order => order.storeId).filter(id => id))];
    
    // 批量查询店铺信息
    const storeMap = new Map();
    if (storeIds.length > 0) {
      try {
        const storePromises = storeIds.map(storeId => 
          db.collection('stores').doc(storeId).get().catch(() => null)
        );
        const storeResults = await Promise.all(storePromises);
        
        storeResults.forEach((storeResult, index) => {
          if (storeResult && storeResult.data) {
            storeMap.set(storeIds[index], storeResult.data);
          }
        });
      } catch (err) {
        console.warn('【获取待取货订单列表】批量查询店铺信息失败:', err);
      }
    }
    
    // 只保留店铺存在的订单
    for (const order of result.data) {
      if (!order.storeId) {
        // 没有店铺ID的订单跳过（理论上不应该出现）
        continue;
      }
      
      if (storeMap.has(order.storeId)) {
        // 店铺存在，添加到有效订单列表
        validOrders.push(order);
      } else {
        // 店铺不存在，跳过此订单
        console.log(`【获取待取货订单列表】订单 ${order._id} 的店铺 ${order.storeId} 不存在，已过滤`);
      }
    }
    
    // 格式化订单数据
    const formattedList = validOrders.map(order => formatRiderOrder(order));
    
    console.log('【获取待取货订单列表】查询结果:', result.data.length, '条，有效订单:', formattedList.length, '条');
    
    return {
      code: 200,
      message: 'ok',
      data: {
        list: formattedList,
        total: formattedList.length, // 返回实际有效订单数
        page: page,
        pageSize: pageSize
      }
    };
    
  } catch (error) {
    console.error('【获取待取货订单列表】异常:', error);
    return {
      code: 500,
      message: '获取待取货订单列表失败',
      error: error.message
    };
  }
}

/**
 * 骑手确认商家出餐（带2分钟同步校验）
 */
async function confirmMerchantReady(openid, data) {
  try {
    const { orderId } = data;
    
    console.log('【骑手确认商家出餐】参数:', { orderId, riderOpenid: openid });
    
    if (!orderId) {
      return {
        code: 400,
        message: '缺少订单ID'
      };
    }
    
    // 获取订单信息
    const orderResult = await db.collection('orders').doc(orderId).get();
    if (!orderResult.data) {
      return {
        code: 404,
        message: '订单不存在'
      };
    }
    
    const order = orderResult.data;
    
    // 检查是否为当前骑手的订单
    if (order.riderOpenid !== openid) {
      return {
        code: 403,
        message: '无权操作此订单'
      };
    }
    
    // 检查订单状态
    if (order.orderStatus !== 'confirmed' && order.orderStatus !== 'ready') {
      return {
        code: 400,
        message: '订单状态不允许此操作'
      };
    }
    
    // 2分钟同步校验逻辑
    const now = new Date();
    const readyAt = order.readyAt ? new Date(order.readyAt) : null;
    
    if (readyAt) {
      const timeDiff = Math.abs(now - readyAt) / 1000 / 60; // 分钟差
      if (timeDiff > 2) {
        return {
          code: 400,
          message: '商家出餐时间已超过2分钟，请重新确认'
        };
      }
    }
    
    // 更新订单：记录骑手确认商家出餐时间
    await db.collection('orders').doc(orderId).update({
      data: {
        riderConfirmedReadyAt: db.serverDate(),
        updatedAt: db.serverDate()
      }
    });
    
    // 如果订单状态是 confirmed，更新为 ready
    if (order.orderStatus === 'confirmed') {
      await db.collection('orders').doc(orderId).update({
        data: {
          orderStatus: 'ready',
          readyAt: readyAt || db.serverDate(),
          updatedAt: db.serverDate()
        }
      });
    }
    
    console.log('【骑手确认商家出餐】确认成功');
    
    return {
      code: 200,
      message: '确认成功'
    };
    
  } catch (error) {
    console.error('【骑手确认商家出餐】异常:', error);
    return {
      code: 500,
      message: '确认失败',
      error: error.message
    };
  }
}

/**
 * 确认取餐
 */
async function confirmPickup(openid, data) {
  try {
    const { orderId } = data;
    
    console.log('【确认取餐】参数:', { orderId, riderOpenid: openid });
    
    if (!orderId) {
      return {
        code: 400,
        message: '缺少订单ID'
      };
    }
    
    // 获取订单信息
    const orderResult = await db.collection('orders').doc(orderId).get();
    if (!orderResult.data) {
      return {
        code: 404,
        message: '订单不存在'
      };
    }
    
    const order = orderResult.data;
    
    // 检查是否为当前骑手的订单
    if (order.riderOpenid !== openid) {
      return {
        code: 403,
        message: '无权操作此订单'
      };
    }
    
    // 检查订单状态
    if (order.orderStatus !== 'ready' && order.orderStatus !== 'confirmed') {
      return {
        code: 400,
        message: '订单状态不允许取餐'
      };
    }
    
    // 更新订单状态为 delivering（配送中）
    await db.collection('orders').doc(orderId).update({
      data: {
        orderStatus: 'delivering',
        riderArrivedAt: db.serverDate(), // 记录到达商家时间（如果还没有）
        updatedAt: db.serverDate()
      }
    });
    
    console.log('【确认取餐】取餐成功');
    
    return {
      code: 200,
      message: '取餐成功'
    };
    
  } catch (error) {
    console.error('【确认取餐】异常:', error);
    return {
      code: 500,
      message: '取餐失败',
      error: error.message
    };
  }
}

/**
 * 获取待送达订单列表
 * 查询当前骑手正在配送的订单
 */
async function getDeliverOrders(openid, data) {
  try {
    const { page = 1, pageSize = 20 } = data || {};
    
    console.log('【获取待送达订单列表】参数:', { page, pageSize, riderOpenid: openid });
    
    // 查询条件：当前骑手已接单，状态为 delivering
    // 注意：普通外卖订单可能没有 orderType 字段，所以使用 or 条件来处理
    const whereCondition = db.command.or([
      {
        riderOpenid: openid,
        orderStatus: 'delivering',
        orderType: db.command.exists(false) // orderType 不存在（普通外卖订单）
      },
      {
        riderOpenid: openid,
        orderStatus: 'delivering',
        orderType: db.command.nin(['gaming', 'reward', 'express']) // orderType 存在但不等于这些值
      }
    ]);
    
    // 查询订单
    const result = await db.collection('orders')
      .where(whereCondition)
      .orderBy('createdAt', 'desc')
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .get();
    
    // 获取总数
    const countResult = await db.collection('orders')
      .where(whereCondition)
      .count();
    
    // 过滤已删除店铺的订单
    const validOrders = [];
    const storeIds = [...new Set(result.data.map(order => order.storeId).filter(id => id))];
    
    // 批量查询店铺信息
    const storeMap = new Map();
    if (storeIds.length > 0) {
      try {
        const storePromises = storeIds.map(storeId => 
          db.collection('stores').doc(storeId).get().catch(() => null)
        );
        const storeResults = await Promise.all(storePromises);
        
        storeResults.forEach((storeResult, index) => {
          if (storeResult && storeResult.data) {
            storeMap.set(storeIds[index], storeResult.data);
          }
        });
      } catch (err) {
        console.warn('【获取待送达订单列表】批量查询店铺信息失败:', err);
      }
    }
    
    // 只保留店铺存在的订单
    for (const order of result.data) {
      if (!order.storeId) {
        // 没有店铺ID的订单跳过（理论上不应该出现）
        continue;
      }
      
      if (storeMap.has(order.storeId)) {
        // 店铺存在，添加到有效订单列表
        validOrders.push(order);
      } else {
        // 店铺不存在，跳过此订单
        console.log(`【获取待送达订单列表】订单 ${order._id} 的店铺 ${order.storeId} 不存在，已过滤`);
      }
    }
    
    // 格式化订单数据
    const formattedList = validOrders.map(order => formatRiderOrder(order));
    
    console.log('【获取待送达订单列表】查询结果:', result.data.length, '条，有效订单:', formattedList.length, '条');
    
    return {
      code: 200,
      message: 'ok',
      data: {
        list: formattedList,
        total: formattedList.length, // 返回实际有效订单数
        page: page,
        pageSize: pageSize
      }
    };
    
  } catch (error) {
    console.error('【获取待送达订单列表】异常:', error);
    return {
      code: 500,
      message: '获取待送达订单列表失败',
      error: error.message
    };
  }
}

/**
 * 确认送达
 */
async function confirmDelivery(openid, data) {
  try {
    const { orderId } = data;
    
    console.log('【确认送达】参数:', { orderId, riderOpenid: openid });
    
    if (!orderId) {
      return {
        code: 400,
        message: '缺少订单ID'
      };
    }
    
    // 获取订单信息
    const orderResult = await db.collection('orders').doc(orderId).get();
    if (!orderResult.data) {
      return {
        code: 404,
        message: '订单不存在'
      };
    }
    
    const order = orderResult.data;
    
    // 检查是否为当前骑手的订单
    if (order.riderOpenid !== openid) {
      return {
        code: 403,
        message: '无权操作此订单'
      };
    }
    
    // 检查订单状态
    if (order.orderStatus !== 'delivering') {
      return {
        code: 400,
        message: '订单状态不允许送达'
      };
    }
    
    // 更新订单状态为 completed（已完成）
    await db.collection('orders').doc(orderId).update({
      data: {
        orderStatus: 'completed',
        completedAt: db.serverDate(),
        updatedAt: db.serverDate()
      }
    });
    
    // 更新销售统计
    await updateSalesStatistics(order);
    
    // 更新骑手的今日订单数和今日收入统计
    await updateRiderTodayStats(openid);
    
    console.log('【确认送达】送达成功');
    
    return {
      code: 200,
      message: '送达成功'
    };
    
  } catch (error) {
    console.error('【确认送达】异常:', error);
    return {
      code: 500,
      message: '送达失败',
      error: error.message
    };
  }
}

/**
 * 更新骑手今日统计数据
 * 每完成一个订单，今日接单数+1，今日收入+2元
 */
async function updateRiderTodayStats(riderOpenid) {
  try {
    if (!riderOpenid) {
      console.warn('【更新骑手统计】缺少骑手openid');
      return;
    }
    
    console.log('【更新骑手统计】开始更新，骑手openid:', riderOpenid);
    
    // 获取今天的日期（格式：YYYY-MM-DD）
    // 云函数运行在UTC时区，需要转换为中国时区（UTC+8）
    const now = new Date();
    const chinaTimeOffset = 8 * 60 * 60 * 1000; // 8小时的毫秒数
    const chinaTime = new Date(now.getTime() + chinaTimeOffset);
    const year = chinaTime.getUTCFullYear();
    const month = String(chinaTime.getUTCMonth() + 1).padStart(2, '0');
    const day = String(chinaTime.getUTCDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;
    
    console.log('【更新骑手统计】日期字符串:', dateStr, '骑手openid:', riderOpenid);
    
    // 查询今日统计数据
    let statsResult;
    try {
      statsResult = await db.collection('rider_stats')
      .where({
        riderOpenid: riderOpenid,
        date: dateStr
      })
      .get();
    } catch (queryError) {
      // 如果集合不存在（错误码 -502005），直接创建新记录
      if (queryError.errCode === -502005 || queryError.message.includes('collection not exist') || queryError.message.includes('not exist')) {
        console.log('【更新骑手统计】集合不存在，创建新记录');
        statsResult = { data: [] }; // 设置为空数组，走创建流程
      } else {
        throw queryError;
      }
    }
    
    console.log('【更新骑手统计】查询结果:', statsResult.data);
    
    if (statsResult.data && statsResult.data.length > 0) {
      // 如果今日统计已存在，更新数据
      const stats = statsResult.data[0];
      try {
      const updateResult = await db.collection('rider_stats').doc(stats._id).update({
        data: {
          todayOrders: db.command.inc(1), // 今日接单数+1
          todayIncome: db.command.inc(2.00), // 今日收入+2元
          updatedAt: db.serverDate()
        }
      });
      console.log('【更新骑手统计】更新成功，订单数+1，收入+2元，更新结果:', updateResult);
      } catch (updateError) {
        console.error('【更新骑手统计】更新失败:', updateError);
        // 如果更新失败，尝试重新创建记录
        console.log('【更新骑手统计】尝试重新创建记录');
        try {
          const addResult = await db.collection('rider_stats').add({
            data: {
              riderOpenid: riderOpenid,
              date: dateStr,
              todayOrders: (stats.todayOrders || 0) + 1, // 今日接单数+1
              todayIncome: ((stats.todayIncome || 0) + 2.00).toFixed(2), // 今日收入+2元
              createdAt: db.serverDate(),
              updatedAt: db.serverDate()
            }
          });
          console.log('【更新骑手统计】重新创建记录成功，创建结果:', addResult);
        } catch (addError) {
          console.error('【更新骑手统计】重新创建记录失败:', addError);
        }
      }
    } else {
      // 如果今日统计不存在，创建新记录（如果集合不存在，add 方法会自动创建集合）
      try {
      const addResult = await db.collection('rider_stats').add({
        data: {
          riderOpenid: riderOpenid,
          date: dateStr,
          todayOrders: 1, // 今日接单数
          todayIncome: 2.00, // 今日收入（元）
          createdAt: db.serverDate(),
          updatedAt: db.serverDate()
        }
      });
      console.log('【更新骑手统计】创建新记录，订单数=1，收入=2元，创建结果:', addResult);
      } catch (addError) {
        console.error('【更新骑手统计】创建新记录失败:', addError);
        // 如果创建失败，记录错误但不抛出，避免影响订单完成流程
      }
    }
  } catch (error) {
    console.error('【更新骑手统计】异常:', error);
    console.error('【更新骑手统计】错误堆栈:', error.stack);
    // 不抛出错误，避免影响订单完成流程
  }
}

/**
 * 获取骑手今日统计数据
 * 如果 rider_stats 中没有数据，从实际订单数据中计算
 */
async function getRiderTodayStats(riderOpenid, data) {
  try {
    if (!riderOpenid) {
      return {
        code: 400,
        message: '缺少骑手openid'
      };
    }
    
    // 获取今天的日期（格式：YYYY-MM-DD）
    // 云函数运行在UTC时区，需要转换为中国时区（UTC+8）
    const now = new Date();
    const chinaTimeOffset = 8 * 60 * 60 * 1000; // 8小时的毫秒数
    const chinaTime = new Date(now.getTime() + chinaTimeOffset);
    const year = chinaTime.getUTCFullYear();
    const month = String(chinaTime.getUTCMonth() + 1).padStart(2, '0');
    const day = String(chinaTime.getUTCDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;
    
    // 获取今天的日期范围（开始和结束时间）- 使用中国时区
    const todayStartChina = new Date(chinaTime);
    todayStartChina.setUTCHours(0, 0, 0, 0);
    const todayStart = todayStartChina.getTime();
    
    const tomorrowChina = new Date(todayStartChina);
    tomorrowChina.setUTCDate(tomorrowChina.getUTCDate() + 1);
    const todayEnd = tomorrowChina.getTime();
    
    console.log('【获取骑手统计】日期字符串:', dateStr, '骑手openid:', riderOpenid);
    
    // 查询今日统计数据
    let statsResult;
    let hasStatsData = false;
    try {
      statsResult = await db.collection('rider_stats')
      .where({
        riderOpenid: riderOpenid,
        date: dateStr
      })
      .get();
    
    if (statsResult.data && statsResult.data.length > 0) {
        hasStatsData = true;
      }
    } catch (queryError) {
      // 如果集合不存在（错误码 -502005），从订单数据计算
      if (queryError.errCode === -502005 || queryError.message.includes('collection not exist') || queryError.message.includes('not exist')) {
        console.log('【获取骑手统计】集合不存在，从订单数据计算');
        hasStatsData = false;
      } else {
        throw queryError;
      }
    }
    
    console.log('【获取骑手统计】查询结果:', statsResult?.data);
    
    // 如果统计数据存在，直接返回
    if (hasStatsData && statsResult.data && statsResult.data.length > 0) {
      const stats = statsResult.data[0];
      const orders = stats.todayOrders || 0;
      const income = (stats.todayIncome || 0).toFixed(2);
      console.log('【获取骑手统计】从统计数据返回:', { orders, income });
      return {
        code: 200,
        message: 'ok',
        data: {
          orders: orders,
          income: income
        }
      };
    }
    
    // 如果统计数据不存在，从实际订单数据计算
    console.log('【获取骑手统计】统计数据不存在，从订单数据计算');
    
    try {
      // 查询今天完成的订单
      const completedOrdersResult = await db.collection('orders')
        .where({
          riderOpenid: riderOpenid,
          orderStatus: 'completed'
        })
        .get();
      
      // 过滤出今天完成的订单
      const todayCompletedOrders = completedOrdersResult.data.filter(order => {
        if (order.completedAt) {
          const completedTime = new Date(order.completedAt).getTime();
          return completedTime >= todayStart && completedTime < todayEnd;
        }
        return false;
      });
      
      // 计算统计数据
      const orders = todayCompletedOrders.length;
      const income = (orders * 2.00).toFixed(2); // 每完成一单收入2元
      
      console.log('【获取骑手统计】从订单数据计算:', { orders, income, todayCompletedOrders: todayCompletedOrders.length });
      
      // 如果计算出的数据不为0，尝试更新统计数据（异步，不等待结果）
      if (orders > 0) {
        // 异步更新统计数据，不阻塞返回
        updateRiderTodayStats(riderOpenid).catch(err => {
          console.error('【获取骑手统计】更新统计数据失败:', err);
        });
      }
      
      return {
        code: 200,
        message: 'ok',
        data: {
          orders: orders,
          income: income
        }
      };
    } catch (calcError) {
      console.error('【获取骑手统计】从订单数据计算失败:', calcError);
      // 如果计算失败，返回0
      return {
        code: 200,
        message: 'ok',
        data: {
          orders: 0,
          income: '0.00'
        }
      };
    }
  } catch (error) {
    console.error('【获取骑手统计】异常:', error);
    return {
      code: 500,
      message: '获取统计数据失败',
      error: error.message
    };
  }
}

/**
 * 获取骑手总统计数据
 */
async function getRiderTotalStats(riderOpenid, data) {
  try {
    if (!riderOpenid) {
      return {
        code: 400,
        message: '缺少骑手openid'
      };
    }
    
    console.log('【获取骑手总统计】骑手openid:', riderOpenid);
    
    // 查询骑手所有已完成的订单
    const completedOrdersResult = await db.collection('orders')
      .where({
        riderOpenid: riderOpenid,
        orderStatus: db.command.in(['completed', 'delivered'])
      })
      .get();
    
    const totalOrders = completedOrdersResult.data ? completedOrdersResult.data.length : 0;
    
    // 计算总收入
    let totalIncome = 0;
    if (completedOrdersResult.data && completedOrdersResult.data.length > 0) {
      totalIncome = completedOrdersResult.data.reduce((sum, order) => {
        // 骑手收入可能是 riderIncome 字段，或者从配送费计算
        let riderIncome = order.riderIncome || 0;
        
        // 如果 riderIncome 是分，转换为元
        if (riderIncome >= 100) {
          riderIncome = riderIncome / 100;
        }
        
        // 如果没有 riderIncome 字段，使用配送费作为收入（默认每单2元）
        if (!riderIncome && order.amountDelivery) {
          let deliveryFee = order.amountDelivery;
          if (deliveryFee >= 100) {
            deliveryFee = deliveryFee / 100;
          }
          riderIncome = deliveryFee || 2.00; // 默认每单2元
        } else if (!riderIncome) {
          riderIncome = 2.00; // 默认每单2元
        }
        
        return sum + riderIncome;
      }, 0);
    }
    
    console.log('【获取骑手总统计】总接单数:', totalOrders, '总收入:', totalIncome.toFixed(2));
    
    return {
      code: 200,
      message: 'ok',
      data: {
        orders: totalOrders,
        income: totalIncome.toFixed(2)
      }
    };
  } catch (error) {
    console.error('【获取骑手总统计】异常:', error);
    return {
      code: 500,
      message: '获取总统计数据失败',
      error: error.message
    };
  }
}

/**
 * 获取骑手本周统计数据
 */
async function getRiderWeekStats(riderOpenid, data) {
  try {
    if (!riderOpenid) {
      return {
        code: 400,
        message: '缺少骑手openid'
      };
    }
    
    // 使用中国时区（UTC+8）计算本周开始时间
    const now = new Date();
    const chinaTimeOffset = 8 * 60 * 60 * 1000; // 8小时的毫秒数
    const chinaTime = new Date(now.getTime() + chinaTimeOffset);
    const weekStart = new Date(chinaTime);
    // 计算本周一（中国时区）
    const dayOfWeek = chinaTime.getUTCDay(); // 0=周日, 1=周一, ..., 6=周六
    const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // 距离周一的天数
    weekStart.setUTCDate(chinaTime.getUTCDate() - daysToMonday);
    weekStart.setUTCHours(0, 0, 0, 0);
    
    // 查询本周已完成的订单
    const completedOrdersResult = await db.collection('orders')
      .where({
        riderOpenid: riderOpenid,
        orderStatus: db.command.in(['completed', 'delivered'])
      })
      .get();
    
    // 过滤出本周的订单
    const weekOrders = completedOrdersResult.data ? completedOrdersResult.data.filter(order => {
      if (order.completedAt) {
        const completedTime = new Date(order.completedAt).getTime();
        return completedTime >= weekStart.getTime();
      }
      return false;
    }) : [];
    
    const totalOrders = weekOrders.length;
    
    // 计算总收入
    let totalIncome = 0;
    if (weekOrders.length > 0) {
      totalIncome = weekOrders.reduce((sum, order) => {
        let riderIncome = order.riderIncome || 0;
        if (riderIncome >= 100) {
          riderIncome = riderIncome / 100;
        } else if (!riderIncome && order.amountDelivery) {
          let deliveryFee = order.amountDelivery;
          if (deliveryFee >= 100) {
            deliveryFee = deliveryFee / 100;
          }
          riderIncome = deliveryFee || 2.00;
        } else if (!riderIncome) {
          riderIncome = 2.00;
        }
        return sum + riderIncome;
      }, 0);
    }
    
    return {
      code: 200,
      message: 'ok',
      data: {
        orders: totalOrders,
        income: totalIncome.toFixed(2)
      }
    };
  } catch (error) {
    console.error('【获取骑手本周统计】异常:', error);
    return {
      code: 500,
      message: '获取本周统计数据失败',
      error: error.message
    };
  }
}

/**
 * 获取骑手本月统计数据
 */
async function getRiderMonthStats(riderOpenid, data) {
  try {
    if (!riderOpenid) {
      return {
        code: 400,
        message: '缺少骑手openid'
      };
    }
    
    // 使用中国时区（UTC+8）计算本月开始时间
    const now = new Date();
    const chinaTimeOffset = 8 * 60 * 60 * 1000; // 8小时的毫秒数
    const chinaTime = new Date(now.getTime() + chinaTimeOffset);
    const monthStart = new Date(chinaTime.getUTCFullYear(), chinaTime.getUTCMonth(), 1);
    monthStart.setUTCHours(0, 0, 0, 0);
    
    // 查询本月已完成的订单
    const completedOrdersResult = await db.collection('orders')
      .where({
        riderOpenid: riderOpenid,
        orderStatus: db.command.in(['completed', 'delivered'])
      })
      .get();
    
    // 过滤出本月的订单
    const monthOrders = completedOrdersResult.data ? completedOrdersResult.data.filter(order => {
      if (order.completedAt) {
        const completedTime = new Date(order.completedAt).getTime();
        return completedTime >= monthStart.getTime();
      }
      return false;
    }) : [];
    
    const totalOrders = monthOrders.length;
    
    // 计算总收入
    let totalIncome = 0;
    if (monthOrders.length > 0) {
      totalIncome = monthOrders.reduce((sum, order) => {
        let riderIncome = order.riderIncome || 0;
        if (riderIncome >= 100) {
          riderIncome = riderIncome / 100;
        } else if (!riderIncome && order.amountDelivery) {
          let deliveryFee = order.amountDelivery;
          if (deliveryFee >= 100) {
            deliveryFee = deliveryFee / 100;
          }
          riderIncome = deliveryFee || 2.00;
        } else if (!riderIncome) {
          riderIncome = 2.00;
        }
        return sum + riderIncome;
      }, 0);
    }
    
    return {
      code: 200,
      message: 'ok',
      data: {
        orders: totalOrders,
        income: totalIncome.toFixed(2)
      }
    };
  } catch (error) {
    console.error('【获取骑手本月统计】异常:', error);
    return {
      code: 500,
      message: '获取本月统计数据失败',
      error: error.message
    };
  }
}

/**
 * 格式化骑手订单数据
 */
function formatRiderOrder(order) {
  // 处理金额（从分转换为元）
  let amountDelivery = order.amountDelivery || 0;
  if (typeof amountDelivery === 'number') {
    amountDelivery = amountDelivery >= 100 ? amountDelivery / 100 : amountDelivery;
  }
  
  let amountTotal = order.amountTotal || order.amountPayable || 0;
  if (typeof amountTotal === 'number') {
    amountTotal = amountTotal >= 100 ? amountTotal / 100 : amountTotal;
  }
  
  // 格式化时间为中国时间（UTC+8）
  const formatDate = (date) => {
    if (!date) return null;
    
    let d;
    if (date && typeof date === 'object' && date.getTime && typeof date.getTime === 'function') {
      d = new Date(date.getTime());
    } else if (date && typeof date === 'object' && date.getFullYear) {
      d = date;
    } else if (typeof date === 'string') {
      let dateStr = date;
      if (dateStr.includes(' ') && !dateStr.includes('T')) {
        const hasTimezone = dateStr.endsWith('Z') || 
                           /[+-]\d{2}:?\d{2}$/.test(dateStr) ||
                           dateStr.match(/[+-]\d{4}$/);
        if (!hasTimezone) {
          dateStr = dateStr.replace(' ', 'T') + 'Z';
        } else {
          dateStr = dateStr.replace(' ', 'T');
        }
      }
      d = new Date(dateStr);
    } else if (typeof date === 'object' && date.type === 'date') {
      if (date.date) {
        d = new Date(date.date);
      } else {
        d = new Date(date);
      }
    } else {
      d = new Date(date);
    }
    
    if (isNaN(d.getTime())) {
      return null;
    }
    
    // 转换为中国时区（UTC+8）
    const chinaTimeOffset = 8 * 60 * 60 * 1000;
    const chinaTime = new Date(d.getTime() + chinaTimeOffset);
    const year = chinaTime.getUTCFullYear();
    const month = String(chinaTime.getUTCMonth() + 1).padStart(2, '0');
    const day = String(chinaTime.getUTCDate()).padStart(2, '0');
    const hour = String(chinaTime.getUTCHours()).padStart(2, '0');
    const minute = String(chinaTime.getUTCMinutes()).padStart(2, '0');
    return `${year}-${month}-${day} ${hour}:${minute}`;
  };
  
  // 获取状态文本（根据订单状态和骑手接单情况）
  const getStatusText = (status, riderOpenid) => {
    // 如果订单状态是confirmed或ready，且有骑手接单，显示"骑手已接单"
    if ((status === 'confirmed' || status === 'ready') && riderOpenid) {
      return '骑手已接单';
    }
    
    // 根据订单状态显示对应文本
    const statusMap = {
      'pending': '待确认',
      'confirmed': '商家已确认',
      'preparing': '制作中',
      'ready': '商家已出餐',
      'delivering': '骑手已取餐，正在派送',
      'completed': '已送达',
      'cancelled': '已取消'
    };
    return statusMap[status] || '未知状态';
  };
  
  // 处理商品信息
  let items = [];
  let itemsText = '';
  if (order.items && Array.isArray(order.items) && order.items.length > 0) {
    items = order.items.map(item => ({
      name: item.productName || item.name || '商品',
      spec: item.spec || '',
      quantity: item.quantity || 1
    }));
    
    // 生成餐品文本
    const category = order.items[0].category || '商品';
    const count = order.items.reduce((sum, item) => sum + (item.quantity || 1), 0);
    itemsText = `${category}・${count}件`;
  }
  
  // 处理地址信息
  let pickupStore = order.storeName || '商家店铺';
  let pickupAddress = '';
  let deliveryAddress = '';
  
  // 获取店铺地址（如果有店铺ID，可以查询店铺表获取详细地址）
  // 这里简化处理，使用订单中已有的信息
  if (order.storeId && order.storeAddress) {
    pickupAddress = order.storeAddress;
  } else {
    pickupAddress = '商家地址';
  }
  
  if (order.address) {
    deliveryAddress = `${order.address.buildingName || ''}${order.address.houseNumber || ''}${order.address.addressDetail || order.address.address || ''}`;
  }
  
  // 计算预计送达时间（简化处理，实际应该根据距离计算）
  const deliveryTime = '30分钟内送达';
  
  // 计算距离（简化处理，实际应该根据地理位置计算）
  const pickupDistance = '2.5 km';
  const deliveryDistance = '1.8 km';
  
  return {
    id: order._id,
    orderNo: order.orderNo,
    deliveryTime: deliveryTime,
    price: amountTotal.toFixed(2),
    pickupDistance: pickupDistance,
    pickupStore: pickupStore,
    pickupAddress: pickupAddress,
    deliveryDistance: deliveryDistance,
    deliveryAddress: deliveryAddress,
    status: getStatusText(order.orderStatus, order.riderOpenid),
    orderStatus: order.orderStatus,
    items: itemsText,
    itemsDetail: items,
    showItems: false,
    createdAt: formatDate(order.createdAt),
    readyAt: formatDate(order.readyAt),
    completedAt: formatDate(order.completedAt)
  };
}

/**
 * 获取骑手今日订单列表
 * 查询骑手今天接单的所有订单（不管订单什么时候创建的）
 */
async function getRiderTodayOrders(riderOpenid, data) {
  try {
    if (!riderOpenid) {
      return {
        code: 400,
        message: '缺少骑手openid'
      };
    }
    
    const { page = 1, pageSize = 20 } = data || {};
    
    // 获取今天的日期范围（开始和结束时间）- 使用中国时区（UTC+8）
    const now = new Date();
    const chinaTimeOffset = 8 * 60 * 60 * 1000; // 8小时的毫秒数
    const chinaTime = new Date(now.getTime() + chinaTimeOffset);
    const todayStartChina = new Date(chinaTime);
    todayStartChina.setUTCHours(0, 0, 0, 0);
    const todayStart = todayStartChina.getTime();
    
    const tomorrowChina = new Date(todayStartChina);
    tomorrowChina.setUTCDate(tomorrowChina.getUTCDate() + 1);
    const todayEnd = tomorrowChina.getTime();
    
    console.log('【获取骑手今日订单】日期范围:', {
      start: new Date(todayStart),
      end: new Date(todayEnd),
      riderOpenid: riderOpenid
    });
    
    // 查询骑手接单的所有订单（不管什么时候接单的）
    // 由于没有 riderAcceptedAt 字段，我们查询所有骑手接单的订单
    // 然后在代码中过滤出今天接单的订单（通过检查订单是否在今天完成，或者订单状态变化）
    const whereCondition = {
      riderOpenid: riderOpenid
    };
    
    console.log('【获取骑手今日订单】查询条件:', JSON.stringify(whereCondition));
    
    // 查询所有骑手接单的订单（不限制数量，因为需要在代码中过滤）
    const result = await db.collection('orders')
      .where(whereCondition)
      .orderBy('updatedAt', 'desc')
      .get();
    
    console.log('【获取骑手今日订单】查询到订单数量:', result.data.length);
    
    // 过滤出今天接单的订单
    // 判断逻辑：
    // 1. 如果订单今天完成了（completedAt 在今天），说明是今天接单的
    // 2. 如果订单今天有更新（updatedAt 在今天），且订单状态不是 completed，说明是今天接单的
    // 3. 如果订单今天接单但还没完成，updatedAt 会在今天
    const todayOrders = result.data.filter(order => {
      // 如果订单今天完成了，肯定是今天接单的
      if (order.completedAt) {
        const completedTime = new Date(order.completedAt).getTime();
        if (completedTime >= todayStart && completedTime < todayEnd) {
          return true;
        }
      }
      
      // 如果订单今天有更新，且订单状态不是 completed，说明是今天接单的
      if (order.updatedAt) {
        const updatedTime = new Date(order.updatedAt).getTime();
        if (updatedTime >= todayStart && updatedTime < todayEnd) {
          // 如果订单状态不是 completed，说明是今天接单的
          if (order.orderStatus !== 'completed') {
            return true;
          }
          // 如果订单状态是 completed，但 completedAt 不在今天，说明是今天接单但今天完成的
          if (order.orderStatus === 'completed' && order.completedAt) {
            const completedTime = new Date(order.completedAt).getTime();
            return completedTime >= todayStart && completedTime < todayEnd;
          }
        }
      }
      
      return false;
    });
    
    console.log('【获取骑手今日订单】过滤后订单数量:', todayOrders.length);
    
    // 分页处理
    const total = todayOrders.length;
    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const pagedOrders = todayOrders.slice(startIndex, endIndex);
    
    console.log('【获取骑手今日订单】分页后订单数量:', pagedOrders.length, '总数:', total);
    
    // 格式化订单数据
    const formattedList = pagedOrders.map(order => formatRiderOrder(order));
    
    return {
      code: 200,
      message: 'ok',
      data: {
        list: formattedList,
        total: total,
        page: page,
        pageSize: pageSize
      }
    };
    
  } catch (error) {
    console.error('【获取骑手今日订单】异常:', error);
    return {
      code: 500,
      message: '获取今日订单列表失败',
      error: error.message
    };
  }
}

/**
 * 获取骑手今日收入明细
 * 查询骑手今天完成的订单（按 completedAt 判断）
 */
async function getRiderTodayIncome(riderOpenid, data) {
  try {
    if (!riderOpenid) {
      return {
        code: 400,
        message: '缺少骑手openid'
      };
    }
    
    const { page = 1, pageSize = 20 } = data || {};
    
    // 获取今天的日期范围（开始和结束时间）- 使用中国时区（UTC+8）
    const now = new Date();
    const chinaTimeOffset = 8 * 60 * 60 * 1000; // 8小时的毫秒数
    const chinaTime = new Date(now.getTime() + chinaTimeOffset);
    const todayStartChina = new Date(chinaTime);
    todayStartChina.setUTCHours(0, 0, 0, 0);
    const todayStart = todayStartChina.getTime();
    
    const tomorrowChina = new Date(todayStartChina);
    tomorrowChina.setUTCDate(tomorrowChina.getUTCDate() + 1);
    const todayEnd = tomorrowChina.getTime();
    
    console.log('【获取骑手今日收入】日期范围:', {
      start: new Date(todayStart),
      end: new Date(todayEnd),
      riderOpenid: riderOpenid
    });
    
    // 查询骑手已完成的订单（不管什么时候创建的，只要今天完成的）
    // 由于数据库查询限制，我们先查询所有已完成的订单，然后在代码中过滤
    const whereCondition = {
      riderOpenid: riderOpenid,
      orderStatus: 'completed' // 只查询已完成的订单
    };
    
    console.log('【获取骑手今日收入】查询条件:', JSON.stringify(whereCondition));
    
    // 查询订单（不限制数量，因为需要在代码中过滤）
    // 注意：由于需要按 completedAt 排序，但可能有些订单没有 completedAt
    // 我们先查询所有已完成的订单，然后在代码中过滤和排序
    const result = await db.collection('orders')
      .where(whereCondition)
      .orderBy('updatedAt', 'desc')
      .get();
    
    console.log('【获取骑手今日收入】查询到订单数量:', result.data.length);
    
    // 过滤出今日完成的订单（completedAt 在今天）
    const todayCompletedOrders = result.data.filter(order => {
      if (order.completedAt) {
        const completedTime = new Date(order.completedAt).getTime();
        return completedTime >= todayStart && completedTime < todayEnd;
      }
      // 如果没有 completedAt，跳过（不应该出现这种情况）
      return false;
    }).sort((a, b) => {
      // 按 completedAt 降序排序
      const timeA = a.completedAt ? new Date(a.completedAt).getTime() : 0;
      const timeB = b.completedAt ? new Date(b.completedAt).getTime() : 0;
      return timeB - timeA;
    });
    
    console.log('【获取骑手今日收入】今日完成的订单数量:', todayCompletedOrders.length);
    
    // 分页处理
    const total = todayCompletedOrders.length;
    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const pagedOrders = todayCompletedOrders.slice(startIndex, endIndex);
    
    console.log('【获取骑手今日收入】分页后订单数量:', pagedOrders.length, '总数:', total);
    
    // 格式化收入明细数据
    const incomeList = pagedOrders.map(order => {
      // 处理配送费（从分转换为元）
      // 注意：根据统计逻辑，每完成一单收入是2元，而不是配送费
      // 但这里我们显示配送费，总收入应该从 rider_stats 中获取
      let amountDelivery = order.amountDelivery || 0;
      if (typeof amountDelivery === 'number') {
        amountDelivery = amountDelivery >= 100 ? amountDelivery / 100 : amountDelivery;
      }
      
      // 格式化时间为中国时间（UTC+8）
      const formatDate = (date) => {
        if (!date) return null;
        
        let d;
        if (date && typeof date === 'object' && date.getTime && typeof date.getTime === 'function') {
          d = new Date(date.getTime());
        } else if (date && typeof date === 'object' && date.getFullYear) {
          d = date;
        } else if (typeof date === 'string') {
          let dateStr = date;
          if (dateStr.includes(' ') && !dateStr.includes('T')) {
            const hasTimezone = dateStr.endsWith('Z') || 
                               /[+-]\d{2}:?\d{2}$/.test(dateStr) ||
                               dateStr.match(/[+-]\d{4}$/);
            if (!hasTimezone) {
              dateStr = dateStr.replace(' ', 'T') + 'Z';
            } else {
              dateStr = dateStr.replace(' ', 'T');
            }
          }
          d = new Date(dateStr);
        } else if (typeof date === 'object' && date.type === 'date') {
          if (date.date) {
            d = new Date(date.date);
          } else {
            d = new Date(date);
          }
        } else {
          d = new Date(date);
        }
        
        if (isNaN(d.getTime())) {
          return null;
        }
        
        // 转换为中国时区（UTC+8）
        const chinaTimeOffset = 8 * 60 * 60 * 1000;
        const chinaTime = new Date(d.getTime() + chinaTimeOffset);
        const year = chinaTime.getUTCFullYear();
        const month = String(chinaTime.getUTCMonth() + 1).padStart(2, '0');
        const day = String(chinaTime.getUTCDate()).padStart(2, '0');
        const hour = String(chinaTime.getUTCHours()).padStart(2, '0');
        const minute = String(chinaTime.getUTCMinutes()).padStart(2, '0');
        return `${year}-${month}-${day} ${hour}:${minute}`;
      };
      
      // 处理商品信息
      let itemsText = '';
      if (order.items && Array.isArray(order.items) && order.items.length > 0) {
        const category = order.items[0].category || '商品';
        const count = order.items.reduce((sum, item) => sum + (item.quantity || 1), 0);
        itemsText = `${category}・${count}件`;
      }
      
      return {
        id: order._id,
        orderNo: order.orderNo,
        income: '2.00', // 每完成一单收入2元（固定值，与统计逻辑一致）
        items: itemsText,
        completedAt: formatDate(order.completedAt),
        createdAt: formatDate(order.createdAt)
      };
    });
    
    // 计算总收入（每单2元）
    const totalIncome = total * 2.00;
    
    return {
      code: 200,
      message: 'ok',
      data: {
        list: incomeList,
        total: total,
        totalIncome: totalIncome.toFixed(2),
        page: page,
        pageSize: pageSize
      }
    };
    
  } catch (error) {
    console.error('【获取骑手今日收入】异常:', error);
    return {
      code: 500,
      message: '获取今日收入明细失败',
      error: error.message
    };
  }
}

