// 支付管理云函数 - 微信支付统一下单
const cloud = require('wx-server-sdk');
const crypto = require('crypto');
const https = require('https');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();

// 微信支付配置：优先从环境变量读取，避免密钥入库（上线必配）
// 云开发控制台 - 云函数 - paymentManage - 配置 - 环境变量：WX_PAY_APPID, WX_PAY_MCHID, WX_PAY_API_KEY, WX_PAY_NOTIFY_URL
function getWxPayConfig() {
  return {
    appid: process.env.WX_PAY_APPID || '',
    mchid: process.env.WX_PAY_MCHID || '',
    apiKey: (process.env.WX_PAY_API_KEY || '').trim().replace(/^\uFEFF/, ''),
    notifyUrl: process.env.WX_PAY_NOTIFY_URL || '',
    tradeType: 'JSAPI'
  };
}

/**
 * 生成随机字符串
 */
function generateNonceStr(length = 32) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * 生成签名（严格按微信支付 V2 文档：stringA 无末尾&，stringSignTemp = stringA + "&key=" + 密钥）
 */
function generateSign(params, apiKey) {
  // 去除首尾空格、换行、BOM（复制密钥时易带入）
  const key = (apiKey || '').trim().replace(/^\uFEFF/, '');
  
  const sortedKeys = Object.keys(params).sort();
  const parts = [];
  sortedKeys.forEach(k => {
    if (k === 'sign') return;
    const v = params[k];
    if (v !== null && v !== undefined && v !== '') {
      parts.push(`${k}=${v}`);
    }
  });
  // 官方格式：stringA 为 key1=value1&key2=value2（末尾无 &）
  const stringA = parts.join('&');
  const stringSignTemp = stringA + '&key=' + key;
  
  const sign = crypto.createHash('md5').update(stringSignTemp, 'utf8').digest('hex').toUpperCase();
  console.log('【签名】stringA(不含key):', stringA);
  console.log('【签名】sign:', sign);
  
  return sign;
}

/**
 * 调用微信支付API（普通请求，无需证书）
 */
function callWxPayAPI(url, xmlData) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      port: 443,
      path: urlObj.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Content-Length': Buffer.byteLength(xmlData, 'utf8')
      }
    };
    
    const req = https.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const result = xmlToObject(data);
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });
    });
    
    req.on('error', (error) => {
      reject(error);
    });
    
    req.write(xmlData, 'utf8');
    req.end();
  });
}

/**
 * XML转对象
 */
function xmlToObject(xml) {
  const result = {};
  // 处理CDATA
  const regex = /<(\w+)><!\[CDATA\[(.*?)\]\]><\/\1>|<(\w+)>(.*?)<\/\3>/g;
  let match;
  while ((match = regex.exec(xml)) !== null) {
    const key = match[1] || match[3];
    const value = match[2] || match[4];
    result[key] = value;
  }
  return result;
}

/**
 * 对象转XML
 */
function objectToXml(obj) {
  let xml = '<xml>';
  Object.keys(obj).forEach(key => {
    xml += `<${key}><![CDATA[${obj[key]}]]></${key}>`;
  });
  xml += '</xml>';
  return xml;
}

/**
 * 微信支付统一下单
 */
