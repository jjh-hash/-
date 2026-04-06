// pages/admin-refund-detail/index.js
const { verifyAdminPage } = require('../../utils/verifyAdminPage.js');

Page({
  data: {
    statusBarHeight: wx.getWindowInfo().statusBarHeight || 20,
    refundId: '',
    refundInfo: null,
    orderInfo: null,
    loading: true
  },

  onLoad(options) {
    if (!verifyAdminPage()) return;
    console.log('【管理端退款详情】接收参数:', options);
    
    if (options.refundId) {
      this.setData({ refundId: options.refundId });
      this.loadRefundDetail(options.refundId);
    } else {
      wx.showToast({
        title: '退款ID缺失',
        icon: 'none'
      });
      setTimeout(() => {
        wx.navigateBack();
      }, 1500);
    }
  },

  // 加载退款详情
  async loadRefundDetail(refundId) {
    try {
      wx.showLoading({ title: '加载中...' });
      
      // 调用云函数获取退款详情
      const res = await wx.cloud.callFunction({
        name: 'refundManage',
        data: {
          action: 'getRefundDetail',
          data: {
            refundId: refundId,
            isAdmin: true // 标记为管理员请求
          }
        }
      });
      
      wx.hideLoading();
      
      if (res.result && res.result.code === 200) {
        const refund = res.result.data?.refund || res.result.data;
        
        if (!refund) {
          wx.showToast({
            title: '退款信息不存在',
            icon: 'none'
          });
          setTimeout(() => {
            wx.navigateBack();
          }, 1500);
          return;
        }
        
        // 查询订单信息
        let orderInfo = null;
        if (refund.orderId) {
          try {
            const orderRes = await wx.cloud.callFunction({
              name: 'orderManage',
              data: {
                action: 'getAdminOrderList',
                data: {
                  orderId: refund.orderId,
                  page: 1,
                  pageSize: 1
                }
              }
            });
            
            if (orderRes.result && orderRes.result.code === 0) {
              const orderList = orderRes.result.data?.list || [];
              if (orderList.length > 0) {
                orderInfo = orderList[0];
              }
            }
          } catch (error) {
            console.error('【管理端退款详情】查询订单信息失败:', error);
          }
        }
        
        // 格式化退款状态文本
        const statusTextMap = {
          'pending': '待处理',
          'processing': '处理中',
          'approved': '已同意',
          'rejected': '已拒绝',
          'completed': '已完成'
        };
        
        // 处理退款原因文本
        const reasonTextMap = {
          'quality': '商品质量问题',
          'wrong': '商品与描述不符',
          'damaged': '商品损坏',
          'missing': '商品缺失',
          'other': '其他原因'
        };
        
        // 如果退款原因是枚举值，转换为文本
        let refundReasonText = refund.refundReason;
        if (refundReasonText && reasonTextMap[refundReasonText]) {
          refundReasonText = reasonTextMap[refundReasonText];
        }
        
        this.setData({
          refundInfo: {
            ...refund,
            statusText: statusTextMap[refund.status] || '未知状态',
            refundReason: refundReasonText || refund.refundReasonText || '未填写'
          },
          orderInfo: orderInfo,
          loading: false
        });
      } else {
        wx.showToast({
          title: res.result?.message || '加载失败',
          icon: 'none'
        });
        setTimeout(() => {
          wx.navigateBack();
        }, 1500);
      }
    } catch (error) {
      console.error('【管理端退款详情】加载失败:', error);
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

  // 预览图片
  onPreviewImage(e) {
    const index = e.currentTarget.dataset.index;
    const images = this.data.refundInfo.images || [];
    
    if (images.length === 0) return;
    
    wx.previewImage({
      current: images[index] || images[0],
      urls: images
    });
  }
});

