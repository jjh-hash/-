const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const { extractAdminSessionToken, verifyAdminSession, deny } = require('./adminSession');

exports.main = async (event, context) => {
  try {
    const { action, data } = event;
    
    console.log('【平台配置】请求:', { action, data });

    if (action === 'updateConfig') {
      const v = await verifyAdminSession(db, extractAdminSessionToken(event));
      if (!v.ok) {
        return deny(v);
      }
    }
    
    switch (action) {
      case 'getConfig':
        return await getConfig();
      case 'updateConfig':
        return await updateConfig(data);
      default:
        return {
          code: 400,
          message: '无效的操作类型',
          data: null
        };
    }
  } catch (error) {
    console.error('【平台配置】异常:', error);
    return {
      code: 500,
      message: '系统异常: ' + error.message,
      data: null
    };
  }
};

/**
 * 创建默认配置
 */
async function createDefaultConfig() {
  const defaultConfig = {
    platformFeeRate: 0.08, // 平台服务费比例 8%
    deliveryFee: 300, // 配送费（分）3元
    minOrderAmountLimit: 2000, // 最低订单金额下限（分）20元
    estimatedDeliveryMinutes: 30, // 预计送达时间（分钟）
    orderTimeoutMinutes: 20, // 订单超时时间（分钟）
    depositAmount: 10000, // 校园兼职保证金（分）100 元
    createdAt: db.serverDate(),
    updatedAt: db.serverDate()
  };
  
  const createResult = await db.collection('platform_config').add({
    data: defaultConfig
  });
  
  console.log('【平台配置】创建默认配置成功:', createResult._id);
  
  return defaultConfig;
}

/**
 * 获取平台配置
 */
async function getConfig() {
  try {
    // 查询平台配置，如果不存在则创建默认配置
    let configResult;
    try {
      configResult = await db.collection('platform_config')
        .limit(1)
        .get();
    } catch (queryError) {
      // 如果集合不存在，创建默认配置
      if (queryError.errCode === -500205 || queryError.message.includes('collection not exists')) {
        console.log('【平台配置】集合不存在，创建默认配置');
        const defaultConfig = await createDefaultConfig();
        
        // 处理默认配置的日期
        let systemStartTime = null;
        if (defaultConfig.createdAt) {
          if (defaultConfig.createdAt instanceof Date) {
            systemStartTime = defaultConfig.createdAt.toISOString();
          } else if (typeof defaultConfig.createdAt === 'object') {
            try {
              const date = new Date(defaultConfig.createdAt);
              if (!isNaN(date.getTime())) {
                systemStartTime = date.toISOString();
              }
            } catch (e) {
              console.warn('默认配置日期转换失败:', e);
            }
          } else {
            systemStartTime = defaultConfig.createdAt;
          }
        }
        
        return {
          code: 200,
          message: 'ok',
          data: {
            platformFeeRate: defaultConfig.platformFeeRate || 0.08,
            deliveryFee: defaultConfig.deliveryFee || 300,
            minOrderAmountLimit: defaultConfig.minOrderAmountLimit || 2000,
            estimatedDeliveryMinutes: defaultConfig.estimatedDeliveryMinutes || 30,
            orderTimeoutMinutes: defaultConfig.orderTimeoutMinutes || 15,
            depositAmount: defaultConfig.depositAmount !== undefined ? defaultConfig.depositAmount : 10000,
            systemStartTime: systemStartTime || null,
            deploymentTime: systemStartTime || null
          }
        };
      }
      throw queryError;
    }
    
    if (configResult.data.length === 0) {
      // 集合存在但无数据，创建默认配置
      const defaultConfig = await createDefaultConfig();
      
      // 处理默认配置的日期
      let systemStartTime = null;
      if (defaultConfig.createdAt) {
        if (defaultConfig.createdAt instanceof Date) {
          systemStartTime = defaultConfig.createdAt.toISOString();
        } else if (typeof defaultConfig.createdAt === 'object') {
          try {
            const date = new Date(defaultConfig.createdAt);
            if (!isNaN(date.getTime())) {
              systemStartTime = date.toISOString();
            }
          } catch (e) {
            console.warn('默认配置日期转换失败:', e);
          }
        } else {
          systemStartTime = defaultConfig.createdAt;
        }
      }
      
      return {
        code: 200,
        message: 'ok',
        data: {
          platformFeeRate: defaultConfig.platformFeeRate || 0.08,
          deliveryFee: defaultConfig.deliveryFee || 300,
          minOrderAmountLimit: defaultConfig.minOrderAmountLimit || 2000,
          estimatedDeliveryMinutes: defaultConfig.estimatedDeliveryMinutes || 30,
          orderTimeoutMinutes: defaultConfig.orderTimeoutMinutes || 15,
          depositAmount: defaultConfig.depositAmount !== undefined ? defaultConfig.depositAmount : 10000,
          systemStartTime: systemStartTime || null,
          deploymentTime: systemStartTime || null
        }
      };
    }
    
    const config = configResult.data[0];
    
    // 处理日期格式，确保能正确返回
    let systemStartTime = null;
    let deploymentTime = null;
    
    if (config.createdAt) {
      // 云数据库的日期对象，转换为ISO字符串
      if (config.createdAt instanceof Date) {
        systemStartTime = config.createdAt.toISOString();
        deploymentTime = config.createdAt.toISOString();
      } else if (typeof config.createdAt === 'object' && config.createdAt.constructor) {
        // 可能是云数据库的特殊日期对象
        try {
          const date = new Date(config.createdAt);
          if (!isNaN(date.getTime())) {
            systemStartTime = date.toISOString();
            deploymentTime = date.toISOString();
          }
        } catch (e) {
          console.warn('日期转换失败:', e);
        }
      } else {
        systemStartTime = config.createdAt;
        deploymentTime = config.createdAt;
      }
    }
    
    return {
      code: 200,
      message: 'ok',
      data: {
        platformFeeRate: config.platformFeeRate || 0.08,
        deliveryFee: config.deliveryFee || 300,
        minOrderAmountLimit: config.minOrderAmountLimit || 2000,
        estimatedDeliveryMinutes: config.estimatedDeliveryMinutes || 30,
        orderTimeoutMinutes: config.orderTimeoutMinutes || 15,
        depositAmount: config.depositAmount !== undefined ? config.depositAmount : 10000,
        systemStartTime: systemStartTime || config.deploymentTime || null,
        deploymentTime: deploymentTime || config.deploymentTime || null,
        subscribeMessageOrderStatusTemplateId: config.subscribeMsgOrderTplId || config.subscribeMessageOrderStatusTemplateId || '',
        subscribeMessageRefundTemplateId: config.subscribeMsgRefundTplId || config.subscribeMessageRefundTemplateId || '',
        subscribeMessageReviewTemplateId: config.subscribeMsgReviewTplId || config.subscribeMessageReviewTemplateId || '',
        subscribeMessageNewOrderTemplateId: config.subscribeMsgNewOrderTplId || config.subscribeMessageNewOrderTemplateId || ''
      }
    };
  } catch (error) {
    console.error('【平台配置】获取配置失败:', error);
    return {
      code: 500,
      message: '获取配置失败: ' + error.message,
      data: null
    };
  }
}