async function unifiedOrder(openid, data) {
  try {
    const { orderId, totalFee, description } = data;
    
    console.log('【统一下单】参数:', { orderId, totalFee, description, openid });
    
    // 参数验证
    if (!orderId || !totalFee || !description) {
      return {
        code: 400,
        message: '缺少必要参数：orderId、totalFee、description'
      };
    }
    
    if (totalFee <= 0) {
      return {
        code: 400,
        message: '支付金额必须大于0'
      };
    }
    
    // 验证订单是否存在
    const orderResult = await db.collection('orders').doc(orderId).get();
    if (!orderResult.data) {
      return {
        code: 404,
        message: '订单不存在'
      };
    }
    
    const order = orderResult.data;
    
    // 验证订单是否属于当前用户
    if (order.userOpenid !== openid) {
      return {
        code: 403,
        message: '无权访问此订单'
      };
    }
    
    // 验证订单是否已支付
    if (order.payStatus === 'paid') {
      return {
        code: 400,
        message: '订单已支付'
      };
    }
    
    const WX_PAY_CONFIG = getWxPayConfig();
    if (!WX_PAY_CONFIG.appid || !WX_PAY_CONFIG.mchid || !WX_PAY_CONFIG.apiKey || !WX_PAY_CONFIG.notifyUrl) {
      return {
        code: 500,
        message: '支付配置不完整，请在云函数环境变量中配置 WX_PAY_APPID、WX_PAY_MCHID、WX_PAY_API_KEY、WX_PAY_NOTIFY_URL'
      };
    }

    // 生成商户订单号（使用订单ID）
    const outTradeNo = order.orderNo || `ORDER${Date.now()}${Math.random().toString(36).substr(2, 9)}`;
    
    // 金额（分）：必须为整数字符串，且与订单一致
    const totalFeeStr = String(Math.floor(Number(totalFee)));
    
    // 准备统一下单参数（所有参与签名的值均为字符串，避免类型导致签名不一致）
    const unifiedOrderParams = {
      appid: WX_PAY_CONFIG.appid,
      mch_id: WX_PAY_CONFIG.mchid,
      nonce_str: generateNonceStr(),
      body: String(description).substring(0, 128), // 商品描述最长128字符
      out_trade_no: String(outTradeNo),
      total_fee: totalFeeStr,
      spbill_create_ip: '127.0.0.1', // 终端IP（小程序支付可为127.0.0.1）
      trade_type: WX_PAY_CONFIG.tradeType,
      openid: String(openid)
    };
    
    // notify_url 是必填项，必须提供
    unifiedOrderParams.notify_url = WX_PAY_CONFIG.notifyUrl;
    
    // 生成签名
    const sign = generateSign(unifiedOrderParams, WX_PAY_CONFIG.apiKey);
    unifiedOrderParams.sign = sign;
    
    // 转换为XML
    const xmlData = objectToXml(unifiedOrderParams);
    
    console.log('【统一下单】请求参数:', unifiedOrderParams);
    console.log('【统一下单】请求XML:', xmlData);
    
    // 调用微信支付统一下单API（通过HTTPS请求）
    const responseData = await callWxPayAPI('https://api.mch.weixin.qq.com/pay/unifiedorder', xmlData);
    
    console.log('【统一下单】微信返回:', responseData);
    
    // 检查返回结果
    if (responseData.return_code !== 'SUCCESS') {
      console.error('【统一下单】微信返回错误:', responseData);
      return {
        code: 500,
        message: responseData.return_msg || '统一下单失败',
        detail: responseData
      };
    }
    
    if (responseData.result_code !== 'SUCCESS') {
      console.error('【统一下单】业务错误:', responseData);
      return {
        code: 500,
        message: responseData.err_code_des || responseData.err_code || '统一下单失败',
        detail: responseData
      };
    }
    
    // 获取预支付交易会话ID
    const prepayId = responseData.prepay_id;
    
    if (!prepayId) {
      return {
        code: 500,
        message: '获取预支付ID失败'
      };
    }
    
    // 生成小程序调起支付所需的参数
    const timeStamp = Math.floor(Date.now() / 1000).toString();
    const nonceStr = generateNonceStr();
    const packageValue = `prepay_id=${prepayId}`;
    const signType = 'MD5';
    
    // 生成支付签名
    const paySignParams = {
      appId: WX_PAY_CONFIG.appid,
      timeStamp: timeStamp,
      nonceStr: nonceStr,
      package: packageValue,
      signType: signType
    };
    
    const paySign = generateSign(paySignParams, WX_PAY_CONFIG.apiKey);
    
    // 返回支付参数
    return {
      code: 200,
      message: '统一下单成功',
      data: {
        timeStamp: timeStamp,
        nonceStr: nonceStr,
        package: packageValue,
        signType: signType,
        paySign: paySign
      }
    };
    
  } catch (error) {
    console.error('【统一下单】异常:', error);
    return {
      code: 500,
      message: error.message || '统一下单异常',
      error: error.toString()
    };
  }
}

