// 统计数据云函数
const cloud = require('wx-server-sdk');
const crypto = require('crypto');

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
const { extractAdminSessionToken, verifyAdminSession, deny } = require('./adminSession');

function sha256(value) {
  return crypto.createHash('sha256').update(String(value || '')).digest('hex');
}

async function validateMerchantSession(merchantId, sessionToken) {
  if (!merchantId || !sessionToken) return false;
  try {
    const now = new Date();
    const sessionQuery = await db.collection('merchant_sessions')
      .where({
        merchantId,
        tokenHash: sha256(sessionToken),
        status: 'active'
      })
      .orderBy('createdAt', 'desc')
      .limit(1)
      .get();
    if (!sessionQuery.data || sessionQuery.data.length === 0) return false;
    const session = sessionQuery.data[0];
    const expiresAt = session.expiresAt ? new Date(session.expiresAt) : null;
    if (!expiresAt || Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() <= now.getTime()) return false;
    await db.collection('merchant_sessions').doc(session._id).update({
      data: { lastSeenAt: db.serverDate(), updatedAt: db.serverDate() }
    });
    return true;
  } catch (e) {
    console.error('【统计数据】校验商家会话失败:', e);
    return false;
  }
}

async function resolveAuthorizedMerchant(openid, merchantId, sessionToken) {
  if (merchantId) {
    const doc = await db.collection('merchants').doc(merchantId).get();
    if (!doc.data) return null;
    if (doc.data.openid === openid) return doc.data;
    const tokenOk = await validateMerchantSession(doc.data._id, sessionToken);
    if (tokenOk) return doc.data;
    return null;
  }
  const list = await db.collection('merchants').where({ openid }).limit(1).get();
  if (list.data && list.data.length > 0) return list.data[0];
  return null;
}

exports.main = async (event, context) => {
  try {
    const { OPENID } = cloud.getWXContext();
    const { action, data } = event;
    
    console.log('【统计数据】请求:', { action, data, openid: OPENID });
    
    // 参数验证
    if (!action) {
      return {
        code: 400,
        message: '缺少action参数'
      };
    }

    const ADMIN_STATS_ACTIONS = new Set([
      'getDashboardStats',
      'getAdminOverviewStats',
      'getAdminOrderStats',
      'getAdminUserStats',
      'getAdminMerchantStats',
      'getAdminFinanceStats'
    ]);
    if (ADMIN_STATS_ACTIONS.has(action)) {
      const v = await verifyAdminSession(db, extractAdminSessionToken(event));
      if (!v.ok) {
        return deny(v);
      }
    }
    
    let result;
    
    // 根据action执行不同操作
    switch (action) {
      case 'getSalesOverview':
        result = await getSalesOverview(OPENID, data);
        break;
      case 'getSalesChart':
        result = await getSalesChart(OPENID, data);
        break;
      case 'getSalesTrend':
        result = await getSalesTrend(OPENID, data);
        break;
      case 'getAccountBalance':
        result = await getAccountBalance(OPENID, data);
        break;
      case 'getDashboardStats':
        result = await getDashboardStats(OPENID, data);
        break;
      case 'getAdminOverviewStats':
        result = await getAdminOverviewStats(OPENID, data);
        break;
      case 'getAdminOrderStats':
        result = await getAdminOrderStats(OPENID, data);
        break;
      case 'getAdminUserStats':
        result = await getAdminUserStats(OPENID, data);
        break;
      case 'getAdminMerchantStats':
        result = await getAdminMerchantStats(OPENID, data);
        break;
      case 'getAdminFinanceStats':
        result = await getAdminFinanceStats(OPENID, data);
        break;
      default:
        console.warn('【统计数据】无效的操作类型:', action);
        result = {
          code: 400,
          message: '无效的操作类型',
          action: action
        };
    }
    
    console.log('【统计数据】返回结果:', result);
    return result;
    
  } catch (error) {
    console.error('【统计数据】异常:', error);
    return {
      code: 500,
      message: '系统异常',
      error: error.message,
      stack: error.stack
    };
  }
};

/**
 * 获取销售概览
 * 返回：总销售额、日增长、当前收益、有效订单数
 */
async function getSalesOverview(openid, data) {
  try {
    const { storeId, year, month, merchantId, sessionToken } = data;
    
    console.log('【销售概览】参数:', { storeId, year, month, merchantId });
    
    // 优先使用传入的 storeId
    let targetStoreId = storeId;
    
    if (!targetStoreId) {
      const merchant = await resolveAuthorizedMerchant(openid, merchantId, sessionToken);
      if (merchant) {
        targetStoreId = merchant.storeId || merchant._id;
      } else if (merchantId) {
        return { code: 403, message: '无权操作该商家账号' };
      }
    }
    
    if (!targetStoreId) {
      return {
        code: 404,
        message: '店铺不存在'
      };
    }
    
    // 计算时间范围
    const selectedYear = year || new Date().getFullYear();
    const selectedMonth = month || null;
    
    const startDate = new Date(selectedYear, selectedMonth ? selectedMonth - 1 : 0, 1);
    const endDate = new Date(selectedYear, selectedMonth ? selectedMonth : 12, 0, 23, 59, 59);
    
    // 查询该年度的所有已支付订单
    const ordersResult = await db.collection('orders')
      .where({
        storeId: targetStoreId,
        payStatus: 'paid',
        orderStatus: db.command.neq('cancelled'), // 排除已取消的订单
        createdAt: db.command.gte(startDate).and(db.command.lte(endDate))
      })
      .get();
    
    const orders = ordersResult.data;
    
    // 计算总销售额（商品金额）
    let totalSales = orders.reduce((sum, order) => sum + (order.amountGoods || 0), 0);
    
    // 扣除已同意或已完成的退款金额
    try {
      const completedRefundsResult = await db.collection('refunds')
        .where({
          storeId: targetStoreId,
          status: db.command.in(['approved', 'completed']),
          processed: true
        })
        .get();
      
      if (completedRefundsResult.data && completedRefundsResult.data.length > 0) {
        completedRefundsResult.data.forEach(refund => {
          // 使用 completedAt 或 approvedAt 作为退款时间
          const refundDate = refund.completedAt ? new Date(refund.completedAt) : (refund.approvedAt ? new Date(refund.approvedAt) : null);
          if (refundDate && refundDate >= startDate && refundDate <= endDate) {
            const refundGoodsAmount = refund.refundGoodsAmount || (refund.refundAmount ? Math.round(refund.refundAmount * 100) : 0);
            totalSales = totalSales - refundGoodsAmount;
          }
        });
      }
    } catch (error) {
      console.warn('【销售概览】查询退款记录失败:', error);
    }
    
    // 计算有效订单数
    const effectiveOrders = orders.length;
    
    // 计算当前收益（当前月的收益，如果指定了月份）
    let currentRevenue = 0;
    if (selectedMonth) {
      const currentMonthOrders = orders.filter(order => {
        const orderDate = new Date(order.createdAt);
        return orderDate.getMonth() === selectedMonth - 1;
      });
      currentRevenue = currentMonthOrders.reduce((sum, order) => sum + (order.amountGoods || 0), 0);
      
      // 扣除当前月的退款金额
      try {
        const currentMonthRefundsResult = await db.collection('refunds')
          .where({
            storeId: targetStoreId,
            status: db.command.in(['approved', 'completed']),
            processed: true
          })
          .get();
        
        if (currentMonthRefundsResult.data && currentMonthRefundsResult.data.length > 0) {
          const currentMonthStart = new Date(selectedYear, selectedMonth - 1, 1);
          const currentMonthEnd = new Date(selectedYear, selectedMonth, 0, 23, 59, 59);
          
          currentMonthRefundsResult.data.forEach(refund => {
            // 使用 completedAt 或 approvedAt 作为退款时间
            const refundDate = refund.completedAt ? new Date(refund.completedAt) : (refund.approvedAt ? new Date(refund.approvedAt) : null);
            if (refundDate && refundDate >= currentMonthStart && refundDate <= currentMonthEnd) {
              const refundGoodsAmount = refund.refundGoodsAmount || (refund.refundAmount ? Math.round(refund.refundAmount * 100) : 0);
              currentRevenue = currentRevenue - refundGoodsAmount;
            }
          });
        }
      } catch (error) {
        console.warn('【销售概览】查询当前月退款记录失败:', error);
      }
    } else {
      // 如果没有指定月份，计算当前月的收益
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth() + 1;
      
      if (selectedYear === currentYear) {
        const currentMonthOrders = orders.filter(order => {
          const orderDate = new Date(order.createdAt);
          return orderDate.getMonth() === currentMonth - 1 && orderDate.getFullYear() === currentYear;
        });
        currentRevenue = currentMonthOrders.reduce((sum, order) => sum + (order.amountGoods || 0), 0);
        
        // 扣除当前月的退款金额
        try {
          const currentMonthRefundsResult = await db.collection('refunds')
            .where({
              storeId: targetStoreId,
              status: db.command.in(['approved', 'completed']),
              processed: true
            })
            .get();
          
          if (currentMonthRefundsResult.data && currentMonthRefundsResult.data.length > 0) {
            const currentMonthStart = new Date(currentYear, currentMonth - 1, 1);
            const currentMonthEnd = new Date(currentYear, currentMonth, 0, 23, 59, 59);
            
            currentMonthRefundsResult.data.forEach(refund => {
              // 使用 completedAt 或 approvedAt 作为退款时间
              const refundDate = refund.completedAt ? new Date(refund.completedAt) : (refund.approvedAt ? new Date(refund.approvedAt) : null);
              if (refundDate && refundDate >= currentMonthStart && refundDate <= currentMonthEnd) {
                const refundGoodsAmount = refund.refundGoodsAmount || (refund.refundAmount ? Math.round(refund.refundAmount * 100) : 0);
                currentRevenue = currentRevenue - refundGoodsAmount;
              }
            });
          }
        } catch (error) {
          console.warn('【销售概览】查询当前月退款记录失败:', error);
        }
      }
    }
    
    // 计算日增长（与前一天对比）
    let dailyGrowth = 0;
    try {
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      
      const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const todayEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);
      const yesterdayStart = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate());
      const yesterdayEnd = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 23, 59, 59);
      
      const todayOrders = await db.collection('orders')
        .where({
          storeId: targetStoreId,
          payStatus: 'paid',
          orderStatus: db.command.neq('cancelled'),
          createdAt: db.command.gte(todayStart).and(db.command.lte(todayEnd))
        })
        .get();
      
      const yesterdayOrders = await db.collection('orders')
        .where({
          storeId: targetStoreId,
          payStatus: 'paid',
          orderStatus: db.command.neq('cancelled'),
          createdAt: db.command.gte(yesterdayStart).and(db.command.lte(yesterdayEnd))
        })
        .get();
      
      let todaySales = todayOrders.data.reduce((sum, order) => sum + (order.amountGoods || 0), 0);
      let yesterdaySales = yesterdayOrders.data.reduce((sum, order) => sum + (order.amountGoods || 0), 0);
      
      // 扣除今日和昨日的退款金额
      try {
        const refundsResult = await db.collection('refunds')
          .where({
            storeId: targetStoreId,
            status: db.command.in(['approved', 'completed']),
            processed: true
          })
          .get();
        
        if (refundsResult.data && refundsResult.data.length > 0) {
          refundsResult.data.forEach(refund => {
            // 使用 completedAt 或 approvedAt 作为退款时间
            const refundDate = refund.completedAt ? new Date(refund.completedAt) : (refund.approvedAt ? new Date(refund.approvedAt) : null);
            if (refundDate) {
              const refundGoodsAmount = refund.refundGoodsAmount || (refund.refundAmount ? Math.round(refund.refundAmount * 100) : 0);
              
              if (refundDate >= todayStart && refundDate <= todayEnd) {
                todaySales = todaySales - refundGoodsAmount;
              } else if (refundDate >= yesterdayStart && refundDate <= yesterdayEnd) {
                yesterdaySales = yesterdaySales - refundGoodsAmount;
              }
            }
          });
        }
      } catch (error) {
        console.warn('【销售概览】查询退款记录失败:', error);
      }
      
      // 计算日增长金额（今天销售额 - 昨天销售额），单位：分
      dailyGrowth = todaySales - yesterdaySales;
      
    } catch (error) {
      console.error('【销售概览】计算日增长失败:', error);
      dailyGrowth = 0;
    }
    
    // 转换为元（订单金额存储为分）
    const totalSalesYuan = (totalSales / 100).toFixed(2);
    const currentRevenueYuan = (currentRevenue / 100).toFixed(2);
    const dailyGrowthYuan = (dailyGrowth / 100).toFixed(2); // 转换为元并保留两位小数
    
    console.log('【销售概览】统计结果:', {
      totalSales: totalSalesYuan,
      dailyGrowth: dailyGrowthYuan,
      currentRevenue: currentRevenueYuan,
      effectiveOrders
    });
    
    return {
      code: 200,
      message: 'ok',
      data: {
        totalSales: parseFloat(totalSalesYuan),
        dailyGrowth: parseFloat(dailyGrowthYuan), // 金额差值（元），正数表示上涨，负数表示下跌
        currentRevenue: parseFloat(currentRevenueYuan),
        effectiveOrders
      }
    };
    
  } catch (error) {
    console.error('【销售概览】异常:', error);
    return {
      code: 500,
      message: '获取销售概览失败',
      error: error.message
    };
  }
}

