// 客户端 - 获取商家列表云函数
const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext();
  const { page = 1, pageSize = 20, keyword, storeCategory } = event;
  
  console.log('【获取商家列表】参数:', { page, pageSize, keyword, storeCategory });
  
  try {
    // 1. 先查询已审核的商家（merchants集合）
    const merchantsResult = await db.collection('merchants')
      .where({
        status: 'active' // 已审核通过
      })
      .get();
    
    console.log('【获取商家列表】已审核商家数量:', merchantsResult.data.length);
    
    if (merchantsResult.data.length === 0) {
      return {
        code: 200,
        message: 'ok',
        data: {
          list: [],
          total: 0,
          page: page,
          pageSize: pageSize
        }
      };
    }
    
    // 2. 提取所有商家的storeId
    const storeIds = merchantsResult.data
      .map(merchant => merchant.storeId)
      .filter(storeId => storeId); // 过滤掉空值
    
    console.log('【获取商家列表】店铺ID列表:', storeIds);
    
    if (storeIds.length === 0) {
      return {
        code: 200,
        message: 'ok',
        data: {
          list: [],
          total: 0,
          page: page,
          pageSize: pageSize
        }
      };
    }
    
    // 3. 构建店铺查询条件
    const storeWhereCondition = {
      _id: db.command.in(storeIds), // 只查询已审核商家的店铺
      businessStatus: 'open' // 营业中
    };
    
    // 店铺分类筛选 - 严格匹配，确保只返回指定分类的店铺
    // 注意：如果不传storeCategory参数，则返回所有商家（包括"其他"分类）
    // 如果传了storeCategory参数，则只返回该分类的商家（不包括"其他"分类）
    if (storeCategory) {
      // 直接使用字符串匹配，更简单直接
      storeWhereCondition.storeCategory = storeCategory;
    }
    
    // 关键词搜索
    if (keyword) {
      storeWhereCondition.name = db.RegExp({ regexp: keyword, options: 'i' });
    }
    
    console.log('【获取商家列表】店铺查询条件:', JSON.stringify(storeWhereCondition));
    console.log('【获取商家列表】筛选分类:', storeCategory);
    
    // 4. 查询店铺列表（只返回必要字段，减少数据传输）
    const result = await db.collection('stores')
      .where(storeWhereCondition)
      .field({
        _id: true,
        name: true,
        logoUrl: true,
        avatar: true,
        announcement: true,
        description: true,
        businessStatus: true,
        storeCategory: true, // 包含店铺分类字段，用于调试
        minOrderAmount: true,
        deliveryFee: true,
        ratingAvg: true,
        ratingCount: true,
        sales: true,
        monthlySales: true
      })
      .orderBy('createdAt', 'desc')
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .get();
    
    // 5. 获取总数
    const countResult = await db.collection('stores')
      .where(storeWhereCondition)
      .count();
    
    console.log('【获取商家列表】查询结果:', result.data.length, '条');
    
    // 6. 批量获取商家信息和商品数量（优化：避免N+1查询）
    const resultStoreIds = result.data.map(store => store._id);
    
    // 批量查询商家信息
    const merchantsMap = new Map();
    if (resultStoreIds.length > 0) {
      const merchantsResult = await db.collection('merchants')
        .where({
          storeId: db.command.in(resultStoreIds),
          status: 'active'
        })
        .field({
          storeId: true,
          merchantName: true
        })
        .get();
      
      merchantsResult.data.forEach(merchant => {
        merchantsMap.set(merchant.storeId, merchant);
      });
    }
    
    // 批量查询商品数量（使用聚合查询会更快，但云数据库可能不支持，这里用批量count）
    const productCountsMap = new Map();
    if (resultStoreIds.length > 0) {
      const productCountPromises = resultStoreIds.map(storeId => 
        db.collection('products')
          .where({
            storeId: storeId,
            status: 'on',
            auditStatus: 'approved'
          })
          .count()
          .then(res => ({ storeId, count: res.total }))
      );
      
      const productCounts = await Promise.all(productCountPromises);
      productCounts.forEach(({ storeId, count }) => {
        productCountsMap.set(storeId, count);
      });
    }
    
    // 7. 收集所有需要转换的图片fileID
    const logoFileIDs = [];
    result.data.forEach(store => {
      const logoUrl = store.logoUrl || store.avatar || '';
      if (logoUrl && (logoUrl.startsWith('cloud://') || logoUrl.includes('cloud://'))) {
        // 清理fileID格式
        let cleanFileID = logoUrl;
        if (logoUrl.includes('cloud://')) {
          const cloudMatch = logoUrl.match(/cloud:\/\/[^\/]+(?:\/[^"]*)?/);
          if (cloudMatch) {
            cleanFileID = cloudMatch[0];
          } else {
            cleanFileID = logoUrl.replace(/.*cloud:\/\//, 'cloud://');
          }
        }
        if (cleanFileID && !logoFileIDs.includes(cleanFileID)) {
          logoFileIDs.push(cleanFileID);
        }
      }
    });
    
    // 8. 批量转换fileID为临时URL（让游客也能访问）
    const logoUrlMap = new Map();
    if (logoFileIDs.length > 0) {
      try {
        // 批量获取临时URL（每次最多20个）
        const batchSize = 20;
        for (let i = 0; i < logoFileIDs.length; i += batchSize) {
          const batch = logoFileIDs.slice(i, i + batchSize);
          const tempUrlRes = await cloud.getTempFileURL({
            fileList: batch
          });
          
          tempUrlRes.fileList.forEach((item, index) => {
            const fileID = batch[index];
            if (item.status === 'ok') {
              logoUrlMap.set(fileID, item.tempFileURL);
            } else {
              console.warn('【获取商家列表】图片URL转换失败:', fileID, item.errMsg);
              // 转换失败时保留原fileID
              logoUrlMap.set(fileID, fileID);
            }
          });
        }
        console.log('【获取商家列表】图片URL转换完成，成功转换:', logoUrlMap.size, '个');
      } catch (error) {
        console.error('【获取商家列表】批量转换图片URL失败:', error);
        // 如果转换失败，使用原fileID
        logoFileIDs.forEach(fileID => {
          if (!logoUrlMap.has(fileID)) {
            logoUrlMap.set(fileID, fileID);
          }
        });
      }
    }
    
    // 9. 格式化数据（避免循环中的异步查询）
    const storeList = result.data.map(store => {
      const merchant = merchantsMap.get(store._id);
      const productCount = productCountsMap.get(store._id) || 0;
      
      // 处理logoUrl，确保格式正确并转换为临时URL
      let logoUrl = store.logoUrl || store.avatar || '';
      
      // 验证图片URL格式
      if (logoUrl) {
        // 如果包含cloud://但格式可能有问题，尝试修复
        if (logoUrl.includes('cloud://')) {
          // 移除/pages/home/等错误的路径前缀，只保留cloud://开头的部分
          const cloudMatch = logoUrl.match(/cloud:\/\/[^\/]+(?:\/[^"]*)?/);
          if (cloudMatch) {
            logoUrl = cloudMatch[0];
          } else {
            // 如果匹配失败，尝试简单清理
            logoUrl = logoUrl.replace(/.*cloud:\/\//, 'cloud://');
          }
          
          // 转换为临时URL（如果已转换）
          const tempUrl = logoUrlMap.get(logoUrl);
          if (tempUrl) {
            logoUrl = tempUrl;
          }
        }
        
        // 如果logoUrl无效，使用空字符串（前端会使用默认图片）
        if (logoUrl === 'undefined' || logoUrl === 'null' || logoUrl.trim() === '') {
          logoUrl = '';
        }
      }
      
      return {
        _id: store._id,
        storeId: store._id,
        name: store.name,
        logoUrl: logoUrl,
        announcement: store.announcement || '',
        description: store.description || store.announcement || '',
        businessStatus: store.businessStatus,
        storeCategory: store.storeCategory || '', // 店铺分类字段
        minOrderAmount: store.minOrderAmount || 20,
        deliveryFee: store.deliveryFee || 3,
        ratingAvg: store.ratingAvg || 0,
        ratingCount: store.ratingCount || 0,
        sales: store.monthlySales || store.sales || 0, // 月销量（优先使用monthlySales）
        monthlySales: store.monthlySales || store.sales || 0, // 月销量
        // 兼容字段
        img: logoUrl,
        score: store.ratingAvg || 0,
        month: store.monthlySales || store.sales || 0,
        start: store.minOrderAmount || 20,
        delivery: store.deliveryFee || 3,
        merchantName: merchant?.merchantName || '',
        productCount: productCount
      };
    });
    
    // 调试：输出每个店铺的分类信息
    storeList.forEach(store => {
      console.log(`【获取商家列表】店铺: ${store.name}, 分类: ${store.storeCategory || '(未设置)'}`);
    });
    
    console.log('【获取商家列表】格式化后的数据:', storeList);
    
    return {
      code: 200,
      message: 'ok',
      data: {
        list: storeList,
        total: countResult.total,
        page: page,
        pageSize: pageSize
      }
    };
    
  } catch (error) {
    console.error('【获取商家列表】失败:', error);
    return {
      code: 500,
      message: '系统异常',
      error: error.message
    };
  }
};