/**
 * 统一付款预下单：根据 unifiedPaymentId 用 unified_payments 的 out_trade_no、totalFeeFen 调微信统一下单
 */
async function unifiedPrepay(openid, data) {
  try {
    const { unifiedPaymentId } = data || {};
    if (!unifiedPaymentId) {
      return { code: 400, message: '缺少 unifiedPaymentId' };
    }
    const upRes = await db.collection('unified_payments').doc(unifiedPaymentId).get();
    if (!upRes.data) {
      return { code: 404, message: '统一支付单不存在' };
    }
    const rec = upRes.data;
    if (rec.userOpenid !== openid) {
      return { code: 403, message: '无权操作' };
    }
    if (rec.status === 'paid') {
      return { code: 400, message: '已支付' };
    }
    const out_trade_no = rec.out_trade_no;
    const totalFeeFen = Math.floor(Number(rec.totalFeeFen) || 0);
    if (totalFeeFen <= 0) {
      return { code: 400, message: '支付金额必须大于0' };
    }
    const WX_PAY_CONFIG = getWxPayConfig();
    if (!WX_PAY_CONFIG.appid || !WX_PAY_CONFIG.mchid || !WX_PAY_CONFIG.apiKey || !WX_PAY_CONFIG.notifyUrl) {
      return { code: 500, message: '支付配置不完整，请配置 WX_PAY_APPID、WX_PAY_MCHID、WX_PAY_API_KEY、WX_PAY_NOTIFY_URL' };
    }
    const description = '校园外卖-多店统一付款';
    const unifiedOrderParams = {
      appid: WX_PAY_CONFIG.appid,
      mch_id: WX_PAY_CONFIG.mchid,
      nonce_str: generateNonceStr(),
      body: String(description).substring(0, 128),
      out_trade_no: String(out_trade_no),
      total_fee: String(totalFeeFen),
      spbill_create_ip: '127.0.0.1',
      trade_type: WX_PAY_CONFIG.tradeType,
      openid: String(openid),
      notify_url: WX_PAY_CONFIG.notifyUrl
    };
    unifiedOrderParams.sign = generateSign(unifiedOrderParams, WX_PAY_CONFIG.apiKey);
    const xmlData = objectToXml(unifiedOrderParams);
    const responseData = await callWxPayAPI('https://api.mch.weixin.qq.com/pay/unifiedorder', xmlData);
    if (responseData.return_code !== 'SUCCESS') {
      return { code: 500, message: responseData.return_msg || '统一下单失败' };
    }
    if (responseData.result_code !== 'SUCCESS') {
      return { code: 500, message: responseData.err_code_des || responseData.err_code || '统一下单失败' };
    }
    const prepayId = responseData.prepay_id;
    if (!prepayId) return { code: 500, message: '获取预支付ID失败' };
    const timeStamp = String(Math.floor(Date.now() / 1000));
    const nonceStr = generateNonceStr();
    const signType = 'MD5';
    const packageValue = 'prepay_id=' + prepayId;
    const paySignParams = {
      appId: WX_PAY_CONFIG.appid,
      timeStamp,
      nonceStr,
      package: packageValue,
      signType
    };
    const paySign = generateSign(paySignParams, WX_PAY_CONFIG.apiKey);
    return {
      code: 200,
      message: '统一下单成功',
      data: {
        timeStamp,
        nonceStr,
        package: packageValue,
        signType,
        paySign
      }
    };
  } catch (error) {
    console.error('【统一付款预下单】异常:', error);
    return { code: 500, message: error.message || '预下单异常', error: (error && error.toString()) || '' };
  }
}

/**
 * 保证金统一下单（不依赖 orders 表，由 campusPartnerManage 调用）
 * data: { openid, totalFee（分）, outTradeNo, description }
 */
