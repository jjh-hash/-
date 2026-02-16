// 微信支付管理云函数
const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();

exports.main = async (event, context) => {
  try {
    const { OPENID, APPID } = cloud.getWXContext();
    const { action, data } = event;
    
    console.log('【支付管理】请求:', { action, data, openid: OPENID });
    
    if (!action) {
      return {
        code: 400,
        message: '缺少action参数'
      };
    }
    
    let result;
    
    switch (action) {
      case 'unifiedOrder':
        result = await unifiedOrder(OPENID, APPID, data);
        break;
      case 'queryPayment':
        result = await queryPayment(OPENID, data);
        break;
      default:
        console.warn('【支付管理】无效的操作类型:', action);
        result = {
          code: 400,
          message: '无效的操作类型',
          action: action
        };
    }
    
    console.log('【支付管理】返回结果:', result);
    return result;
    
  } catch (error) {
    console.error('【支付管理】异常:', error);
    return {
      code: 500,
      message: '系统异常',
      error: error.message,
      stack: error.stack
    };
  }
};

async function unifiedOrder(openid, appid, data) {
  try {
    const { orderId, totalFee, description } = data;
    
    console.log('【统一下单】参数:', { orderId, totalFee, description });
    
    if (!orderId || !totalFee) {
      return {
        code: 400,
        message: '缺少必要参数：orderId和totalFee'
      };
    }
    
    const orderResult = await db.collection('orders').doc(orderId).get();
    if (!orderResult.data) {
      return {
        code: 404,
        message: '订单不存在'
      };
    }
    
    const order = orderResult.data;
    
    if (order.userOpenid !== openid) {
      return {
        code: 403,
        message: '无权访问此订单'
      };
    }
    
    if (order.payStatus === 'paid') {
      return {
        code: 400,
        message: '订单已支付'
      };
    }
    
    let platformConfig = null;
    try {
      const configRes = await db.collection('platform_config').limit(1).get();
      if (configRes.data.length > 0) {
        platformConfig = configRes.data[0];
      }
    } catch (err) {
      console.warn('【统一下单】获取平台配置失败:', err);
    }
    
    if (!platformConfig || !platformConfig.wechatPay || !platformConfig.wechatPay.mchId || !platformConfig.wechatPay.apiKey) {
      return {
        code: 500,
        message: '支付配置未完成，请联系管理员配置商户号和API密钥'
      };
    }
    
    const { mchId, apiKey } = platformConfig.wechatPay;
    
    if (!mchId || !apiKey) {
      console.error('【统一下单】支付配置不完整:', { mchId, apiKey });
      return {
        code: 500,
        message: '支付配置不完整'
      };
    }
    
    const cleanApiKey = apiKey.trim();
    const cleanMchId = mchId.toString().trim();
    
    console.log('【统一下单】使用配置:', { 
      mchId: cleanMchId, 
      apiKeyLength: cleanApiKey.length
    });
    
    const nonceStr = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    
    const bodyText = description || ('订单支付-' + order.orderNo);
    const unifiedOrderParams = {
      appid: appid,
      mch_id: cleanMchId,
      nonce_str: nonceStr,
      body: bodyText.substring(0, 128),
      out_trade_no: order.orderNo,
      total_fee: Math.round(totalFee),
      spbill_create_ip: '127.0.0.1',
      notify_url: '',
      trade_type: 'JSAPI',
      openid: openid
    };
    
    const sign = generateSign(unifiedOrderParams, cleanApiKey);
    console.log('【统一下单】生成的签名长度:', sign.length);
    unifiedOrderParams.sign = sign;
    
    const xmlData = buildXML(unifiedOrderParams);
    
    const https = require('https');
    const response = await new Promise((resolve, reject) => {
      const req = https.request({
        hostname: 'api.mch.weixin.qq.com',
        path: '/pay/unifiedorder',
        method: 'POST',
        headers: {
          'Content-Type': 'application/xml',
          'Content-Length': Buffer.byteLength(xmlData)
        }
      }, (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          resolve(data);
        });
      });
      
      req.on('error', (err) => {
        reject(err);
      });
      
      req.write(xmlData);
      req.end();
    });
    
    const parseString = require('xml2js').parseString;
    const result = await new Promise((resolve, reject) => {
      parseString(response, { explicitArray: false, ignoreAttrs: true }, (err, result) => {
        if (err) reject(err);
        else resolve(result.xml || result);
      });
    });
    
    if (result.return_code === 'SUCCESS' && result.result_code === 'SUCCESS') {
      const paymentParams = {
        timeStamp: Math.floor(Date.now() / 1000).toString(),
        nonceStr: nonceStr,
        package: 'prepay_id=' + result.prepay_id,
        signType: 'MD5'
      };
      
      const paySign = generateSign({
        appId: appid,
        timeStamp: paymentParams.timeStamp,
        nonceStr: paymentParams.nonceStr,
        package: paymentParams.package,
        signType: paymentParams.signType
      }, cleanApiKey);
      
      paymentParams.paySign = paySign;
      
      await db.collection('orders').doc(orderId).update({
        data: {
          prepayId: result.prepay_id,
          paymentParams: paymentParams,
          updateTime: db.serverDate()
        }
      });
      
      return {
        code: 200,
        message: '统一下单成功',
        data: paymentParams
      };
    } else {
      console.error('【统一下单】微信支付返回错误:', result);
      console.error('【统一下单】错误详情:', {
        return_code: result.return_code,
        return_msg: result.return_msg,
        err_code: result.err_code,
        err_code_des: result.err_code_des
      });
      return {
        code: 500,
        message: result.err_code_des || result.return_msg || '统一下单失败'
      };
    }
    
  } catch (error) {
    console.error('【统一下单】异常:', error);
    return {
      code: 500,
      message: '统一下单异常: ' + error.message,
      error: error.message
    };
  }
}

async function queryPayment(openid, data) {
  try {
    const { orderId } = data;
    
    if (!orderId) {
      return {
        code: 400,
        message: '缺少orderId参数'
      };
    }
    
    const orderResult = await db.collection('orders').doc(orderId).get();
    if (!orderResult.data) {
      return {
        code: 404,
        message: '订单不存在'
      };
    }
    
    const order = orderResult.data;
    
    if (order.userOpenid !== openid) {
      return {
        code: 403,
        message: '无权访问此订单'
      };
    }
    
    return {
      code: 200,
      message: '查询成功',
      data: {
        orderId: order._id,
        orderNo: order.orderNo,
        payStatus: order.payStatus,
        amountTotal: order.amountTotal
      }
    };
    
  } catch (error) {
    console.error('【查询支付】异常:', error);
    return {
      code: 500,
      message: '查询异常',
      error: error.message
    };
  }
}

function generateSign(params, apiKey) {
  const filteredParams = {};
  for (const key in params) {
    if (params[key] !== '' && params[key] !== null && params[key] !== undefined && key !== 'sign') {
      filteredParams[key] = params[key];
    }
  }
  
  const sortedKeys = Object.keys(filteredParams).sort();
  
  let stringA = '';
  for (const key of sortedKeys) {
    stringA += key + '=' + filteredParams[key] + '&';
  }
  stringA += 'key=' + apiKey;
  
  const crypto = require('crypto');
  const sign = crypto.createHash('md5').update(stringA, 'utf8').digest('hex').toUpperCase();
  
  return sign;
}

function buildXML(params) {
  let xml = '<xml>';
  for (const key in params) {
    xml += '<' + key + '><![CDATA[' + params[key] + ']]></' + key + '>';
  }
  xml += '</xml>';
  return xml;
}