/**
 * 获取销售数据图表（柱状图）
 * 返回：日期列表、订单数列表、收益列表
 */
async function getSalesChart(openid, data) {
  try {
    const { storeId, startDate, endDate, type = 'day', merchantId, sessionToken } = data;
    
    console.log('【销售图表】参数:', { storeId, startDate, endDate, type, merchantId });
    
    // 优先使用传入的 storeId
    let targetStoreId = storeId;
    
    if (!targetStoreId) {
      const merchant = await resolveAuthorizedMerchant(openid, merchantId, sessionToken);
      if (merchant) {
        targetStoreId = merchant.storeId || merchant._id;
      } else if (merchantId) {
        return { code: 403, message: '无权操作该商家账号' };
      }
    }
    
    if (!targetStoreId) {
      return {
        code: 404,
        message: '店铺不存在'
      };
    }
    
    // 如果没有指定日期范围，默认查询最近7天
    let start, end;
    if (startDate && endDate) {
      start = new Date(startDate);
      end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
    } else {
      end = new Date();
      end.setHours(23, 59, 59, 999);
      start = new Date(end);
      start.setDate(start.getDate() - 6); // 最近7天
      start.setHours(0, 0, 0, 0);
    }
    
    // 查询该时间范围内的所有已支付订单
    const ordersResult = await db.collection('orders')
      .where({
        storeId: targetStoreId,
        payStatus: 'paid',
        orderStatus: db.command.neq('cancelled'),
        createdAt: db.command.gte(start).and(db.command.lte(end))
      })
      .get();
    
    const orders = ordersResult.data;
    
    // 按日期分组统计
    const dailyStats = {};
    
    orders.forEach(order => {
      const orderDate = new Date(order.createdAt);
      let dateKey;
      
      if (type === 'day') {
        // 按天统计：MM/DD
        const month = padStart(orderDate.getMonth() + 1, 2, '0');
        const day = padStart(orderDate.getDate(), 2, '0');
        dateKey = `${day}/${month}`;
      } else if (type === 'week') {
        // 按周统计：第几周
        const week = getWeekNumber(orderDate);
        dateKey = `第${week}周`;
      } else if (type === 'month') {
        // 按月统计：YYYY-MM
        const year = orderDate.getFullYear();
        const month = padStart(orderDate.getMonth() + 1, 2, '0');
        dateKey = `${year}-${month}`;
      }
      
      if (!dailyStats[dateKey]) {
        dailyStats[dateKey] = {
          orders: 0,
          revenue: 0
        };
      }
      
      dailyStats[dateKey].orders += 1;
      dailyStats[dateKey].revenue += (order.amountGoods || 0);
    });
    
    // 生成日期列表（确保连续）
    const dates = [];
    const ordersList = [];
    const revenuesList = [];
    
    if (type === 'day') {
      // 生成连续日期
      const currentDate = new Date(start);
      while (currentDate <= end) {
        const month = padStart(currentDate.getMonth() + 1, 2, '0');
        const day = padStart(currentDate.getDate(), 2, '0');
        const dateKey = `${day}/${month}`;
        
        dates.push(dateKey);
        const stats = dailyStats[dateKey] || { orders: 0, revenue: 0 };
        ordersList.push(stats.orders);
        revenuesList.push(stats.revenue / 100); // 转换为元
        
        currentDate.setDate(currentDate.getDate() + 1);
      }
    } else {
      // 按日期键排序
      const sortedKeys = Object.keys(dailyStats).sort();
      sortedKeys.forEach(key => {
        dates.push(key);
        ordersList.push(dailyStats[key].orders);
        revenuesList.push(dailyStats[key].revenue / 100); // 转换为元
      });
    }
    
    console.log('【销售图表】统计结果:', {
      datesCount: dates.length,
      ordersCount: ordersList.length,
      revenuesCount: revenuesList.length
    });
    
    return {
      code: 200,
      message: 'ok',
      data: {
        dates: dates,
        orders: ordersList,
        revenues: revenuesList
      }
    };
    
  } catch (error) {
    console.error('【销售图表】异常:', error);
    return {
      code: 500,
      message: '获取销售图表失败',
      error: error.message
    };
  }
}

/**
 * 获取销售趋势（折线图）
 * 返回：日期列表、趋势数据
 */