async function unifiedOrderDeposit(data) {
  try {
    const { openid, totalFee, outTradeNo, description } = data || {};
    if (!openid || totalFee == null || !outTradeNo || !description) {
      return { code: 400, message: '缺少参数：openid、totalFee、outTradeNo、description' };
    }
    const totalFeeStr = String(Math.floor(Number(totalFee)));
    if (Number(totalFeeStr) <= 0) {
      return { code: 400, message: '支付金额必须大于0' };
    }
    const WX_PAY_CONFIG = getWxPayConfig();
    if (!WX_PAY_CONFIG.appid || !WX_PAY_CONFIG.mchid || !WX_PAY_CONFIG.apiKey || !WX_PAY_CONFIG.notifyUrl) {
      return { code: 500, message: '支付配置不完整' };
    }
    const unifiedOrderParams = {
      appid: WX_PAY_CONFIG.appid,
      mch_id: WX_PAY_CONFIG.mchid,
      nonce_str: generateNonceStr(),
      body: String(description).substring(0, 128),
      out_trade_no: String(outTradeNo),
      total_fee: totalFeeStr,
      spbill_create_ip: '127.0.0.1',
      trade_type: WX_PAY_CONFIG.tradeType,
      openid: String(openid),
      notify_url: WX_PAY_CONFIG.notifyUrl
    };
    unifiedOrderParams.sign = generateSign(unifiedOrderParams, WX_PAY_CONFIG.apiKey);
    const xmlData = objectToXml(unifiedOrderParams);
    const responseData = await callWxPayAPI('https://api.mch.weixin.qq.com/pay/unifiedorder', xmlData);
    if (responseData.return_code !== 'SUCCESS' || responseData.result_code !== 'SUCCESS') {
      return {
        code: 500,
        message: responseData.return_msg || responseData.err_code_des || '统一下单失败'
      };
    }
    const prepayId = responseData.prepay_id;
    if (!prepayId) return { code: 500, message: '获取预支付ID失败' };
    const timeStamp = Math.floor(Date.now() / 1000).toString();
    const nonceStr = generateNonceStr();
    const packageValue = `prepay_id=${prepayId}`;
    const signType = 'MD5';
    const paySignParams = { appId: WX_PAY_CONFIG.appid, timeStamp, nonceStr, package: packageValue, signType };
    const paySign = generateSign(paySignParams, WX_PAY_CONFIG.apiKey);
    return {
      code: 200,
      message: 'ok',
      data: { timeStamp, nonceStr, package: packageValue, signType, paySign }
    };
  } catch (error) {
    console.error('【保证金统一下单】异常:', error);
    return { code: 500, message: error.message || '统一下单异常' };
  }
}

/**
 * 按商户订单号查询支付结果（用于保证金支付校验）
 */
async function queryOrderByOutTradeNo(data) {
  try {
    const { outTradeNo } = data || {};
    if (!outTradeNo) return { code: 400, message: '缺少 outTradeNo' };
    const WX_PAY_CONFIG = getWxPayConfig();
    if (!WX_PAY_CONFIG.appid || !WX_PAY_CONFIG.mchid || !WX_PAY_CONFIG.apiKey) {
      return { code: 500, message: '支付配置不完整' };
    }
    const queryParams = {
      appid: WX_PAY_CONFIG.appid,
      mch_id: WX_PAY_CONFIG.mchid,
      out_trade_no: String(outTradeNo),
      nonce_str: generateNonceStr()
    };
    queryParams.sign = generateSign(queryParams, WX_PAY_CONFIG.apiKey);
    const xmlData = objectToXml(queryParams);
    const responseData = await callWxPayAPI('https://api.mch.weixin.qq.com/pay/orderquery', xmlData);
    if (responseData.return_code === 'SUCCESS' && responseData.result_code === 'SUCCESS') {
      return {
        code: 200,
        message: 'ok',
        data: {
          trade_state: responseData.trade_state,
          transaction_id: responseData.transaction_id
        }
      };
    }
    return { code: 500, message: responseData.return_msg || responseData.err_code_des || '查询失败' };
  } catch (error) {
    console.error('【按单号查询】异常:', error);
    return { code: 500, message: error.message || '查询异常' };
  }
}

