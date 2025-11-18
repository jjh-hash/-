// pages/admin-order-detail/index.js
Page({
  data: {
    statusBarHeight: wx.getWindowInfo().statusBarHeight || 20,
    orderId: '',
    orderInfo: {},
    loading: true,
    showAddressDetails: false
  },

  onLoad(options) {
    console.log('【管理端订单详情】接收参数:', options);
    
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
      
      // 直接通过订单ID查询订单详情（优化：不查询所有订单）
      const res = await wx.cloud.callFunction({
        name: 'orderManage',
        data: {
          action: 'getAdminOrderList',
          data: {
            orderId: orderId, // 直接传入订单ID
            page: 1,
            pageSize: 1 // 只需要1条
          }
        }
      });
      
      wx.hideLoading();
      
      if (res.result && res.result.code === 0) {
        const orderList = res.result.data?.list || [];
        const order = orderList[0]; // 直接取第一条
        
        if (!order || order.id !== orderId) {
          wx.showToast({
            title: '订单不存在',
            icon: 'none'
          });
          setTimeout(() => {
            wx.navigateBack();
          }, 1500);
          return;
        }
        
        // 查询完整的退款信息（优化：只查询该订单的退款）
        let refundDetail = null;
        if (order.refundInfo && order.refundInfo.refundId) {
          try {
            const refundRes = await wx.cloud.callFunction({
              name: 'refundManage',
              data: {
                action: 'getRefundDetail',
                data: {
                  refundId: order.refundInfo.refundId // 直接查询退款详情
                }
              }
            });
            
            if (refundRes.result && refundRes.result.code === 200) {
              refundDetail = refundRes.result.data;
            }
          } catch (error) {
            console.error('【管理端订单详情】查询退款详情失败:', error);
          }
        }
        
        // 格式化地址信息
        let addressText = '';
        let address = order.address;
        if (!address && order.storeAddress) {
          // 如果没有地址信息，尝试从店铺地址获取
          addressText = order.storeAddress;
        } else if (address) {
          const addr = address;
          const parts = [];
          if (addr.buildingName) parts.push(addr.buildingName);
          if (addr.houseNumber) parts.push(addr.houseNumber);
          if (addr.addressDetail) parts.push(addr.addressDetail);
          if (!addr.addressDetail && addr.address) parts.push(addr.address);
          addressText = parts.join('');
        }
        
        // 计算平台服务费百分比（用于显示）
        const platformFeeRate = order.platformFeeRate || 0.08;
        const platformFeeRatePercent = Math.round(platformFeeRate * 100);
        
        this.setData({
          orderInfo: {
            ...order,
            address: address || null,
            addressText: addressText,
            refundDetail: refundDetail,
            platformFeeRatePercent: platformFeeRatePercent // 添加百分比值
          },
          loading: false
        });
      } else {
        wx.showToast({
          title: '加载失败',
          icon: 'none'
        });
        setTimeout(() => {
          wx.navigateBack();
        }, 1500);
      }
    } catch (error) {
      console.error('【管理端订单详情】加载失败:', error);
      wx.hideLoading();
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      });
      setTimeout(() => {
        wx.navigateBack();
      }, 1500);
    }
  },

  // 返回
  onBack() {
    wx.navigateBack();
  },

  // 切换地址详情
  onToggleAddressDetails() {
    this.setData({
      showAddressDetails: !this.data.showAddressDetails
    });
  },

  // 复制订单号
  onCopyOrderNo() {
    wx.setClipboardData({
      data: this.data.orderInfo.orderNo,
      success: () => {
        wx.showToast({
          title: '已复制',
          icon: 'success'
        });
      }
    });
  },

  // 查看退款详情
  onViewRefundDetail() {
    if (this.data.orderInfo.refundInfo && this.data.orderInfo.refundInfo.refundId) {
      wx.navigateTo({
        url: `/pages/admin-refund-detail/index?refundId=${this.data.orderInfo.refundInfo.refundId}`
      });
    }
  }
});