async function getSalesTrend(openid, data) {
  try {
    const { storeId, period = 'week', merchantId, sessionToken } = data;
    
    console.log('【销售趋势】参数:', { storeId, period, merchantId });
    
    // 优先使用传入的 storeId
    let targetStoreId = storeId;
    
    if (!targetStoreId) {
      const merchant = await resolveAuthorizedMerchant(openid, merchantId, sessionToken);
      if (merchant) {
        targetStoreId = merchant.storeId || merchant._id;
      } else if (merchantId) {
        return { code: 403, message: '无权操作该商家账号' };
      }
    }
    
    if (!targetStoreId) {
      return {
        code: 404,
        message: '店铺不存在'
      };
    }
    
    // 根据period计算时间范围
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    const start = new Date(end);
    
    if (period === 'week') {
      start.setDate(start.getDate() - 6); // 最近7天
    } else if (period === 'month') {
      start.setMonth(start.getMonth() - 1); // 最近1个月
    } else if (period === 'quarter') {
      start.setMonth(start.getMonth() - 3); // 最近3个月
    }
    start.setHours(0, 0, 0, 0);
    
    // 查询该时间范围内的所有已支付订单
    const ordersResult = await db.collection('orders')
      .where({
        storeId: targetStoreId,
        payStatus: 'paid',
        orderStatus: db.command.neq('cancelled'),
        createdAt: db.command.gte(start).and(db.command.lte(end))
      })
      .get();
    
    const orders = ordersResult.data;
    
    // 按日期分组统计
    const dailyStats = {};
    
    orders.forEach(order => {
      const orderDate = new Date(order.createdAt);
      const month = padStart(orderDate.getMonth() + 1, 2, '0');
      const day = padStart(orderDate.getDate(), 2, '0');
      const dateKey = `${day}/${month}`;
      
      if (!dailyStats[dateKey]) {
        dailyStats[dateKey] = 0;
      }
      
      dailyStats[dateKey] += (order.amountGoods || 0);
    });
    
    // 生成连续日期列表
    const dates = [];
    const trendData = [];
    
    const currentDate = new Date(start);
    while (currentDate <= end) {
      const month = padStart(currentDate.getMonth() + 1, 2, '0');
      const day = padStart(currentDate.getDate(), 2, '0');
      const dateKey = `${day}/${month}`;
      
      dates.push(dateKey);
      const revenue = (dailyStats[dateKey] || 0) / 100; // 转换为元
      trendData.push(revenue);
      
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    console.log('【销售趋势】统计结果:', {
      datesCount: dates.length,
      trendDataCount: trendData.length
    });
    
    return {
      code: 200,
      message: 'ok',
      data: {
        dates: dates,
        trendData: trendData
      }
    };
    
  } catch (error) {
    console.error('【销售趋势】异常:', error);
    return {
      code: 500,
      message: '获取销售趋势失败',
      error: error.message
    };
  }
}

// 辅助函数：获取周数
function getWeekNumber(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

/**
 * 获取管理端仪表板统计数据
 */
async function getDashboardStats(openid, data) {
  try {
    console.log('【管理端仪表板】开始计算统计数据');
    
    // 1. 获取基础统计数据
    const [
      totalRevenueResult,
      merchantCountResult,
      orderCountResult,
      userCountResult
    ] = await Promise.all([
      calculateTotalRevenue(),
      db.collection('merchants').count(),
      db.collection('orders').count(),
      db.collection('users').count()
    ]);
    
    const totalRevenue = totalRevenueResult;
    const merchantCount = merchantCountResult.total || 0;
    const orderCount = orderCountResult.total || 0;
    const userCount = userCountResult.total || 0;
    
    // 2. 计算增长率（今日 vs 昨日）
    const todayStats = await calculateTodayStats();
    const yesterdayStats = await calculateYesterdayStats();
    
    const revenueGrowth = calculateGrowthRate(todayStats.revenue, yesterdayStats.revenue);
    const orderGrowth = calculateGrowthRate(todayStats.orders, yesterdayStats.orders);
    const userGrowth = calculateGrowthRate(todayStats.newUsers, yesterdayStats.newUsers);
    const merchantGrowth = calculateGrowthRate(todayStats.newMerchants, yesterdayStats.newMerchants);
    
    // 3. 计算活跃用户
    const dailyActiveUsers = await calculateDailyActiveUsers();
    const monthlyActiveUsers = await calculateMonthlyActiveUsers();
    const yesterdayActiveUsers = await calculateYesterdayActiveUsers();
    const lastMonthActiveUsers = await calculateLastMonthActiveUsers();
    
    const dauGrowth = calculateGrowthRate(dailyActiveUsers, yesterdayActiveUsers);
    const mauGrowth = calculateGrowthRate(monthlyActiveUsers, lastMonthActiveUsers);
    
    // 4. 计算订单概况
    const orderStats = await calculateOrderStats();
    
    // 5. 计算平均订单金额（平均每个订单的平台服务费）
    // 今日平均订单金额
    const todayAvgOrderValue = todayStats.orders > 0 
      ? (todayStats.revenue / todayStats.orders) 
      : 0;
    // 昨日平均订单金额
    const yesterdayAvgOrderValue = yesterdayStats.orders > 0 
      ? (yesterdayStats.revenue / yesterdayStats.orders) 
      : 0;
    // 平均订单金额增长率
    const avgOrderGrowth = calculateGrowthRate(todayAvgOrderValue, yesterdayAvgOrderValue);
    // 总体平均订单金额（用于显示）
    const avgOrderValue = orderCount > 0 ? (totalRevenue / orderCount) : 0;
    
    // 6. 计算近7天收入趋势
    const revenueChart = await calculateRevenueChart();
    
    console.log('【管理端仪表板】统计数据计算完成');
    
    return {
      code: 200,
      message: 'ok',
      data: {
        // 核心数据
        totalRevenue: totalRevenue.toFixed(2),
        merchantCount: merchantCount,
        orderCount: orderCount,
        userCount: userCount,
        
        // 增长率
        revenueGrowth: revenueGrowth.toFixed(1),
        merchantGrowth: merchantGrowth.toFixed(1),
        orderGrowth: orderGrowth.toFixed(1),
        userGrowth: userGrowth.toFixed(1),
        
        // 活跃用户
        dailyActiveUsers: dailyActiveUsers,
        monthlyActiveUsers: monthlyActiveUsers,
        dauGrowth: dauGrowth.toFixed(1),
        mauGrowth: mauGrowth.toFixed(1),
        
        // 订单概况
        todayOrders: orderStats.todayOrders,
        todayIncome: todayStats.revenue.toFixed(2), // 今日营收（平台服务费）
        pendingOrders: orderStats.pendingOrders,
        completedOrders: orderStats.completedOrders,
        completionRate: orderStats.completionRate.toFixed(1),
        avgOrderValue: todayAvgOrderValue.toFixed(2), // 使用今日平均订单金额
        avgOrderGrowth: avgOrderGrowth.toFixed(1),
        
        // 收入趋势
        revenueChart: revenueChart
      }
    };
    
  } catch (error) {
    console.error('【管理端仪表板】异常:', error);
    return {
      code: 500,
      message: '获取仪表板数据失败',
      error: error.message
    };
  }
}

/**
 * 计算总营收（所有订单的平台服务费总和，扣除已完成的退款）
 */
async function calculateTotalRevenue() {
  try {
    const ordersResult = await db.collection('orders')
      .where({
        payStatus: 'paid',
        orderStatus: db.command.neq('cancelled')
      })
      .field({
        platformFee: true
      })
      .get();
    
    let totalRevenue = ordersResult.data.reduce((sum, order) => {
      let platformFee = order.platformFee || 0;
      // 如果金额大于1000，可能是以分存储的，转换为元
      if (platformFee > 1000) {
        platformFee = platformFee / 100;
      }
      return sum + platformFee;
    }, 0);
    
    // 扣除已同意或已完成的退款对应的平台服务费
    try {
      const completedRefundsResult = await db.collection('refunds')
        .where({
          status: db.command.in(['approved', 'completed']),
          processed: true
        })
        .get();
      
      if (completedRefundsResult.data && completedRefundsResult.data.length > 0) {
        let totalRefundPlatformFee = 0;
        completedRefundsResult.data.forEach(refund => {
          // 使用退款平台服务费（如果已计算），否则按比例计算
          if (refund.refundPlatformFee) {
            // 退款平台服务费（分），转换为元
            const refundPlatformFeeYuan = refund.refundPlatformFee / 100;
            totalRefundPlatformFee += refundPlatformFeeYuan;
          } else if (refund.refundAmount && refund.platformFeeRate) {
            // 如果没有计算，按退款金额和平台服务费比例计算
            const refundAmountYuan = parseFloat(refund.refundAmount) || 0;
            const platformFeeRate = refund.platformFeeRate || 0.08;
            const refundPlatformFeeYuan = refundAmountYuan * platformFeeRate;
            totalRefundPlatformFee += refundPlatformFeeYuan;
          }
        });
        
        // 扣除退款平台服务费
        totalRevenue = totalRevenue - totalRefundPlatformFee;
        
        console.log('【计算总营收】已扣除退款平台服务费:', {
          refundCount: completedRefundsResult.data.length,
          totalRefundPlatformFee: totalRefundPlatformFee,
          totalRevenueAfterRefund: totalRevenue
        });
      }
    } catch (error) {
      console.warn('【计算总营收】查询退款记录失败:', error);
      // 查询失败不影响主流程
    }
    
    if (totalRevenue < 0) {
      console.warn('【计算总营收】营收为负，已按0处理:', totalRevenue);
      totalRevenue = 0;
    }
    
    return totalRevenue;
  } catch (error) {
    console.error('【计算总营收】失败:', error);
    return 0;
  }
}

/**
 * 计算今日统计数据
 */
async function calculateTodayStats() {
  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0);
  const todayEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);
  
  try {
    // 今日营收
    const todayOrdersResult = await db.collection('orders')
      .where({
        payStatus: 'paid',
        orderStatus: db.command.neq('cancelled'),
        createdAt: db.command.gte(todayStart).and(db.command.lte(todayEnd))
      })
      .field({
        platformFee: true
      })
      .get();
    
    let todayRevenue = todayOrdersResult.data.reduce((sum, order) => {
      let platformFee = order.platformFee || 0;
      if (platformFee > 1000) {
        platformFee = platformFee / 100;
      }
      return sum + platformFee;
    }, 0);
    
    // 扣除今日同意或完成的退款对应的平台服务费
    try {
      const todayRefundsResult = await db.collection('refunds')
        .where({
          status: db.command.in(['approved', 'completed']),
          processed: true
        })
        .get();
      
      if (todayRefundsResult.data && todayRefundsResult.data.length > 0) {
        todayRefundsResult.data.forEach(refund => {
          // 使用 completedAt 或 approvedAt 作为退款时间
          const refundDate = refund.completedAt ? new Date(refund.completedAt) : (refund.approvedAt ? new Date(refund.approvedAt) : null);
          if (refundDate && refundDate >= todayStart && refundDate <= todayEnd) {
            if (refund.refundPlatformFee) {
              const refundPlatformFeeYuan = refund.refundPlatformFee / 100;
              todayRevenue = todayRevenue - refundPlatformFeeYuan;
            } else if (refund.refundAmount && refund.platformFeeRate) {
              const refundAmountYuan = parseFloat(refund.refundAmount) || 0;
              const platformFeeRate = refund.platformFeeRate || 0.08;
              const refundPlatformFeeYuan = refundAmountYuan * platformFeeRate;
              todayRevenue = todayRevenue - refundPlatformFeeYuan;
            }
          }
        });
      }
    } catch (error) {
      console.warn('【计算今日统计】查询退款记录失败:', error);
    }
    
    // 今日订单数
    const todayOrders = todayOrdersResult.data.length;
    
    // 今日新增用户
    const todayUsersResult = await db.collection('users')
      .where({
        createdAt: db.command.gte(todayStart).and(db.command.lte(todayEnd))
      })
      .count();
    
    const todayNewUsers = todayUsersResult.total || 0;
    
    // 今日新增商家
    const todayMerchantsResult = await db.collection('merchants')
      .where({
        createdAt: db.command.gte(todayStart).and(db.command.lte(todayEnd))
      })
      .count();
    
    const todayNewMerchants = todayMerchantsResult.total || 0;
    
    if (todayRevenue < 0) {
      console.warn('【计算今日统计】今日营收为负，已按0处理:', todayRevenue);
      todayRevenue = 0;
    }
    
    return {
      revenue: todayRevenue,
      orders: todayOrders,
      newUsers: todayNewUsers,
      newMerchants: todayNewMerchants
    };
  } catch (error) {
    console.error('【计算今日统计】失败:', error);
    return { revenue: 0, orders: 0, newUsers: 0, newMerchants: 0 };
  }
}