/**
 * 按商户订单号退款（用于保证金原路退）
 */
async function refundByOutTradeNo(data) {
  try {
    const { outTradeNo, totalFeeFen } = data || {};
    if (!outTradeNo || totalFeeFen == null) {
      return { code: 400, message: '缺少 outTradeNo 或 totalFeeFen' };
    }
    const fee = Math.floor(Number(totalFeeFen));
    if (fee <= 0) return { code: 400, message: '退款金额无效' };
    const WX_PAY_CONFIG = getWxPayConfig();
    if (!WX_PAY_CONFIG.appid || !WX_PAY_CONFIG.mchid || !WX_PAY_CONFIG.apiKey) {
      return { code: 500, message: '支付配置不完整' };
    }
    const certPem = process.env.WX_PAY_CERT_PEM || (process.env.WX_PAY_CERT_BASE64 ? Buffer.from(process.env.WX_PAY_CERT_BASE64, 'base64').toString('utf8') : '');
    const keyPem = process.env.WX_PAY_KEY_PEM || (process.env.WX_PAY_KEY_BASE64 ? Buffer.from(process.env.WX_PAY_KEY_BASE64, 'base64').toString('utf8') : '');
    if (!certPem || !keyPem) {
      return { code: 500, message: '退款需配置商户证书' };
    }
    const outRefundNo = 'DEPRF' + Date.now() + Math.random().toString(36).substr(2, 6).toUpperCase();
    const refundParams = {
      appid: WX_PAY_CONFIG.appid,
      mch_id: WX_PAY_CONFIG.mchid,
      nonce_str: generateNonceStr(),
      out_trade_no: String(outTradeNo),
      out_refund_no: outRefundNo,
      total_fee: String(fee),
      refund_fee: String(fee),
      op_user_id: WX_PAY_CONFIG.mchid
    };
    refundParams.sign = generateSign(refundParams, WX_PAY_CONFIG.apiKey);
    const xmlData = objectToXml(refundParams);
    const responseData = await callWxPayRefundAPI('https://api.mch.weixin.qq.com/secapi/pay/refund', xmlData, certPem, keyPem);
    if (responseData.return_code !== 'SUCCESS' || responseData.result_code !== 'SUCCESS') {
      const errMsg = responseData.err_code_des || (responseData.return_msg && responseData.return_msg !== 'OK' ? responseData.return_msg : null) || '退款失败';
      console.warn('【保证金退款】微信返回失败:', responseData.return_code, responseData.result_code, responseData.err_code, responseData.err_code_des);
      return {
        code: 500,
        message: errMsg
      };
    }
    console.log('【保证金退款】成功 out_trade_no:', outTradeNo);
    return { code: 200, message: '退款成功', data: { outRefundNo } };
  } catch (error) {
    console.error('【保证金退款】异常:', error);
    return { code: 500, message: error.message || '退款异常' };
  }
}

/**
 * 查询支付结果（可选）
 */
