// 首页菜品流：获取商品列表（跨店铺，含店铺信息）
const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();

/** 与 stores 文档一致：白沙校区、金水校区；兼容 baisha、jinshui */
function normalizeCampus(campus) {
  if (campus == null || campus === '') return '';
  const s = String(campus).trim();
  if (s === 'baisha') return '白沙校区';
  if (s === 'jinshui') return '金水校区';
  return s;
}

const CAMPUS_ALLOWED = ['白沙校区', '金水校区'];

function resolveCampusStrict(raw) {
  const n = normalizeCampus(raw);
  return CAMPUS_ALLOWED.includes(n) ? n : null;
}

const isDev = process.env.NODE_ENV !== 'production';
const log = {
  log: isDev ? (...a) => console.log(...a) : () => {},
  warn: isDev ? (...a) => console.warn(...a) : () => {},
  error: (...a) => console.error(...a)
};

exports.main = async (event, context) => {
  const { page = 1, pageSize = 20, keyword, categoryName, campus: rawCampus } = event;
  const campus = resolveCampusStrict(rawCampus);

  log.log('【首页菜品流】参数:', { page, pageSize, keyword, categoryName, campus: campus || '(无效或未传)' });

  try {
    if (!campus) {
      return {
        code: 200,
        message: 'ok',
        data: { list: [], total: 0, page, pageSize }
      };
    }

    // 1. 获取已审核且营业中的店铺 ID 列表
    const merchantsResult = await db.collection('merchants')
      .where({ status: 'active' })
      .field({ storeId: true })
      .get();

    const storeIds = (merchantsResult.data || [])
      .map(m => m.storeId)
      .filter(Boolean);

    if (storeIds.length === 0) {
      return {
        code: 200,
        message: 'ok',
        data: { list: [], total: 0, page, pageSize }
      };
    }

    // 构建店铺查询条件
    const cmd = db.command;
    let storeWhere = {
      _id: cmd.in(storeIds),
      businessStatus: 'open'
    };

    // 金水：仅 campus===金水校区；白沙：白沙标注 + 历史无 campus 字段（与 getStoreList 一致）
    if (campus === '金水校区') {
      storeWhere.campus = '金水校区';
    } else {
      storeWhere = cmd.and([
        storeWhere,
        cmd.or([
          { campus: '白沙校区' },
          { campus: cmd.exists(false) },
          { campus: '' },
          { campus: null }
        ])
      ]);
    }
    log.log('【首页菜品流】应用校区过滤:', campus);

    const storesResult = await db.collection('stores')
      .where(storeWhere)
      .field({ _id: true, name: true, logoUrl: true, avatar: true, campus: true })
      .get();

    log.log('【首页菜品流】查询到的店铺数量:', storesResult.data.length);
    log.log('【首页菜品流】查询到的店铺:', storesResult.data);

    // 验证店铺的校区信息
    storesResult.data.forEach(store => {
      log.log('【首页菜品流】店铺:', store.name, '校区:', store.campus);
    });

    const openStoreIds = (storesResult.data || []).map(s => s._id);
    const storeMap = new Map((storesResult.data || []).map(s => [
      s._id,
      {
        name: s.name || '',
        logo: s.logoUrl || s.avatar || ''
      }
    ]));

    if (openStoreIds.length === 0) {
      return {
        code: 200,
        message: 'ok',
        data: { list: [], total: 0, page, pageSize }
      };
    }

    // 2. 若按分类筛选：先查出该分类名对应的 categoryId 列表（多店铺可能同名分类）
    let categoryIds = null;
    if (categoryName && categoryName.trim() && categoryName !== 'all') {
      const catRes = await db.collection('categories')
        .where({
          storeId: db.command.in(openStoreIds),
          name: categoryName.trim(),
          status: 'active'
        })
        .field({ _id: true })
        .get();
      categoryIds = (catRes.data || []).map(c => c._id);
      if (categoryIds.length === 0) {
        return {
          code: 200,
          message: 'ok',
          data: { list: [], total: 0, page, pageSize }
        };
      }
    }

    // 3. 查询商品：上架且审核通过，仅限上述店铺，可选按分类
    const productWhere = {
      storeId: db.command.in(openStoreIds),
      status: 'on',
      auditStatus: 'approved'
    };
    if (keyword && keyword.trim()) {
      productWhere.name = db.RegExp({ regexp: keyword.trim(), options: 'i' });
    }
    if (categoryIds && categoryIds.length > 0) {
      productWhere.categoryId = db.command.in(categoryIds);
    }

    const countResult = await db.collection('products')
      .where(productWhere)
      .count();

    const productsResult = await db.collection('products')
      .where(productWhere)
      .field({
        _id: true,
        name: true,
        coverUrl: true,
        price: true,
        sales: true,
        storeId: true
      })
      .orderBy('sales', 'desc')
      .orderBy('createdAt', 'desc')
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .get();

    const list = (productsResult.data || []).map(p => {
      const store = storeMap.get(p.storeId) || { name: '', logo: '' };
      const priceYuan = (p.price != null && p.price > 0)
        ? (p.price / 100).toFixed(2)
        : '0.00';
      return {
        _id: p._id,
        name: p.name || '',
        coverUrl: p.coverUrl || '',
        price: priceYuan,
        sales: p.sales != null ? p.sales : 0,
        storeId: p.storeId || '',
        storeName: store.name,
        storeLogo: store.logo
      };
    });

    log.log('【首页菜品流】返回数量:', list.length, '总数:', countResult.total);

    return {
      code: 200,
      message: 'ok',
      data: {
        list,
        total: countResult.total,
        page,
        pageSize
      }
    };
  } catch (error) {
    log.error('【首页菜品流】失败:', error);
    return {
      code: 500,
      message: '系统异常',
      error: error.message
    };
  }
};