/**
 * 计算昨日统计数据
 */
async function calculateYesterdayStats() {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStart = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 0, 0, 0);
  const yesterdayEnd = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 23, 59, 59);
  
  try {
    // 昨日营收
    const yesterdayOrdersResult = await db.collection('orders')
      .where({
        payStatus: 'paid',
        orderStatus: db.command.neq('cancelled'),
        createdAt: db.command.gte(yesterdayStart).and(db.command.lte(yesterdayEnd))
      })
      .field({
        platformFee: true
      })
      .get();
    
    let yesterdayRevenue = yesterdayOrdersResult.data.reduce((sum, order) => {
      let platformFee = order.platformFee || 0;
      if (platformFee > 1000) {
        platformFee = platformFee / 100;
      }
      return sum + platformFee;
    }, 0);
    
    // 扣除昨日同意或完成的退款对应的平台服务费
    try {
      const yesterdayRefundsResult = await db.collection('refunds')
        .where({
          status: db.command.in(['approved', 'completed']),
          processed: true
        })
        .get();
      
      if (yesterdayRefundsResult.data && yesterdayRefundsResult.data.length > 0) {
        yesterdayRefundsResult.data.forEach(refund => {
          // 使用 completedAt 或 approvedAt 作为退款时间
          const refundDate = refund.completedAt ? new Date(refund.completedAt) : (refund.approvedAt ? new Date(refund.approvedAt) : null);
          if (refundDate && refundDate >= yesterdayStart && refundDate <= yesterdayEnd) {
            if (refund.refundPlatformFee) {
              const refundPlatformFeeYuan = refund.refundPlatformFee / 100;
              yesterdayRevenue = yesterdayRevenue - refundPlatformFeeYuan;
            } else if (refund.refundAmount && refund.platformFeeRate) {
              const refundAmountYuan = parseFloat(refund.refundAmount) || 0;
              const platformFeeRate = refund.platformFeeRate || 0.08;
              const refundPlatformFeeYuan = refundAmountYuan * platformFeeRate;
              yesterdayRevenue = yesterdayRevenue - refundPlatformFeeYuan;
            }
          }
        });
      }
    } catch (error) {
      console.warn('【计算昨日统计】查询退款记录失败:', error);
    }
    
    // 昨日订单数
    const yesterdayOrders = yesterdayOrdersResult.data.length;
    
    // 昨日新增用户
    const yesterdayUsersResult = await db.collection('users')
      .where({
        createdAt: db.command.gte(yesterdayStart).and(db.command.lte(yesterdayEnd))
      })
      .count();
    
    const yesterdayNewUsers = yesterdayUsersResult.total || 0;
    
    // 昨日新增商家
    const yesterdayMerchantsResult = await db.collection('merchants')
      .where({
        createdAt: db.command.gte(yesterdayStart).and(db.command.lte(yesterdayEnd))
      })
      .count();
    
    const yesterdayNewMerchants = yesterdayMerchantsResult.total || 0;
    
    if (yesterdayRevenue < 0) {
      console.warn('【计算昨日统计】昨日营收为负，已按0处理:', yesterdayRevenue);
      yesterdayRevenue = 0;
    }
    
    return {
      revenue: yesterdayRevenue,
      orders: yesterdayOrders,
      newUsers: yesterdayNewUsers,
      newMerchants: yesterdayNewMerchants
    };
  } catch (error) {
    console.error('【计算昨日统计】失败:', error);
    return { revenue: 0, orders: 0, newUsers: 0, newMerchants: 0 };
  }
}

/**
 * 计算增长率
 */
function calculateGrowthRate(current, previous) {
  if (previous === 0) {
    return current > 0 ? 100 : 0;
  }
  return ((current - previous) / previous) * 100;
}

/**
 * 计算日活跃用户（今日有下单的用户）
 */
async function calculateDailyActiveUsers() {
  try {
    const today = new Date();
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0);
    const todayEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);
    
    const todayOrdersResult = await db.collection('orders')
      .where({
        payStatus: 'paid',
        createdAt: db.command.gte(todayStart).and(db.command.lte(todayEnd))
      })
      .field({
        userId: true
      })
      .get();
    
    const uniqueUsers = new Set(todayOrdersResult.data.map(order => order.userId).filter(id => id));
    return uniqueUsers.size;
  } catch (error) {
    console.error('【计算日活跃用户】失败:', error);
    return 0;
  }
}

/**
 * 计算昨日活跃用户
 */
async function calculateYesterdayActiveUsers() {
  try {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStart = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 0, 0, 0);
    const yesterdayEnd = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 23, 59, 59);
    
    const yesterdayOrdersResult = await db.collection('orders')
      .where({
        payStatus: 'paid',
        createdAt: db.command.gte(yesterdayStart).and(db.command.lte(yesterdayEnd))
      })
      .field({
        userId: true
      })
      .get();
    
    const uniqueUsers = new Set(yesterdayOrdersResult.data.map(order => order.userId).filter(id => id));
    return uniqueUsers.size;
  } catch (error) {
    console.error('【计算昨日活跃用户】失败:', error);
    return 0;
  }
}

/**
 * 计算月活跃用户（本月有下单的用户）
 */
async function calculateMonthlyActiveUsers() {
  try {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    
    const monthOrdersResult = await db.collection('orders')
      .where({
        payStatus: 'paid',
        createdAt: db.command.gte(monthStart).and(db.command.lte(monthEnd))
      })
      .field({
        userId: true
      })
      .get();
    
    const uniqueUsers = new Set(monthOrdersResult.data.map(order => order.userId).filter(id => id));
    return uniqueUsers.size;
  } catch (error) {
    console.error('【计算月活跃用户】失败:', error);
    return 0;
  }
}

/**
 * 计算上月活跃用户
 */
async function calculateLastMonthActiveUsers() {
  try {
    const now = new Date();
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthStart = new Date(lastMonth.getFullYear(), lastMonth.getMonth(), 1, 0, 0, 0);
    const lastMonthEnd = new Date(lastMonth.getFullYear(), lastMonth.getMonth() + 1, 0, 23, 59, 59);
    
    const lastMonthOrdersResult = await db.collection('orders')
      .where({
        payStatus: 'paid',
        createdAt: db.command.gte(lastMonthStart).and(db.command.lte(lastMonthEnd))
      })
      .field({
        userId: true
      })
      .get();
    
    const uniqueUsers = new Set(lastMonthOrdersResult.data.map(order => order.userId).filter(id => id));
    return uniqueUsers.size;
  } catch (error) {
    console.error('【计算上月活跃用户】失败:', error);
    return 0;
  }
}

/**
 * 计算订单概况
 */
async function calculateOrderStats() {
  try {
    // 今日订单数
    const today = new Date();
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0);
    const todayEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);
    
    const todayOrdersResult = await db.collection('orders')
      .where({
        createdAt: db.command.gte(todayStart).and(db.command.lte(todayEnd))
      })
      .count();
    
    const todayOrders = todayOrdersResult.total || 0;
    
    // 待处理订单数（pending 或 confirmed）
    const pendingOrdersResult = await db.collection('orders')
      .where({
        orderStatus: db.command.in(['pending', 'confirmed']),
        payStatus: 'paid'
      })
      .count();
    
    const pendingOrders = pendingOrdersResult.total || 0;
    
    // 已完成订单数
    const completedOrdersResult = await db.collection('orders')
      .where({
        orderStatus: 'completed',
        payStatus: 'paid'
      })
      .count();
    
    const completedOrders = completedOrdersResult.total || 0;
    
    // 总订单数
    const totalOrdersResult = await db.collection('orders')
      .where({
        payStatus: 'paid'
      })
      .count();
    
    const totalOrders = totalOrdersResult.total || 0;
    
    // 完成率
    const completionRate = totalOrders > 0 ? (completedOrders / totalOrders) * 100 : 0;
    
    return {
      todayOrders: todayOrders,
      pendingOrders: pendingOrders,
      completedOrders: completedOrders,
      completionRate: completionRate
    };
  } catch (error) {
    console.error('【计算订单概况】失败:', error);
    return {
      todayOrders: 0,
      pendingOrders: 0,
      completedOrders: 0,
      completionRate: 0
    };
  }
}

/**
 * 计算近7天收入趋势
 */
async function calculateRevenueChart() {
  try {
    const chartData = [];
    const now = new Date();
    const weekDays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    
    // 计算每天的收入
    const dailyRevenues = [];
    
    for (let i = 6; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0);
      const dayEnd = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59);
      
      const dayOrdersResult = await db.collection('orders')
        .where({
          payStatus: 'paid',
          orderStatus: db.command.neq('cancelled'),
          createdAt: db.command.gte(dayStart).and(db.command.lte(dayEnd))
        })
        .field({
          platformFee: true
        })
        .get();
      
      const dayRevenue = dayOrdersResult.data.reduce((sum, order) => {
        let platformFee = order.platformFee || 0;
        if (platformFee > 1000) {
          platformFee = platformFee / 100;
        }
        return sum + platformFee;
      }, 0);
      
      dailyRevenues.push(dayRevenue < 0 ? 0 : dayRevenue);
    }
    
    // 找出最大值用于计算高度
    const maxRevenue = Math.max.apply(null, dailyRevenues.concat(1)); // 至少为1，避免除0
    
    // 格式化图表数据
    for (let i = 6; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dayOfWeek = date.getDay();
      const revenue = dailyRevenues[6 - i];
      
      chartData.push({
        label: weekDays[dayOfWeek],
        value: revenue.toFixed(2),
        height: Math.round((revenue / maxRevenue) * 100) // 最大高度100
      });
    }
    
    return chartData;
  } catch (error) {
    console.error('【计算收入趋势】失败:', error);
    // 返回默认数据
    return [
      { label: '周一', value: '0.00', height: 0 },
      { label: '周二', value: '0.00', height: 0 },
      { label: '周三', value: '0.00', height: 0 },
      { label: '周四', value: '0.00', height: 0 },
      { label: '周五', value: '0.00', height: 0 },
      { label: '周六', value: '0.00', height: 0 },
      { label: '周日', value: '0.00', height: 0 }
    ];
  }
}