async function queryOrder(openid, data) {
  try {
    const { orderId } = data;
    
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
    
    // 验证权限
    if (order.userOpenid !== openid) {
      return {
        code: 403,
        message: '无权访问此订单'
      };
    }
    
    const WX_PAY_CONFIG = getWxPayConfig();
    if (!WX_PAY_CONFIG.appid || !WX_PAY_CONFIG.mchid || !WX_PAY_CONFIG.apiKey) {
      return {
        code: 500,
        message: '支付配置不完整，请配置环境变量 WX_PAY_APPID、WX_PAY_MCHID、WX_PAY_API_KEY'
      };
    }
    
    // 准备查询参数
    const queryParams = {
      appid: WX_PAY_CONFIG.appid,
      mch_id: WX_PAY_CONFIG.mchid,
      out_trade_no: order.orderNo,
      nonce_str: generateNonceStr()
    };
    
    // 生成签名
    const sign = generateSign(queryParams, WX_PAY_CONFIG.apiKey);
    queryParams.sign = sign;
    
    // 转换为XML
    const xmlData = objectToXml(queryParams);
    
    // 调用微信支付查询订单API（通过HTTPS请求）
    const responseData = await callWxPayAPI('https://api.mch.weixin.qq.com/pay/orderquery', xmlData);
    
    if (responseData.return_code === 'SUCCESS' && responseData.result_code === 'SUCCESS') {
      return {
        code: 200,
        message: '查询成功',
        data: {
          tradeState: responseData.trade_state,
          tradeStateDesc: responseData.trade_state_desc,
          transactionId: responseData.transaction_id
        }
      };
    } else {
      return {
        code: 500,
        message: responseData.return_msg || responseData.err_code_des || '查询失败'
      };
    }
    
  } catch (error) {
    console.error('【查询订单】异常:', error);
    return {
      code: 500,
      message: error.message || '查询订单异常'
    };
  }
}

/**
 * 规范化 PEM：环境变量中换行常被转为空格或 \\n，导致 "PEM routines:get_name:no start line"
 */
function normalizePem(pem) {
  if (!pem || typeof pem !== 'string') return pem;
  let s = pem.trim().replace(/^\uFEFF/, '');
  s = s.replace(/\\n/g, '\n').replace(/\r\n/g, '\n');
  s = s.replace(/-----BEGIN ([^\n-]+)----- +/g, '-----BEGIN $1-----\n');
  s = s.replace(/ +-----END ([^\n-]+)-----/g, '\n-----END $1-----');
  s = s.replace(/-----BEGIN ([^\n-]+)-----([^\n-])/g, '-----BEGIN $1-----\n$2');
  s = s.replace(/([^\n])-----END ([^\n-]+)-----/g, '$1\n-----END $2-----');
  return s;
}

/**
 * 调用微信退款API（需商户证书，环境变量 WX_PAY_CERT_PEM、WX_PAY_KEY_PEM 或 BASE64 版本）
 */
function callWxPayRefundAPI(url, xmlData, certPem, keyPem) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      port: 443,
      path: urlObj.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Content-Length': Buffer.byteLength(xmlData, 'utf8')
      }
    };
    if (certPem && keyPem) {
      const cert = normalizePem(certPem);
      const key = normalizePem(keyPem);
      options.key = Buffer.from(key, 'utf8');
      options.cert = Buffer.from(cert, 'utf8');
      options.rejectUnauthorized = true;
    }
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve(xmlToObject(data));
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on('error', reject);
    req.write(xmlData, 'utf8');
    req.end();
  });
}

/**
 * 企业付款到零钱（V2 接口，需商户证书）
 * 用于商家提现等场景，将商户号余额打款到用户微信零钱
 * 环境变量：同退款，需 WX_PAY_CERT_PEM、WX_PAY_KEY_PEM（或 BASE64）
 */
