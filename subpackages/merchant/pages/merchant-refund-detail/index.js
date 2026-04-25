Page({
  data: {
    statusBarHeight: wx.getWindowInfo().statusBarHeight || 20,
    orderId: '',
    orderInfo: null,
    refundInfo: null,
    rejectReason: '', // 拒绝退款的理由
    showRejectInput: false // 是否显示拒绝理由输入框
  },

  onLoad(options) {
    console.log('【商家退款详情】接收参数:', options);
    
    if (options.orderId) {
      this.setData({ orderId: options.orderId });
      this.loadOrderAndRefundInfo(options.orderId);
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

  // 加载订单和退款信息
  async loadOrderAndRefundInfo(orderId) {
    try {
      wx.showLoading({ title: '加载中...' });

      // 获取当前登录的商家信息
      const merchantInfo = wx.getStorageSync('merchantInfo');
      const merchantId = merchantInfo?._id || null;
      const storeId = merchantInfo?.storeId || null;

      const res = await wx.cloud.callFunction({
        name: 'orderManage',
        data: {
          action: 'getMerchantOrders',
          data: {
            page: 1,
            pageSize: 100,
            merchantId: merchantId,
            storeId: storeId
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

        if (!order.refundInfo) {
          wx.showToast({
            title: '该订单没有退款申请',
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
            let price = item.price || 0;
            if (typeof price === 'number') {
              price = price >= 100 ? (price / 100) : price;
            } else if (typeof price === 'string') {
              const numPrice = parseFloat(price);
              price = numPrice >= 100 ? (numPrice / 100) : numPrice;
            }
            
            return {
              productId: item.productId,
              productName: item.productName || '商品',
              spec: item.spec || '',
              quantity: item.quantity || 1,
              price: price.toFixed(2),
              image: item.image || '/pages/小标/商家.png'
            };
          });
        }

        this.setData({
          orderInfo: {
            id: order._id,
            orderNo: order.orderNo,
            storeName: order.storeName || '商家订单',
            orderStatus: order.orderStatus,
            items: orderItems,
            total: this.formatAmount(order.amountPayable || order.amountTotal || '0.00'),
            amountGoods: this.formatAmount(order.amountGoods || '0.00'),
            amountDelivery: this.formatAmount(order.amountDelivery || '0.00'),
            platformFee: this.formatAmount(order.platformFee || '0.00'),
            address: order.address || null,
            createdAt: this.formatDateTime(order.createdAt)
          },
          refundInfo: {
            refundId: order.refundInfo.refundId,
            refundNo: order.refundInfo.refundNo,
            refundReason: order.refundInfo.refundReason,
            refundReasonText: order.refundInfo.refundReasonText || '',
            refundAmount: order.refundInfo.refundAmount,
            status: order.refundInfo.status,
            images: order.refundInfo.images || [],
            selectedItems: (order.refundInfo.selectedItems || []).map(item => {
              // 处理退款商品的价格和图片
              let price = item.price || 0;
              if (typeof price === 'number') {
                price = price >= 100 ? (price / 100) : price;
              } else if (typeof price === 'string') {
                const numPrice = parseFloat(price);
                price = numPrice >= 100 ? (numPrice / 100) : numPrice;
              }
              
              return {
                id: item.id || item.productId || `item_${Math.random()}`,
                productId: item.productId,
                productName: item.productName || '商品',
                spec: item.spec || '',
                quantity: item.quantity || 1,
                price: price.toFixed(2),
                image: item.image || '/pages/小标/商家.png'
              };
            }),
            createdAt: order.refundInfo.createdAt
          }
        });

        console.log('【商家退款详情】加载成功');
      } else {
        wx.showToast({
          title: res.result?.message || '加载失败',
          icon: 'none'
        });
      }
    } catch (error) {
      wx.hideLoading();
      console.error('【商家退款详情】加载异常:', error);
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      });
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

  // 格式化日期时间
  formatDateTime(date) {
    if (!date) return '';
    
    let d;
    if (date instanceof Date) {
      d = date;
    } else if (date.getTime && typeof date.getTime === 'function') {
      d = new Date(date.getTime());
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
    } else {
      d = new Date(date);
    }
    
    if (isNaN(d.getTime())) {
      return '';
    }
    
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const seconds = String(d.getSeconds()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  },

  // 预览退款图片
  onPreviewImage(e) {
    const index = e.currentTarget.dataset.index;
    const images = this.data.refundInfo.images || [];
    if (images.length > 0) {
      wx.previewImage({
        current: images[index],
        urls: images
      });
    }
  },

  // 同意退款
  async onApproveRefund() {
    const refundInfo = this.data.refundInfo;
    if (!refundInfo || !refundInfo.refundId) {
      wx.showToast({
        title: '退款信息不存在',
        icon: 'none'
      });
      return;
    }

    wx.showModal({
      title: '确认同意退款',
      content: `确定同意退款申请吗？退款金额：¥${refundInfo.refundAmount}`,
      success: async (res) => {
        if (res.confirm) {
          await this.updateRefundStatus(refundInfo.refundId, 'approved', '');
        }
      }
    });
  },

  // 显示拒绝理由输入框
  onShowRejectInput() {
    this.setData({
      showRejectInput: true
    });
  },

  // 输入拒绝理由
  onRejectReasonInput(e) {
    this.setData({
      rejectReason: e.detail.value
    });
  },

  // 取消拒绝
  onCancelReject() {
    this.setData({
      showRejectInput: false,
      rejectReason: ''
    });
  },

  // 确认拒绝退款
  async onConfirmReject() {
    const refundInfo = this.data.refundInfo;
    const rejectReason = this.data.rejectReason.trim();

    if (!refundInfo || !refundInfo.refundId) {
      wx.showToast({
        title: '退款信息不存在',
        icon: 'none'
      });
      return;
    }

    if (!rejectReason) {
      wx.showToast({
        title: '请输入拒绝理由',
        icon: 'none'
      });
      return;
    }

    wx.showModal({
      title: '确认拒绝退款',
      content: `确定拒绝退款申请吗？拒绝理由：${rejectReason}`,
      success: async (res) => {
        if (res.confirm) {
          await this.updateRefundStatus(refundInfo.refundId, 'rejected', rejectReason);
        }
      }
    });
  },

  // 更新退款状态
  async updateRefundStatus(refundId, status, remark) {
    try {
      wx.showLoading({ title: '处理中...' });

      const res = await wx.cloud.callFunction({
        name: 'refundManage',
        data: {
          action: 'updateRefundStatus',
          data: {
            merchantId: (wx.getStorageSync('merchantInfo') || {})._id || undefined,
            refundId: refundId,
            status: status,
            remark: remark || (status === 'approved' ? '商家已同意退款' : '商家已拒绝退款')
          }
        }
      });

      wx.hideLoading();

      if (res.result && res.result.code === 200) {
        wx.showToast({
          title: status === 'approved' ? '已同意退款' : '已拒绝退款',
          icon: 'success'
        });

        // 延迟返回上一页
        setTimeout(() => {
          wx.navigateBack();
        }, 1500);
      } else {
        wx.showToast({
          title: res.result?.message || '操作失败',
          icon: 'none'
        });
      }
    } catch (error) {
      wx.hideLoading();
      console.error('【商家退款详情】更新退款状态异常:', error);
      wx.showToast({
        title: '操作失败',
        icon: 'none'
      });
    }
  },

  // 返回
  onBack() {
    wx.navigateBack();
  }
});