/**
 * 获取账户余额（工作台使用）
 * 返回：账户余额、最新收益、总收益
 * 与销售统计数据保持一致
 */
async function getAccountBalance(openid, data) {
  try {
    const { merchantId, sessionToken } = data || {};
    console.log('【账户余额】参数:', { merchantId });
    
    const merchantInfo = await resolveAuthorizedMerchant(openid, merchantId, sessionToken);
    if (!merchantInfo) {
      return {
        code: merchantId ? 403 : 404,
        message: merchantId ? '无权操作该商家账号' : '商家不存在'
      };
    }
    
    const targetStoreId = merchantInfo.storeId || merchantInfo._id;
    
    if (!targetStoreId) {
      return {
        code: 404,
        message: '店铺不存在'
      };
    }
    
    // 1. 查询所有已支付订单（总收益）
    const allOrdersResult = await db.collection('orders')
      .where({
        storeId: targetStoreId,
        payStatus: 'paid',
        orderStatus: db.command.neq('cancelled')
      })
      .get();
    
    const allOrders = allOrdersResult.data;
    
    // 计算总收益（所有订单的商品金额总和，单位：分）
    let totalRevenue = allOrders.reduce((sum, order) => sum + (order.amountGoods || 0), 0);
    
    // 2. 查询已同意或已完成的退款，扣除退款金额
    try {
      const completedRefundsResult = await db.collection('refunds')
        .where({
          storeId: targetStoreId,
          status: db.command.in(['approved', 'completed']),
          processed: true
        })
        .get();
      
      if (completedRefundsResult.data && completedRefundsResult.data.length > 0) {
        let totalRefundAmount = 0;
        completedRefundsResult.data.forEach(refund => {
          // 使用退款商品金额（如果已计算），否则使用退款金额
          const refundGoodsAmount = refund.refundGoodsAmount || (refund.refundAmount ? Math.round(refund.refundAmount * 100) : 0);
          totalRefundAmount += refundGoodsAmount;
        });
        
        // 扣除退款金额
        totalRevenue = totalRevenue - totalRefundAmount;
        
        console.log('【账户余额】已扣除退款金额:', {
          refundCount: completedRefundsResult.data.length,
          totalRefundAmount: totalRefundAmount,
          totalRevenueAfterRefund: totalRevenue
        });
      }
    } catch (error) {
      console.warn('【账户余额】查询退款记录失败:', error);
      // 查询失败不影响主流程
    }
    
    // 3. 计算当前月的收益（最新收益）
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    
    const currentMonthStart = new Date(currentYear, currentMonth - 1, 1);
    const currentMonthEnd = new Date(currentYear, currentMonth, 0, 23, 59, 59);
    
    const currentMonthOrders = allOrders.filter(order => {
      const orderDate = new Date(order.createdAt);
      return orderDate >= currentMonthStart && orderDate <= currentMonthEnd;
    });
    
    let latestRevenue = currentMonthOrders.reduce((sum, order) => sum + (order.amountGoods || 0), 0);
    
    // 扣除当前月的退款金额
    try {
      const currentMonthRefundsResult = await db.collection('refunds')
        .where({
          storeId: targetStoreId,
          status: db.command.in(['approved', 'completed']),
          processed: true
        })
        .get();
      
      if (currentMonthRefundsResult.data && currentMonthRefundsResult.data.length > 0) {
        currentMonthRefundsResult.data.forEach(refund => {
          // 使用 completedAt 或 approvedAt 作为退款时间
          const refundDate = refund.completedAt ? new Date(refund.completedAt) : (refund.approvedAt ? new Date(refund.approvedAt) : null);
          if (refundDate && refundDate >= currentMonthStart && refundDate <= currentMonthEnd) {
            const refundGoodsAmount = refund.refundGoodsAmount || (refund.refundAmount ? Math.round(refund.refundAmount * 100) : 0);
            latestRevenue = latestRevenue - refundGoodsAmount;
          }
        });
      }
    } catch (error) {
      console.warn('【账户余额】查询当前月退款记录失败:', error);
    }
    
    // 4. 查询已提现金额（如果有提现记录表）
    let totalWithdrawn = 0;
    try {
      // 查询提现记录（假设有withdrawals集合）
      const withdrawalsResult = await db.collection('withdrawals')
        .where({
          merchantId: merchantInfo._id,
          status: 'success' // 只统计已成功的提现
        })
        .get();
      
      if (withdrawalsResult.data && withdrawalsResult.data.length > 0) {
        totalWithdrawn = withdrawalsResult.data.reduce((sum, withdrawal) => {
          return sum + (withdrawal.amount || 0); // 提现金额单位：分
        }, 0);
      }
    } catch (error) {
      // 如果没有提现记录表，totalWithdrawn保持为0
      console.log('【账户余额】未找到提现记录表，使用默认值0');
    }
    
    // 5. 计算账户余额（总收益 - 已提现金额）
    const accountBalance = totalRevenue - totalWithdrawn;
    
    // 转换为元（订单金额存储为分）
    const accountBalanceYuan = (accountBalance / 100).toFixed(2);
    const latestRevenueYuan = (latestRevenue / 100).toFixed(2);
    const totalRevenueYuan = (totalRevenue / 100).toFixed(2);
    
    console.log('【账户余额】统计结果:', {
      accountBalance: accountBalanceYuan,
      latestRevenue: latestRevenueYuan,
      totalRevenue: totalRevenueYuan,
      totalWithdrawn: (totalWithdrawn / 100).toFixed(2)
    });
    
    return {
      code: 200,
      message: 'ok',
      data: {
        accountBalance: parseFloat(accountBalanceYuan), // 账户余额（元）
        latestRevenue: parseFloat(latestRevenueYuan), // 最新收益（当前月收益，元）
        totalRevenue: parseFloat(totalRevenueYuan) // 总收益（所有时间收益，元）
      }
    };
    
  } catch (error) {
    console.error('【账户余额】异常:', error);
    return {
      code: 500,
      message: '获取账户余额失败',
      error: error.message
    };
  }
}

/**
 * 获取管理端数据概览统计
 * 支持日期范围筛选：week（近一周）、month（近一月）、quarter（近三月）
 * 与数据概况页面保持数据一致
 */
async function getAdminOverviewStats(openid, data) {
  try {
    const { dateRange = 'week' } = data;
    
    console.log('【管理端数据概览】参数:', { dateRange });
    
    // 使用与getDashboardStats相同的计算逻辑
    
    // 1. 获取基础统计数据
    const [
      totalRevenueResult,
      merchantCountResult,
      orderCountResult,
      userCountResult
    ] = await Promise.all([
      calculateTotalRevenue(),
      db.collection('merchants').count(),
      db.collection('orders').count(),
      db.collection('users').count()
    ]);
    
    const totalRevenue = totalRevenueResult;
    const merchantCount = merchantCountResult.total || 0;
    const orderCount = orderCountResult.total || 0;
    const userCount = userCountResult.total || 0;
    
    // 2. 计算增长率（今日 vs 昨日）
    const todayStats = await calculateTodayStats();
    const yesterdayStats = await calculateYesterdayStats();
    
    const revenueGrowth = calculateGrowthRate(todayStats.revenue, yesterdayStats.revenue);
    const orderGrowth = calculateGrowthRate(todayStats.orders, yesterdayStats.orders);
    const userGrowth = calculateGrowthRate(todayStats.newUsers, yesterdayStats.newUsers);
    const merchantGrowth = calculateGrowthRate(todayStats.newMerchants, yesterdayStats.newMerchants);
    
    // 3. 计算活跃用户
    const dailyActiveUsers = await calculateDailyActiveUsers();
    const monthlyActiveUsers = await calculateMonthlyActiveUsers();
    const yesterdayActiveUsers = await calculateYesterdayActiveUsers();
    const lastMonthActiveUsers = await calculateLastMonthActiveUsers();
    
    const dauGrowth = calculateGrowthRate(dailyActiveUsers, yesterdayActiveUsers);
    const mauGrowth = calculateGrowthRate(monthlyActiveUsers, lastMonthActiveUsers);
    
    // 4. 计算订单概况
    const orderStats = await calculateOrderStats();
    
    // 5. 计算平均订单金额
    const todayAvgOrderValue = todayStats.orders > 0 
      ? (todayStats.revenue / todayStats.orders) 
      : 0;
    const yesterdayAvgOrderValue = yesterdayStats.orders > 0 
      ? (yesterdayStats.revenue / yesterdayStats.orders) 
      : 0;
    const avgOrderGrowth = calculateGrowthRate(todayAvgOrderValue, yesterdayAvgOrderValue);
    
    console.log('【管理端数据概览】统计结果:', {
      totalRevenue: totalRevenue.toFixed(2),
      merchantCount,
      orderCount,
      userCount,
      todayOrderCount: orderStats.todayOrders,
      todayIncome: todayStats.revenue.toFixed(2),
      revenueGrowth: revenueGrowth.toFixed(1),
      merchantGrowth: merchantGrowth.toFixed(1),
      orderGrowth: orderGrowth.toFixed(1),
      userGrowth: userGrowth.toFixed(1),
      dailyActiveUsers,
      monthlyActiveUsers,
      completionRate: orderStats.completionRate.toFixed(1),
      avgOrderValue: todayAvgOrderValue.toFixed(2)
    });
    
    return {
      code: 200,
      message: 'ok',
      data: {
        // 基础数据（与数据概况页面一致）
        totalRevenue: totalRevenue.toFixed(2),
        merchantCount: merchantCount,
        orderCount: orderCount,
        userCount: userCount,
        
        // 今日数据
        todayOrderCount: orderStats.todayOrders,
        todayIncome: todayStats.revenue.toFixed(2),
        
        // 增长率
        revenueGrowth: revenueGrowth.toFixed(1),
        merchantGrowth: merchantGrowth.toFixed(1),
        orderGrowth: orderGrowth.toFixed(1),
        userGrowth: userGrowth.toFixed(1),
        
        // 活跃用户
        dailyActiveUsers: dailyActiveUsers,
        monthlyActiveUsers: monthlyActiveUsers,
        dauGrowth: dauGrowth.toFixed(1),
        mauGrowth: mauGrowth.toFixed(1),
        
        // 订单概况
        pendingOrders: orderStats.pendingOrders,
        completedOrders: orderStats.completedOrders,
        completionRate: orderStats.completionRate.toFixed(1),
        avgOrderValue: todayAvgOrderValue.toFixed(2),
        avgOrderGrowth: avgOrderGrowth.toFixed(1)
      }
    };
    
  } catch (error) {
    console.error('【管理端数据概览】异常:', error);
    return {
      code: 500,
      message: '获取数据概览失败',
      error: error.message
    };
  }
}