async function transferToBalance(data) {
  try {
    const { openid, amount, partnerTradeNo, desc } = data || {};
    if (!openid || amount == null || !partnerTradeNo) {
      return { code: 400, message: '缺少参数：openid、amount、partnerTradeNo' };
    }
    const amountFen = Math.floor(Number(amount));
    if (amountFen < 100) {
      return { code: 400, message: '企业付款金额不能低于 1 元（100 分）' };
    }
    const WX_PAY_CONFIG = getWxPayConfig();
    if (!WX_PAY_CONFIG.appid || !WX_PAY_CONFIG.mchid || !WX_PAY_CONFIG.apiKey) {
      return { code: 500, message: '支付配置不完整，请配置 WX_PAY_APPID、WX_PAY_MCHID、WX_PAY_API_KEY' };
    }
    const certPem = process.env.WX_PAY_CERT_PEM || (process.env.WX_PAY_CERT_BASE64 ? Buffer.from(process.env.WX_PAY_CERT_BASE64, 'base64').toString('utf8') : '');
    const keyPem = process.env.WX_PAY_KEY_PEM || (process.env.WX_PAY_KEY_BASE64 ? Buffer.from(process.env.WX_PAY_KEY_BASE64, 'base64').toString('utf8') : '');
    if (!certPem || !keyPem) {
      return { code: 500, message: '企业付款需配置商户证书：WX_PAY_CERT_PEM 与 WX_PAY_KEY_PEM（或 BASE64）' };
    }
    const partnerTradeNoStr = String(partnerTradeNo).replace(/[^a-zA-Z0-9]/g, '').substring(0, 32) || ('WD' + Date.now());
    const transferParams = {
      mch_appid: WX_PAY_CONFIG.appid,
      mchid: WX_PAY_CONFIG.mchid,
      nonce_str: generateNonceStr(),
      partner_trade_no: partnerTradeNoStr,
      openid: String(openid),
      check_name: 'NO_CHECK',
      amount: String(amountFen),
      desc: String(desc || '商家提现').substring(0, 99)
    };
    transferParams.sign = generateSign(transferParams, WX_PAY_CONFIG.apiKey);
    const xmlData = objectToXml(transferParams);
    const responseData = await callWxPayRefundAPI('https://api.mch.weixin.qq.com/mmpaymkttransfers/promotion/transfers', xmlData, certPem, keyPem);
    if (responseData.return_code !== 'SUCCESS') {
      return { code: 500, message: responseData.return_msg || '企业付款请求失败' };
    }
    if (responseData.result_code !== 'SUCCESS') {
      return { code: 500, message: responseData.err_code_des || responseData.err_code || '企业付款失败' };
    }
    console.log('【企业付款到零钱】成功，商户单号:', partnerTradeNoStr);
    return { code: 200, message: '打款成功', data: { payment_no: responseData.payment_no } };
  } catch (error) {
    console.error('【企业付款到零钱】异常:', error);
    return { code: 500, message: error.message || '企业付款异常', error: error.toString() };
  }
}

/**
 * 取消订单时退款（由 orderManage 调用）
 * 若订单为统一付款（unifiedPaymentId），微信侧支付单为 unified_payments.out_trade_no，需用该单号做部分退款；否则用 order.orderNo 做整单退款。
 */