/**
 * 更新平台配置
 */
async function updateConfig(data) {
  try {
    const { platformFeeRate, deliveryFee, minOrderAmountLimit, estimatedDeliveryMinutes, orderTimeoutMinutes, depositAmount } = data;
    
    // 查询现有配置
    let configResult;
    try {
      configResult = await db.collection('platform_config')
        .limit(1)
        .get();
    } catch (queryError) {
      // 如果集合不存在，先创建默认配置
      if (queryError.errCode === -500205 || queryError.message.includes('collection not exists')) {
        console.log('【平台配置】集合不存在，先创建默认配置');
        await createDefaultConfig();
        // 重新查询
        configResult = await db.collection('platform_config')
          .limit(1)
          .get();
      } else {
        throw queryError;
      }
    }
    
    const updateData = {
      updatedAt: db.serverDate()
    };
    
    if (platformFeeRate !== undefined) {
      const rate = parseFloat(platformFeeRate);
      if (isNaN(rate) || rate < 0 || rate > 1) {
        return {
          code: 400,
          message: '平台服务费比例必须在0-1之间',
          data: null
        };
      }
      updateData.platformFeeRate = rate;
    }
    
    if (deliveryFee !== undefined) {
      const fee = Math.round(parseFloat(deliveryFee) * 100); // 转换为分
      if (isNaN(fee) || fee < 0) {
        return {
          code: 400,
          message: '配送费必须大于等于0',
          data: null
        };
      }
      updateData.deliveryFee = fee;
    }
    
    if (minOrderAmountLimit !== undefined) {
      const limit = Math.round(parseFloat(minOrderAmountLimit) * 100); // 转换为分
      if (isNaN(limit) || limit < 0) {
        return {
          code: 400,
          message: '最低订单金额下限必须大于等于0',
          data: null
        };
      }
      updateData.minOrderAmountLimit = limit;
    }
    
    if (estimatedDeliveryMinutes !== undefined) {
      const minutes = parseInt(estimatedDeliveryMinutes);
      if (isNaN(minutes) || minutes < 1) {
        return {
          code: 400,
          message: '预计送达时间必须大于0分钟',
          data: null
        };
      }
      updateData.estimatedDeliveryMinutes = minutes;
    }
    
    if (orderTimeoutMinutes !== undefined) {
      const minutes = parseInt(orderTimeoutMinutes);
      if (isNaN(minutes) || minutes < 1) {
        return {
          code: 400,
          message: '订单超时时间必须大于0分钟',
          data: null
        };
      }
      updateData.orderTimeoutMinutes = minutes;
    }
    
    if (depositAmount !== undefined) {
      const yuan = parseFloat(depositAmount);
      if (isNaN(yuan) || yuan < 0) {
        return {
          code: 400,
          message: '校园兼职保证金（元）必须大于等于0',
          data: null
        };
      }
      updateData.depositAmount = Math.round(yuan * 100); // 存为分
    }
    
    if (configResult.data.length === 0) {
      // 创建新配置
      const defaultConfig = Object.assign({}, {
        platformFeeRate: 0.08,
        deliveryFee: 300,
        minOrderAmountLimit: 2000,
        estimatedDeliveryMinutes: 30,
        orderTimeoutMinutes: 15,
        depositAmount: 10000,
        createdAt: db.serverDate()
      }, updateData);
      
      await db.collection('platform_config').add({
        data: defaultConfig
      });
    } else {
      // 更新现有配置
      await db.collection('platform_config').doc(configResult.data[0]._id).update({
        data: updateData
      });
    }
    
    console.log('【平台配置】更新配置成功');
    
    return {
      code: 200,
      message: '更新成功',
      data: null
    };
  } catch (error) {
    console.error('【平台配置】更新配置失败:', error);
    return {
      code: 500,
      message: '更新配置失败: ' + error.message,
      data: null
    };
  }
}

