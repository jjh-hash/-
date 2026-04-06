Page({
  data: {
    statusBarHeight: wx.getWindowInfo().statusBarHeight || 20,
    orderId: '',
    orderInfo: {},
    orderStatusText: '订单详情',
    hasReviewed: false,
    firstProductName: '',
    showAddressDetails: false // 地址详情展开/收起状态
  },

  onLoad(options) {
    console.log('【订单详情】接收参数:', options);
    
    if (options.orderId) {
      this.setData({ orderId: options.orderId });
      this.loadOrderDetail(options.orderId);
    } else {
      wx.showToast({
        title: '订单ID缺失',
        icon: 'none'
      });
      setTimeout(() => {
        wx.navigateBack();
      }, 1500);
    }
  },

  // 加载订单详情
  async loadOrderDetail(orderId) {
    try {
      wx.showLoading({ title: '加载中...' });

      const res = await wx.cloud.callFunction({
        name: 'orderManage',
        data: {
          action: 'getOrderList',
          data: {
            page: 1,
            pageSize: 100
          }
        }
      });

      wx.hideLoading();

      if (res.result && res.result.code === 200) {
        const orderList = res.result.data?.list || [];
        const order = orderList.find(o => o._id === orderId);

        if (!order) {
          wx.showToast({
            title: '订单不存在',
            icon: 'none'
          });
          setTimeout(() => {
            wx.navigateBack();
          }, 1500);
          return;
        }

        // 处理订单商品列表
        let orderItems = [];
        if (order.items && Array.isArray(order.items)) {
          orderItems = order.items.map(item => {
            // 价格处理：从分转换为元
            // 数据库中商品价格统一以分存储，需要除以100转换为元
            let price = item.price || 0;
            if (typeof price === 'number') {
              // 如果价格 >= 100，肯定是分，除以100
              // 如果价格 < 100，可能是分（如96分），也可能是元（旧数据），但商品价格通常 >= 1元 = 100分
              if (price >= 100) {
                price = price / 100;
              } else if (price > 0 && price < 100) {
                // 1-99之间的整数，很可能是分（因为商品价格通常 >= 1元 = 100分）
                price = price / 100;
              }
              // 如果 price < 1，可能已经是元了，直接使用
            } else if (typeof price === 'string') {
              const numPrice = parseFloat(price);
              if (isNaN(numPrice)) {
                price = 0;
              } else {
                // 同样的逻辑
                if (numPrice >= 100) {
                  price = numPrice / 100;
                } else if (numPrice > 0 && numPrice < 100) {
                  price = numPrice / 100;
                } else {
                  price = numPrice;
                }
              }
            }
            
            return {
              productId: item.productId,
              productName: item.productName || '商品',
              name: `${item.productName || '商品'}${item.spec ? '(' + item.spec + ')' : ''} x${item.quantity || 1}`,
              spec: item.spec || '',
              quantity: item.quantity || 1,
              qty: item.quantity || 1,
              price: price.toFixed(2),
              image: item.image || ''
            };
          });
        }

        // 格式化地址信息
        let addressText = '';
        if (order.address) {
          const addr = order.address;
          const parts = [];
          if (addr.buildingName) parts.push(addr.buildingName);
          if (addr.houseNumber) parts.push(addr.houseNumber);
          if (addr.addressDetail) parts.push(addr.addressDetail);
          if (!addr.addressDetail && addr.address) parts.push(addr.address);
          addressText = parts.join('');
        }

        // 获取第一个商品名称
        const firstProductName = orderItems.length > 0 
          ? (orderItems[0].productName || '商品')
          : '商品';

        // 格式化订单状态文本
        const statusTextMap = {
          'pending': '待确认',
          'confirmed': '已确认',
          'preparing': '制作中',
          'ready': '待配送',
          'delivering': '配送中',
          'completed': '订单已完成',
          'cancelled': '订单已取消'
        };

        // 格式化订单时间（完整格式）
        const orderTime = this.formatDateTime(order.createdAt);
        
        this.setData({
          orderInfo: {
            id: order._id,
            orderNo: order.orderNo,
            storeId: order.storeId,
            storeName: order.storeName || '商家订单',
            orderStatus: order.orderStatus,
            orderType: order.orderType || 'normal',
            items: orderItems,
            rawItems: order.items || [],
            total: this.formatAmount(order.amountPayable || order.amountTotal || '0.00'),
            amountGoods: this.formatAmount(order.amountGoods || '0.00'),
            amountDelivery: this.formatAmount(order.amountDelivery || '0.00'),
            platformFee: this.formatAmount(order.platformFee || '0.00'),
            address: order.address || null,
            addressText: addressText,
            date: this.formatDate(order.createdAt),
            orderTime: orderTime, // 完整订单时间
            remark: order.remark || '',
            deliveryType: order.deliveryType || 'delivery', // 配送方式
            expectedTime: order.expectedTime || '立即配送', // 期望时间
            paymentMethod: order.paymentMethod || '在线支付', // 支付方式
            needCutlery: order.needCutlery !== undefined ? order.needCutlery : true, // 是否需要餐具
            cutleryQuantity: order.cutleryQuantity || 0 // 餐具数量
          },
          orderStatusText: statusTextMap[order.orderStatus] || '订单详情',
          firstProductName: firstProductName.length > 10 ? firstProductName.substring(0, 10) + '...' : firstProductName,
          showOrderDetails: false, // 订单详细信息展开/收起状态
          showAddressDetails: false // 地址详情展开/收起状态
        });

        // 检查是否已评价
        this.checkReviewStatus(orderId);
      } else {
        wx.showToast({
          title: res.result?.message || '加载失败',
          icon: 'none'
        });
      }
    } catch (error) {
      wx.hideLoading();
      console.error('【订单详情】加载异常:', error);
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      });
    }
  },

  // 检查评价状态
  async checkReviewStatus(orderId) {
    try {
      const res = await wx.cloud.callFunction({
        name: 'reviewManage',
        data: {
          action: 'getMyReviews',
          data: {}
        }
      });

      if (res.result && res.result.code === 200) {
        const reviews = res.result.data?.list || [];
        const hasReview = reviews.some(review => review.orderId === orderId);
        this.setData({ hasReviewed: hasReview });
      }
    } catch (error) {
      console.error('检查评价状态失败:', error);
    }
  },

  // 格式化金额
  formatAmount(amount) {
    if (typeof amount === 'number') {
      return amount.toFixed(2);
    }
    if (typeof amount === 'string') {
      const num = parseFloat(amount);
      if (isNaN(num)) {
        return '0.00';

      }
      return num.toFixed(2);
    }
    return '0.00';
  },

  // 格式化日期
  // 格式化日期为中国时间（UTC+8）
  formatDate(date) {
    if (!date) return '';
    
    let d;
    let dateStr = date;
    
    // 处理云数据库的Date对象（有getTime方法）
    if (date && typeof date === 'object' && date.getTime && typeof date.getTime === 'function') {
      d = new Date(date.getTime());
    } else if (date && typeof date === 'object' && date.getFullYear) {
      d = date;
    } else if (typeof date === 'string') {
      if (dateStr.includes(' ') && !dateStr.includes('T')) {
        // 检查是否有时区信息
        const hasTimezone = dateStr.endsWith('Z') || 
                           /[+-]\d{2}:?\d{2}$/.test(dateStr) ||
                           dateStr.match(/[+-]\d{4}$/);
        if (!hasTimezone) {
          dateStr = dateStr.replace(' ', 'T') + 'Z';
        } else {
          dateStr = dateStr.replace(' ', 'T');
        }
      }
      if (dateStr.includes('-') && !dateStr.includes('T') && !dateStr.includes('Z')) {
        dateStr = dateStr.replace(/(\d{4})-(\d{2})-(\d{2})/, '$1/$2/$3');
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
      return '';
    }
    
    // 云数据库通常返回UTC时间，需要转换为中国时间（UTC+8）
    const chinaTimeOffset = 8 * 60 * 60 * 1000;
    const chinaTime = new Date(d.getTime() + chinaTimeOffset);
    
    const year = chinaTime.getUTCFullYear();
    const month = String(chinaTime.getUTCMonth() + 1).padStart(2, '0');
    const day = String(chinaTime.getUTCDate()).padStart(2, '0');
    return `${year}.${month}.${day}`;
  },

  // 格式化日期时间为中国时间（UTC+8）
  formatDateTime(date) {
    if (!date) return '';
    
    let d;
    let dateStr = date;
    
    // 处理云数据库的Date对象（有getTime方法）
    if (date && typeof date === 'object' && date.getTime && typeof date.getTime === 'function') {
      d = new Date(date.getTime());
    } else if (date && typeof date === 'object' && date.getFullYear) {
      d = date;
    } else if (typeof date === 'string') {
      if (dateStr.includes(' ') && !dateStr.includes('T')) {
        // 检查是否有时区信息
        const hasTimezone = dateStr.endsWith('Z') || 
                           /[+-]\d{2}:?\d{2}$/.test(dateStr) ||
                           dateStr.match(/[+-]\d{4}$/);
        if (!hasTimezone) {
          dateStr = dateStr.replace(' ', 'T') + 'Z';
        } else {
          dateStr = dateStr.replace(' ', 'T');
        }
      }
      if (dateStr.includes('-') && !dateStr.includes('T') && !dateStr.includes('Z')) {
        dateStr = dateStr.replace(/(\d{4})-(\d{2})-(\d{2})/, '$1/$2/$3');
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
      return '';
    }
    
    // 云数据库通常返回UTC时间，需要转换为中国时间（UTC+8）
    const chinaTimeOffset = 8 * 60 * 60 * 1000;
    const chinaTime = new Date(d.getTime() + chinaTimeOffset);
    
    const year = chinaTime.getUTCFullYear();
    const month = String(chinaTime.getUTCMonth() + 1).padStart(2, '0');
    const day = String(chinaTime.getUTCDate()).padStart(2, '0');
    const hours = String(chinaTime.getUTCHours()).padStart(2, '0');
    const minutes = String(chinaTime.getUTCMinutes()).padStart(2, '0');
    const seconds = String(chinaTime.getUTCSeconds()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  },

  // 复制订单号
  onCopyOrderNo() {
    const orderNo = this.data.orderInfo.orderNo;
    wx.setClipboardData({
      data: orderNo,
      success: () => {
        wx.showToast({
          title: '订单号已复制',
          icon: 'success'
        });
      }
    });
  },

  // 切换订单详细信息展开/收起
  onToggleOrderDetails() {
    this.setData({
      showOrderDetails: !this.data.showOrderDetails
    });
  },

  // 切换地址详情展开/收起
  onToggleAddressDetails() {
    this.setData({
      showAddressDetails: !this.data.showAddressDetails
    });
  },

  // 返回
  onBack() {
    wx.navigateBack();
  },

  // 更多操作
  onMore() {
    wx.showActionSheet({
      itemList: ['联系商家', '查看订单号', '分享订单'],
      success: (res) => {
        console.log('选择了:', res.tapIndex);
        if (res.tapIndex === 0) {
          // 联系商家
          wx.showToast({
            title: '功能开发中',
            icon: 'none'
          });
        } else if (res.tapIndex === 1) {
          // 查看订单号
          wx.showModal({
            title: '订单号',
            content: this.data.orderInfo.orderNo,
            showCancel: false
          });
        }
      }
    });
  },

  // 申请退款
  onRefund() {
    const orderInfo = this.data.orderInfo;
    if (orderInfo && orderInfo.id) {
      wx.navigateTo({
        url: `/subpackages/order/pages/refund-apply/index?orderId=${orderInfo.id}`,
        fail: (err) => {
          console.error('跳转到退款申请页面失败:', err);
          // 如果subpackage路径失败，尝试主包路径
          wx.navigateTo({
            url: `/pages/refund-apply/index?orderId=${orderInfo.id}`,
            fail: (err2) => {
              console.error('跳转到退款申请页面失败（主包路径）:', err2);
              wx.showToast({
                title: '跳转失败',
                icon: 'none'
              });
            }
          });
        }
      });
    } else {
      wx.showToast({
        title: '订单信息缺失',
        icon: 'none'
      });
    }
  },

  // 评价
  onReview() {
    const orderInfo = this.data.orderInfo;
    if (orderInfo.storeId) {
      wx.navigateTo({
        url: `/subpackages/store/pages/submit-review/index?orderId=${orderInfo.id}&storeId=${orderInfo.storeId}`,
        fail: (err) => {
          console.error('跳转到提交评论页面失败:', err);
          // 如果subpackage路径失败，尝试主包路径
          wx.navigateTo({
            url: `/pages/submit-review/index?orderId=${orderInfo.id}&storeId=${orderInfo.storeId}`,
            fail: (err2) => {
              console.error('跳转到提交评论页面失败（主包路径）:', err2);
              wx.showToast({
                title: '跳转失败',
                icon: 'none'
              });
            }
          });
        }
      });
    } else {
      wx.showToast({
        title: '店铺信息缺失',
        icon: 'none'
      });
    }
  },

  // 再来一单
  async onOrderAgain() {
    if (!getApp().ensureLogin('请先登录后再下单')) return;
    const orderInfo = this.data.orderInfo;
    
    if (orderInfo.orderType === 'express') {
      wx.navigateTo({
        url: '/pages/express/index'
      });
    } else if (orderInfo.orderType === 'gaming') {
      wx.navigateTo({
        url: '/pages/gaming/index'
      });
    } else if (orderInfo.orderType === 'reward') {
      wx.navigateTo({
        url: '/pages/reward/index'
      });
    } else {
      // 普通订单
      if (!orderInfo.storeId) {
        wx.showToast({
          title: '店铺信息缺失',
          icon: 'none'
        });
        return;
      }

      // 构建购物车数据
      const cartItems = [];
      if (orderInfo.rawItems && orderInfo.rawItems.length > 0) {
        orderInfo.rawItems.forEach(item => {
          // 价格处理：从分转换为元
          // 数据库中商品价格统一以分存储，需要除以100转换为元
          let price = item.price || 0;
          if (typeof price === 'number') {
            // 如果价格 >= 100，肯定是分，除以100
            // 如果价格 < 100，可能是分（如96分），也可能是元（旧数据），但商品价格通常 >= 1元 = 100分
            if (price >= 100) {
              price = price / 100;
            } else if (price > 0 && price < 100) {
              // 1-99之间的整数，很可能是分（因为商品价格通常 >= 1元 = 100分）
              price = price / 100;
            }
            // 如果 price < 1，可能已经是元了，直接使用
          } else if (typeof price === 'string') {
            const numPrice = parseFloat(price);
            if (!isNaN(numPrice)) {
              if (numPrice >= 100) {
                price = numPrice / 100;
              } else if (numPrice > 0 && numPrice < 100) {
                price = numPrice / 100;
              } else {
                price = numPrice;
              }
            } else {
              price = 0;
            }
          }
          
          cartItems.push({
            id: item.productId,
            name: item.productName || '商品',
            price: price,
            quantity: item.quantity || 1,
            image: item.image || '',
            spec: item.spec || '',
            selectedSpecs: item.spec ? [{ optionName: item.spec }] : []
          });
        });
      }

      const cartTotal = cartItems.reduce((sum, item) => {
        return sum + (item.price * item.quantity);
      }, 0);

      try {
        wx.showLoading({ title: '加载中...' });
        
        const storeRes = await wx.cloud.callFunction({
          name: 'storeManage',
          data: {
            action: 'getStoreDetail',
            data: {
              storeId: orderInfo.storeId
            }
          }
        });
        
        wx.hideLoading();
        
        if (storeRes.result && storeRes.result.code === 200) {
          const storeInfo = storeRes.result.data.storeInfo || {};
          
          const cartData = {
            cartItems: cartItems,
            cartTotal: cartTotal,
            storeInfo: {
              storeId: orderInfo.storeId,
              _id: orderInfo.storeId,
              name: storeInfo.name || orderInfo.storeName,
              deliveryFee: storeInfo.deliveryFee || parseFloat(orderInfo.amountDelivery) || 2,
              minOrder: storeInfo.minOrder || 0
            }
          };
          
          wx.navigateTo({
            url: `/subpackages/store/pages/checkout/index?cartData=${encodeURIComponent(JSON.stringify(cartData))}`
          });
        } else {
          wx.showToast({
            title: '获取店铺信息失败',
            icon: 'none'
          });
        }
      } catch (error) {
        wx.hideLoading();
        console.error('再来一单失败:', error);
        wx.showToast({
          title: '操作失败，请重试',
          icon: 'none'
        });
      }
    }
  },

});