async function refundOrder(data) {
  try {
    const { orderId, refundAmount: refundAmountYuan } = data;
    if (!orderId) return { code: 400, message: '缺少订单ID' };
    const orderResult = await db.collection('orders').doc(orderId).get();
    if (!orderResult.data) return { code: 404, message: '订单不存在' };
    const order = orderResult.data;
    if (order.payStatus !== 'paid') {
      return { code: 200, message: '订单未支付，无需退款', data: { skipped: true } };
    }
    const orderNo = order.orderNo;
    if (!orderNo) return { code: 400, message: '订单号缺失' };
    let refundFeeFen;
    if (refundAmountYuan != null && refundAmountYuan > 0) {
      refundFeeFen = Math.floor(Number(refundAmountYuan) * 100);
    } else {
      refundFeeFen = order.amountPayable != null ? order.amountPayable : order.amountTotal;
      if (refundFeeFen == null) return { code: 400, message: '订单金额缺失' };
      if (typeof refundFeeFen === 'number' && refundFeeFen < 100) refundFeeFen = Math.round(refundFeeFen * 100);
      refundFeeFen = Math.floor(Number(refundFeeFen));
    }
    if (refundFeeFen <= 0) return { code: 400, message: '订单金额无效' };

    let outTradeNoForWx = String(orderNo);
    let totalFeeFenForWx = refundFeeFen;
    if (order.unifiedPaymentId) {
      const upRes = await db.collection('unified_payments').doc(order.unifiedPaymentId).get();
      if (!upRes.data) return { code: 404, message: '统一支付单不存在' };
      const rec = upRes.data;
      outTradeNoForWx = String(rec.out_trade_no || '');
      totalFeeFenForWx = Math.floor(Number(rec.totalFeeFen) || 0);
      if (!outTradeNoForWx) return { code: 400, message: '统一支付单号缺失' };
      if (totalFeeFenForWx <= 0) return { code: 400, message: '统一支付金额无效' };
    }

    const WX_PAY_CONFIG = getWxPayConfig();
    if (!WX_PAY_CONFIG.appid || !WX_PAY_CONFIG.mchid || !WX_PAY_CONFIG.apiKey) {
      return { code: 500, message: '支付配置不完整，请配置 WX_PAY_APPID、WX_PAY_MCHID、WX_PAY_API_KEY' };
    }
    const certPem = process.env.WX_PAY_CERT_PEM || (process.env.WX_PAY_CERT_BASE64 ? Buffer.from(process.env.WX_PAY_CERT_BASE64, 'base64').toString('utf8') : '');
    const keyPem = process.env.WX_PAY_KEY_PEM || (process.env.WX_PAY_KEY_BASE64 ? Buffer.from(process.env.WX_PAY_KEY_BASE64, 'base64').toString('utf8') : '');
    if (!certPem || !keyPem) {
      return { code: 500, message: '退款需配置商户证书：环境变量 WX_PAY_CERT_PEM 与 WX_PAY_KEY_PEM（或 BASE64 版本）' };
    }
    const outRefundNo = 'RF' + Date.now() + Math.random().toString(36).substr(2, 6).toUpperCase();
    const refundParams = {
      appid: WX_PAY_CONFIG.appid,
      mch_id: WX_PAY_CONFIG.mchid,
      nonce_str: generateNonceStr(),
      out_trade_no: outTradeNoForWx,
      out_refund_no: outRefundNo,
      total_fee: String(totalFeeFenForWx),
      refund_fee: String(refundFeeFen),
      op_user_id: WX_PAY_CONFIG.mchid
    };
    refundParams.sign = generateSign(refundParams, WX_PAY_CONFIG.apiKey);
    const xmlData = objectToXml(refundParams);
    const responseData = await callWxPayRefundAPI('https://api.mch.weixin.qq.com/secapi/pay/refund', xmlData, certPem, keyPem);
    if (responseData.return_code !== 'SUCCESS') {
      return { code: 500, message: responseData.return_msg || '退款请求失败' };
    }
    if (responseData.result_code !== 'SUCCESS') {
      return { code: 500, message: responseData.err_code_des || responseData.err_code || '退款失败' };
    }
    console.log('【退款】成功，订单号:', orderNo, '微信单号:', outTradeNoForWx, '退款单号:', outRefundNo);
    return { code: 200, message: '退款成功', data: { outRefundNo } };
  } catch (error) {
    console.error('【退款】异常:', error);
    return { code: 500, message: error.message || '退款异常', error: error.toString() };
  }
}

// 主函数
exports.main = async (event, context) => {
  try {
    const { OPENID } = cloud.getWXContext();
    const { action, data } = event;
    
    console.log('【支付管理】请求:', { action, data, openid: OPENID });
    
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
      case 'unifiedOrder':
        result = await unifiedOrder(OPENID, data);
        break;
      case 'unifiedPrepay':
        result = await unifiedPrepay(OPENID, data);
        break;
      case 'unifiedOrderDeposit':
        result = await unifiedOrderDeposit(data);
        break;
      case 'queryOrder':
        result = await queryOrder(OPENID, data);
        break;
      case 'queryOrderByOutTradeNo':
        result = await queryOrderByOutTradeNo(data);
        break;
      case 'refundOrder':
        result = await refundOrder(data);
        break;
      case 'refundByOutTradeNo':
        result = await refundByOutTradeNo(data);
        break;
      case 'transferToBalance':
        result = await transferToBalance(data);
        break;
      default:
        result = {
          code: 400,
          message: `不支持的操作: ${action}`
        };
    }
    
    return result;
    
  } catch (error) {
    console.error('【支付管理】主函数异常:', error);
    return {
      code: 500,
      message: error.message || '支付管理异常',
      error: error.toString()
    };
  }
};