/**
 * 获取管理端订单统计
 * 支持日期范围筛选，包含订单状态分布和趋势图数据
 */
async function getAdminOrderStats(openid, data) {
  try {
    const { dateRange = 'week' } = data;
    
    console.log('【管理端订单统计】参数:', { dateRange });
    
    // 计算时间范围
    const now = new Date();
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
    const start = new Date(end);
    
    if (dateRange === 'week') {
      start.setDate(start.getDate() - 6); // 近7天
    } else if (dateRange === 'month') {
      start.setMonth(start.getMonth() - 1); // 近1个月
    } else if (dateRange === 'quarter') {
      start.setMonth(start.getMonth() - 3); // 近3个月
    }
    start.setHours(0, 0, 0, 0);
    
    // 查询该时间范围内的所有订单
    const ordersResult = await db.collection('orders')
      .where({
        createdAt: db.command.gte(start).and(db.command.lte(end))
      })
      .get();
    
    const orders = ordersResult.data;
    
    // 统计订单状态分布
    const totalOrders = orders.length;
    const cancelledOrders = orders.filter(o => o.orderStatus === 'cancelled').length;
    
    // 计算总营收（平台服务费）- 只统计已支付且未取消的订单
    const paidOrders = orders.filter(o => o.payStatus === 'paid' && o.orderStatus !== 'cancelled');
    const paidOrdersCount = paidOrders.length;
    
    const totalRevenue = paidOrders.reduce((sum, order) => {
      let platformFee = order.platformFee || 0;
      if (platformFee > 1000) {
        platformFee = platformFee / 100;
      }
      return sum + platformFee;
    }, 0);
    
    // 计算完成率（基于已支付订单）
    const paidCompletedOrders = paidOrders.filter(o => o.orderStatus === 'completed').length;
    const completionRate = paidOrdersCount > 0 ? (paidCompletedOrders / paidOrdersCount) * 100 : 0;
    
    // 计算平均订单金额（商品金额，不是平台服务费）
    const totalGoodsAmount = paidOrders.reduce((sum, order) => {
      let amountGoods = order.amountGoods || 0;
      if (amountGoods > 1000) {
        amountGoods = amountGoods / 100;
      }
      return sum + amountGoods;
    }, 0);
    const avgOrderValue = paidOrdersCount > 0 ? (totalGoodsAmount / paidOrdersCount) : 0;
    
    // 统计订单状态分布（基于已支付订单重新计算）
    const paidCompletedOrdersCount = paidCompletedOrders;
    const paidPendingOrdersCount = paidOrders.filter(o => o.orderStatus === 'pending' || o.orderStatus === 'confirmed').length;
    
    console.log('【管理端订单统计】统计结果:', {
      totalOrders,
      paidOrdersCount,
      paidCompletedOrdersCount,
      paidPendingOrdersCount,
      cancelledOrders,
      totalRevenue: totalRevenue.toFixed(2),
      completionRate: completionRate.toFixed(1),
      avgOrderValue: avgOrderValue.toFixed(2),
      totalGoodsAmount: totalGoodsAmount.toFixed(2)
    });
    
    // 订单金额分布（0-50元、50-100元、100-200元、200-500元、500元以上）
    const amountDistribution = {
      '0-50': 0,
      '50-100': 0,
      '100-200': 0,
      '200-500': 0,
      '500+': 0
    };
    
    paidOrders.forEach(order => {
      let amountGoods = order.amountGoods || 0;
      if (amountGoods > 1000) {
        amountGoods = amountGoods / 100;
      }
      
      if (amountGoods < 50) {
        amountDistribution['0-50']++;
      } else if (amountGoods < 100) {
        amountDistribution['50-100']++;
      } else if (amountGoods < 200) {
        amountDistribution['100-200']++;
      } else if (amountGoods < 500) {
        amountDistribution['200-500']++;
      } else {
        amountDistribution['500+']++;
      }
    });
    
    // 订单时段分布（早餐6-10点、午餐10-14点、下午茶14-17点、晚餐17-21点、夜宵21-24点）
    const timeDistribution = {
      '早餐': 0,
      '午餐': 0,
      '下午茶': 0,
      '晚餐': 0,
      '夜宵': 0
    };
    
    orders.forEach(order => {
      const orderDate = new Date(order.createdAt);
      const hour = orderDate.getHours();
      
      if (hour >= 6 && hour < 10) {
        timeDistribution['早餐']++;
      } else if (hour >= 10 && hour < 14) {
        timeDistribution['午餐']++;
      } else if (hour >= 14 && hour < 17) {
        timeDistribution['下午茶']++;
      } else if (hour >= 17 && hour < 21) {
        timeDistribution['晚餐']++;
      } else {
        timeDistribution['夜宵']++;
      }
    });
    
    // 生成订单趋势图数据（按天统计）
    const dailyStats = {};
    orders.forEach(order => {
      const orderDate = new Date(order.createdAt);
      const dateKey = `${orderDate.getMonth() + 1}/${orderDate.getDate()}`;
      
      if (!dailyStats[dateKey]) {
        dailyStats[dateKey] = {
          orders: 0,
          revenue: 0
        };
      }
      
      dailyStats[dateKey].orders += 1;
      
      if (order.payStatus === 'paid' && order.orderStatus !== 'cancelled') {
        let platformFee = order.platformFee || 0;
        if (platformFee > 1000) {
          platformFee = platformFee / 100;
        }
        dailyStats[dateKey].revenue += platformFee;
      }
    });
    
    // 生成连续的日期列表
    const dates = [];
    const ordersList = [];
    const revenuesList = [];
    
    const currentDate = new Date(start);
    while (currentDate <= end) {
      const dateKey = `${currentDate.getMonth() + 1}/${currentDate.getDate()}`;
      dates.push(dateKey);
      
      const stats = dailyStats[dateKey] || { orders: 0, revenue: 0 };
      ordersList.push(stats.orders);
      revenuesList.push(stats.revenue);
      
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    return {
      code: 200,
      message: 'ok',
      data: {
        totalOrders: totalOrders, // 选定时间范围内的所有订单数
        completedOrders: paidCompletedOrdersCount, // 已支付且已完成的订单数
        pendingOrders: paidPendingOrdersCount, // 已支付且待处理的订单数
        cancelledOrders: cancelledOrders, // 已取消的订单数
        totalRevenue: parseFloat(totalRevenue.toFixed(2)), // 选定时间范围内的平台服务费总和（返回数字类型）
        completionRate: parseFloat(completionRate.toFixed(1)), // 完成率：已完成订单数 / 已支付订单数（返回数字类型）
        avgOrderValue: parseFloat(avgOrderValue.toFixed(2)), // 平均订单金额：商品金额的平均值（返回数字类型）
        amountDistribution: amountDistribution, // 订单金额分布
        timeDistribution: timeDistribution, // 订单时段分布
        chartData: {
          dates: dates,
          orders: ordersList,
          revenue: revenuesList
        }
      }
    };
    
  } catch (error) {
    console.error('【管理端订单统计】异常:', error);
    return {
      code: 500,
      message: '获取订单统计失败',
      error: error.message
    };
  }
}

/**
 * 获取管理端用户统计
 * 支持日期范围筛选，包含用户增长趋势和活跃度数据
 */
async function getAdminUserStats(openid, data) {
  try {
    const { dateRange = 'week' } = data;
    
    console.log('【管理端用户统计】参数:', { dateRange });
    
    // 计算时间范围
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
    
    const weekStart = new Date(now);
    weekStart.setDate(weekStart.getDate() - 6);
    weekStart.setHours(0, 0, 0, 0);
    
    // 用户总数（所有时间）
    const userCountResult = await db.collection('users').count();
    const totalUsers = userCountResult.total || 0;
    
    // 计算日期范围用于活跃用户统计
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
    const start = new Date(end);
    
    if (dateRange === 'week') {
      start.setDate(start.getDate() - 6);
    } else if (dateRange === 'month') {
      start.setMonth(start.getMonth() - 1);
    } else if (dateRange === 'quarter') {
      start.setMonth(start.getMonth() - 3);
    }
    start.setHours(0, 0, 0, 0);
    
    // 活跃用户（有下单的用户）
    const activeUsersResult = await db.collection('orders')
      .where({
        payStatus: 'paid',
        createdAt: db.command.gte(start).and(db.command.lte(end))
      })
      .field({
        userId: true
      })
      .get();
    
    const uniqueUsers = new Set(activeUsersResult.data.map(order => order.userId).filter(id => id));
    const activeUsers = uniqueUsers.size;
    
    // 今日新增用户
    const todayUsersResult = await db.collection('users')
      .where({
        createdAt: db.command.gte(todayStart).and(db.command.lte(todayEnd))
      })
      .count();
    const newUsersToday = todayUsersResult.total || 0;
    
    // 本周新增用户
    const weekUsersResult = await db.collection('users')
      .where({
        createdAt: db.command.gte(weekStart).and(db.command.lte(todayEnd))
      })
      .count();
    const newUsersThisWeek = weekUsersResult.total || 0;
    
    // 查询所有已支付订单，用于用户统计
    const allOrdersResult = await db.collection('orders')
      .where({
        payStatus: 'paid',
        orderStatus: db.command.neq('cancelled')
      })
      .field({
        userId: true,
        amountGoods: true
      })
      .get();
    
    // 计算每个用户的订单数和消费金额
    const userStatsMap = {};
    allOrdersResult.data.forEach(order => {
      if (!order.userId) return;
      
      if (!userStatsMap[order.userId]) {
        userStatsMap[order.userId] = {
          orderCount: 0,
          totalAmount: 0
        };
      }
      
      userStatsMap[order.userId].orderCount++;
      let amountGoods = order.amountGoods || 0;
      if (amountGoods > 1000) {
        amountGoods = amountGoods / 100;
      }
      userStatsMap[order.userId].totalAmount += amountGoods;
    });
    
    // 生成用户排行榜（TOP 10，按订单数排序）
    const userRanking = Object.keys(userStatsMap)
      .map(userId => ({
        userId: userId,
        orderCount: userStatsMap[userId].orderCount,
        totalAmount: userStatsMap[userId].totalAmount.toFixed(2)
      }))
      .sort((a, b) => b.orderCount - a.orderCount)
      .slice(0, 10);
    
    // 用户订单数分布（1单、2-5单、6-10单、11-20单、20+单）
    const orderCountDistribution = {
      '1单': 0,
      '2-5单': 0,
      '6-10单': 0,
      '11-20单': 0,
      '20+单': 0
    };
    
    Object.values(userStatsMap).forEach(stats => {
      const count = stats.orderCount;
      if (count === 1) {
        orderCountDistribution['1单']++;
      } else if (count <= 5) {
        orderCountDistribution['2-5单']++;
      } else if (count <= 10) {
        orderCountDistribution['6-10单']++;
      } else if (count <= 20) {
        orderCountDistribution['11-20单']++;
      } else {
        orderCountDistribution['20+单']++;
      }
    });
    
    // 用户消费金额分布（0-100元、100-500元、500-1000元、1000-5000元、5000+元）
    const amountDistribution = {
      '0-100': 0,
      '100-500': 0,
      '500-1000': 0,
      '1000-5000': 0,
      '5000+': 0
    };
    
    Object.values(userStatsMap).forEach(stats => {
      const amount = stats.totalAmount;
      if (amount < 100) {
        amountDistribution['0-100']++;
      } else if (amount < 500) {
        amountDistribution['100-500']++;
      } else if (amount < 1000) {
        amountDistribution['500-1000']++;
      } else if (amount < 5000) {
        amountDistribution['1000-5000']++;
      } else {
        amountDistribution['5000+']++;
      }
    });
    
    // 生成用户增长趋势图数据（按天统计新增用户数）
    const dailyStats = {};
    const allUsersResult = await db.collection('users')
      .where({
        createdAt: db.command.gte(start).and(db.command.lte(end))
      })
      .field({
        createdAt: true
      })
      .get();
    
    allUsersResult.data.forEach(user => {
      const userDate = new Date(user.createdAt);
      const dateKey = `${userDate.getMonth() + 1}/${userDate.getDate()}`;
      
      if (!dailyStats[dateKey]) {
        dailyStats[dateKey] = {
          users: 0,
          activeUsers: 0
        };
      }
      
      dailyStats[dateKey].users += 1;
    });
    
    // 生成活跃用户趋势（按天统计）
    const dailyActiveStats = {};
    const dailyOrdersResult = await db.collection('orders')
      .where({
        payStatus: 'paid',
        createdAt: db.command.gte(start).and(db.command.lte(end))
      })
      .field({
        userId: true,
        createdAt: true
      })
      .get();
    
    const dailyActiveUsersSet = {};
    dailyOrdersResult.data.forEach(order => {
      if (!order.userId) return;
      const orderDate = new Date(order.createdAt);
      const dateKey = `${orderDate.getMonth() + 1}/${orderDate.getDate()}`;
      
      if (!dailyActiveUsersSet[dateKey]) {
        dailyActiveUsersSet[dateKey] = new Set();
      }
      dailyActiveUsersSet[dateKey].add(order.userId);
    });
    
    Object.keys(dailyActiveUsersSet).forEach(dateKey => {
      dailyStats[dateKey] = dailyStats[dateKey] || { users: 0, activeUsers: 0 };
      dailyStats[dateKey].activeUsers = dailyActiveUsersSet[dateKey].size;
    });
    
    // 生成连续的日期列表
    const dates = [];
    const usersList = [];
    const activeUsersList = [];
    
    const currentDate = new Date(start);
    while (currentDate <= end) {
      const dateKey = `${currentDate.getMonth() + 1}/${currentDate.getDate()}`;
      dates.push(dateKey);
      
      const stats = dailyStats[dateKey] || { users: 0, activeUsers: 0 };
      usersList.push(stats.users);
      activeUsersList.push(stats.activeUsers);
      
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    console.log('【管理端用户统计】统计结果:', {
      totalUsers,
      activeUsers,
      newUsersToday,
      newUsersThisWeek,
      userRankingCount: userRanking.length,
      orderCountDistribution,
      amountDistribution
    });
    
    return {
      code: 200,
      message: 'ok',
      data: {
        totalUsers: totalUsers,
        activeUsers: activeUsers,
        newUsersToday: newUsersToday,
        newUsersThisWeek: newUsersThisWeek,
        userRanking: userRanking,
        orderCountDistribution: orderCountDistribution,
        amountDistribution: amountDistribution,
        chartData: {
          dates: dates,
          users: usersList,
          activeUsers: activeUsersList
        }
      }
    };
    
  } catch (error) {
    console.error('【管理端用户统计】异常:', error);
    return {
      code: 500,
      message: '获取用户统计失败',
      error: error.message
    };
  }
}

/**
 * 获取管理端商家统计
 * 包含商家状态分布和增长趋势数据
 */
async function getAdminMerchantStats(openid, data) {
  try {
    const { dateRange = 'week' } = data;
    
    console.log('【管理端商家统计】参数:', { dateRange });
    
    // 计算时间范围
    const now = new Date();
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
    const start = new Date(end);
    
    if (dateRange === 'week') {
      start.setDate(start.getDate() - 6);
    } else if (dateRange === 'month') {
      start.setMonth(start.getMonth() - 1);
    } else if (dateRange === 'quarter') {
      start.setMonth(start.getMonth() - 3);
    }
    start.setHours(0, 0, 0, 0);
    
    // 总商家数
    const merchantCountResult = await db.collection('merchants').count();
    const totalMerchants = merchantCountResult.total || 0;
    
    // 查询所有商家
    const merchantsResult = await db.collection('merchants')
      .field({
        _id: true,
        storeName: true,
        status: true,
        businessStatus: true,
        createdAt: true
      })
      .get();
    
    const merchants = merchantsResult.data;
    
    // 统计商家状态
    const activeMerchants = merchants.filter(m => m.businessStatus === 'open').length;
    const pendingMerchants = merchants.filter(m => m.status === 'pending').length;
    const suspendedMerchants = merchants.filter(m => m.status === 'suspended').length;
    
    // 查询所有已支付订单，用于商家统计
    const allOrdersResult = await db.collection('orders')
      .where({
        payStatus: 'paid',
        orderStatus: db.command.neq('cancelled')
      })
      .field({
        storeId: true,
        amountGoods: true,
        platformFee: true,
        createdAt: true
      })
      .get();
    
    // 计算每个商家的订单数、销售额、平台服务费收入
    const merchantStatsMap = {};
    const today = new Date();
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0);
    
    allOrdersResult.data.forEach(order => {
      if (!order.storeId) return;
      
      if (!merchantStatsMap[order.storeId]) {
        merchantStatsMap[order.storeId] = {
          orderCount: 0,
          totalSales: 0,
          platformFee: 0,
          dailyOrderCount: 0
        };
      }
      
      merchantStatsMap[order.storeId].orderCount++;
      
      let amountGoods = order.amountGoods || 0;
      if (amountGoods > 1000) {
        amountGoods = amountGoods / 100;
      }
      merchantStatsMap[order.storeId].totalSales += amountGoods;
      
      let platformFee = order.platformFee || 0;
      if (platformFee > 1000) {
        platformFee = platformFee / 100;
      }
      merchantStatsMap[order.storeId].platformFee += platformFee;
      
      // 计算今日订单数
      const orderDate = new Date(order.createdAt);
      if (orderDate >= todayStart) {
        merchantStatsMap[order.storeId].dailyOrderCount++;
      }
    });
    
    // 生成商家排行榜（TOP 10，按销售额排序）
    const merchantRanking = Object.keys(merchantStatsMap)
      .map(storeId => {
        const merchant = merchants.find(m => (m._id === storeId || m.storeId === storeId));
        return {
          storeId: storeId,
          storeName: merchant ? merchant.storeName : '未知商家',
          orderCount: merchantStatsMap[storeId].orderCount,
          totalSales: merchantStatsMap[storeId].totalSales.toFixed(2),
          platformFee: merchantStatsMap[storeId].platformFee.toFixed(2),
          dailyOrderCount: merchantStatsMap[storeId].dailyOrderCount,
          avgOrderValue: merchantStatsMap[storeId].orderCount > 0 
            ? (merchantStatsMap[storeId].totalSales / merchantStatsMap[storeId].orderCount).toFixed(2)
            : '0.00'
        };
      })
      .sort((a, b) => parseFloat(b.totalSales) - parseFloat(a.totalSales))
      .slice(0, 10);
    
    // 计算所有商家的平均订单金额和平均日订单数
    const totalMerchantOrders = Object.values(merchantStatsMap).reduce((sum, stats) => sum + stats.orderCount, 0);
    const totalMerchantSales = Object.values(merchantStatsMap).reduce((sum, stats) => sum + stats.totalSales, 0);
    const totalDailyOrders = Object.values(merchantStatsMap).reduce((sum, stats) => sum + stats.dailyOrderCount, 0);
    
    const avgOrderValue = totalMerchantOrders > 0 ? (totalMerchantSales / totalMerchantOrders) : 0;
    const avgDailyOrders = activeMerchants > 0 ? (totalDailyOrders / activeMerchants) : 0;
    
    // 生成商家增长趋势图数据（按天统计新增商家数）
    const dailyStats = {};
    merchants.forEach(merchant => {
      const merchantDate = new Date(merchant.createdAt);
      if (merchantDate >= start && merchantDate <= end) {
        const dateKey = `${merchantDate.getMonth() + 1}/${merchantDate.getDate()}`;
        
        if (!dailyStats[dateKey]) {
          dailyStats[dateKey] = 0;
        }
        
        dailyStats[dateKey] += 1;
      }
    });
    
    // 生成连续的日期列表
    const dates = [];
    const merchantsList = [];
    
    const currentDate = new Date(start);
    while (currentDate <= end) {
      const dateKey = `${currentDate.getMonth() + 1}/${currentDate.getDate()}`;
      dates.push(dateKey);
      
      merchantsList.push(dailyStats[dateKey] || 0);
      
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    console.log('【管理端商家统计】统计结果:', {
      totalMerchants,
      activeMerchants,
      pendingMerchants,
      suspendedMerchants,
      merchantRankingCount: merchantRanking.length,
      avgOrderValue: avgOrderValue.toFixed(2),
      avgDailyOrders: avgDailyOrders.toFixed(1)
    });
    
    return {
      code: 200,
      message: 'ok',
      data: {
        totalMerchants: totalMerchants,
        activeMerchants: activeMerchants,
        pendingMerchants: pendingMerchants,
        suspendedMerchants: suspendedMerchants,
        merchantRanking: merchantRanking,
        avgOrderValue: avgOrderValue.toFixed(2),
        avgDailyOrders: avgDailyOrders.toFixed(1),
        chartData: {
          dates: dates,
          merchants: merchantsList
        }
      }
    };
    
  } catch (error) {
    console.error('【管理端商家统计】异常:', error);
    return {
      code: 500,
      message: '获取商家统计失败',
      error: error.message
    };
  }
}

/**
 * 获取管理端财务统计
 * 支持日期范围筛选，包含平台收入、商家收入、用户消费、退款统计等
 */
async function getAdminFinanceStats(openid, data) {
  try {
    const { dateRange = 'week' } = data;
    
    console.log('【管理端财务统计】参数:', { dateRange });
    
    // 计算时间范围
    const now = new Date();
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
    const start = new Date(end);
    
    if (dateRange === 'week') {
      start.setDate(start.getDate() - 6); // 近7天
    } else if (dateRange === 'month') {
      start.setMonth(start.getMonth() - 1); // 近1个月
    } else if (dateRange === 'quarter') {
      start.setMonth(start.getMonth() - 3); // 近3个月
    }
    start.setHours(0, 0, 0, 0);
    
    // 查询该时间范围内的所有已支付订单
    const ordersResult = await db.collection('orders')
      .where({
        payStatus: 'paid',
        orderStatus: db.command.neq('cancelled'),
        createdAt: db.command.gte(start).and(db.command.lte(end))
      })
      .get();
    
    const orders = ordersResult.data;
    
    // 查询该时间范围内的退款记录（已完成的退款）
    const refundsResult = await db.collection('refunds')
      .where({
        status: db.command.in(['approved', 'completed']),
        createdAt: db.command.gte(start).and(db.command.lte(end))
      })
      .get();
    
    const refunds = refundsResult.data;
    
    // 1. 计算平台总收入（平台服务费总和）
    let platformTotalRevenue = 0;
    // 2. 计算商家总收入（商品金额 - 平台服务费）
    let merchantTotalRevenue = 0;
    // 3. 计算用户总消费（订单总金额 = 商品金额 + 配送费）
    let userTotalConsumption = 0;
    
    orders.forEach(order => {
      // 处理商品金额（转换为元）
      let amountGoods = order.amountGoods || 0;
      if (amountGoods > 1000) {
        amountGoods = amountGoods / 100;
      }
      
      // 处理平台服务费（转换为元）
      let platformFee = order.platformFee || 0;
      if (platformFee > 1000) {
        platformFee = platformFee / 100;
      }
      
      // 处理配送费（转换为元）
      let amountDelivery = order.amountDelivery || 0;
      if (amountDelivery > 1000) {
        amountDelivery = amountDelivery / 100;
      }
      
      // 累计平台收入
      platformTotalRevenue += platformFee;
      
      // 累计商家收入（商品金额 - 平台服务费）
      merchantTotalRevenue += (amountGoods - platformFee);
      
      // 累计用户消费（商品金额 + 配送费）
      userTotalConsumption += (amountGoods + amountDelivery);
    });
    
    // 4. 计算退款统计
    let totalRefundAmount = 0;
    let totalRefundCount = refunds.length;
    
    refunds.forEach(refund => {
      const refundAmount = parseFloat(refund.refundAmount) || 0;
      totalRefundAmount += refundAmount;
    });
    
    // 5. 计算净收入（平台收入 - 退款中的平台服务费部分）
    // 简化计算：退款会按比例扣除平台服务费，这里按平均平台服务费比例估算
    const avgPlatformFeeRate = 0.08; // 默认8%
    const platformRefundDeduction = totalRefundAmount * avgPlatformFeeRate;
    const netPlatformRevenue = platformTotalRevenue - platformRefundDeduction;
    
    // 6. 生成财务趋势图数据（按天统计）
    const dailyStats = {};
    
    orders.forEach(order => {
      const orderDate = new Date(order.createdAt);
      const dateKey = `${orderDate.getMonth() + 1}/${orderDate.getDate()}`;
      
      if (!dailyStats[dateKey]) {
        dailyStats[dateKey] = {
          platformRevenue: 0,
          merchantRevenue: 0,
          userConsumption: 0,
          orderCount: 0
        };
      }
      
      let amountGoods = order.amountGoods || 0;
      if (amountGoods > 1000) {
        amountGoods = amountGoods / 100;
      }
      
      let platformFee = order.platformFee || 0;
      if (platformFee > 1000) {
        platformFee = platformFee / 100;
      }
      
      let amountDelivery = order.amountDelivery || 0;
      if (amountDelivery > 1000) {
        amountDelivery = amountDelivery / 100;
      }
      
      dailyStats[dateKey].platformRevenue += platformFee;
      dailyStats[dateKey].merchantRevenue += (amountGoods - platformFee);
      dailyStats[dateKey].userConsumption += (amountGoods + amountDelivery);
      dailyStats[dateKey].orderCount += 1;
    });
    
    // 生成连续的日期列表
    const dates = [];
    const platformRevenues = [];
    const merchantRevenues = [];
    const userConsumptions = [];
    
    const currentDate = new Date(start);
    while (currentDate <= end) {
      const dateKey = `${currentDate.getMonth() + 1}/${currentDate.getDate()}`;
      dates.push(dateKey);
      
      const stats = dailyStats[dateKey] || { platformRevenue: 0, merchantRevenue: 0, userConsumption: 0, orderCount: 0 };
      platformRevenues.push(stats.platformRevenue);
      merchantRevenues.push(stats.merchantRevenue);
      userConsumptions.push(stats.userConsumption);
      
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    // 7. 商家财务排行（按商家收入排序）
    const merchantFinanceMap = {};
    
    orders.forEach(order => {
      if (!order.storeId) return;
      
      if (!merchantFinanceMap[order.storeId]) {
        merchantFinanceMap[order.storeId] = {
          storeName: order.storeName || '未知商家',
          platformFee: 0,
          merchantRevenue: 0,
          orderCount: 0
        };
      }
      
      let amountGoods = order.amountGoods || 0;
      if (amountGoods > 1000) {
        amountGoods = amountGoods / 100;
      }
      
      let platformFee = order.platformFee || 0;
      if (platformFee > 1000) {
        platformFee = platformFee / 100;
      }
      
      merchantFinanceMap[order.storeId].platformFee += platformFee;
      merchantFinanceMap[order.storeId].merchantRevenue += (amountGoods - platformFee);
      merchantFinanceMap[order.storeId].orderCount += 1;
    });
    
    // 生成商家财务排行榜（TOP 10，按商家收入排序）
    const merchantRanking = Object.keys(merchantFinanceMap)
      .map(storeId => ({
        storeId: storeId,
        storeName: merchantFinanceMap[storeId].storeName,
        platformFee: parseFloat(merchantFinanceMap[storeId].platformFee.toFixed(2)),
        merchantRevenue: parseFloat(merchantFinanceMap[storeId].merchantRevenue.toFixed(2)),
        orderCount: merchantFinanceMap[storeId].orderCount
      }))
      .sort((a, b) => b.merchantRevenue - a.merchantRevenue)
      .slice(0, 10);
    
    console.log('【管理端财务统计】统计结果:', {
      platformTotalRevenue: platformTotalRevenue.toFixed(2),
      merchantTotalRevenue: merchantTotalRevenue.toFixed(2),
      userTotalConsumption: userTotalConsumption.toFixed(2),
      totalRefundAmount: totalRefundAmount.toFixed(2),
      totalRefundCount: totalRefundCount,
      netPlatformRevenue: netPlatformRevenue.toFixed(2)
    });
    
    return {
      code: 200,
      message: 'ok',
      data: {
        // 核心财务数据
        platformTotalRevenue: parseFloat(platformTotalRevenue.toFixed(2)), // 平台总收入
        merchantTotalRevenue: parseFloat(merchantTotalRevenue.toFixed(2)), // 商家总收入
        userTotalConsumption: parseFloat(userTotalConsumption.toFixed(2)), // 用户总消费
        totalRefundAmount: parseFloat(totalRefundAmount.toFixed(2)), // 总退款金额
        totalRefundCount: totalRefundCount, // 总退款数量
        netPlatformRevenue: parseFloat(netPlatformRevenue.toFixed(2)), // 平台净收入
        orderCount: orders.length, // 订单数量
        
        // 财务趋势图数据
        chartData: {
          dates: dates,
          platformRevenues: platformRevenues,
          merchantRevenues: merchantRevenues,
          userConsumptions: userConsumptions
        },
        
        // 商家财务排行
        merchantRanking: merchantRanking
      }
    };
    
  } catch (error) {
    console.error('【管理端财务统计】异常:', error);
    return {
      code: 500,
      message: '获取财务统计失败',
      error: error.message
    };
  }
}

