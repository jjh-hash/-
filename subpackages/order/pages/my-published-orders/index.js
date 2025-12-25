Page({
  data: {
    statusBarHeight: wx.getWindowInfo().statusBarHeight || 20,
    orders: [],
    loading: false,
    refreshing: false,
    currentUserOpenid: null,
    currentTab: 'published', // 'published' 我的订单, 'received' 我的接单
  },

  onLoad() {
    console.log('【我发布的订单页面】页面加载');
    this.getCurrentUserOpenid();
    this.loadOrders();
  },

  onShow() {
    console.log('【我发布的订单页面】页面显示，刷新订单');
    this.loadOrders();
  },

  // 获取当前用户openid
  async getCurrentUserOpenid() {
    try {
      const userInfo = wx.getStorageSync('userInfo');
      if (userInfo && userInfo.openid) {
        this.setData({
          currentUserOpenid: userInfo.openid
        });
      } else {
        const app = getApp();
        if (app.globalData.userInfo && app.globalData.userInfo.openid) {
          this.setData({
            currentUserOpenid: app.globalData.userInfo.openid
          });
        }
      }
    } catch (error) {
      console.error('【我发布的订单页面】获取用户openid失败:', error);
    }
  },

  // 下拉刷新
  onPullDownRefresh() {
    console.log('【我发布的订单页面】下拉刷新');
    this.setData({ refreshing: true });
    this.loadOrders(true).finally(() => {
      this.setData({ refreshing: false });
      wx.stopPullDownRefresh();
    });
  },

  // 切换分类
  onTabChange(e) {
    const tab = e.currentTarget.dataset.tab;
    if (tab === this.data.currentTab) {
      return;
    }
    this.setData({
      currentTab: tab,
      orders: []
    });
    this.loadOrders();
  },

  // 加载订单列表
  async loadOrders(isPullRefresh = false) {
    if (this.data.loading) {
      return Promise.resolve();
    }
    
    this.setData({ loading: true });

    try {
      if (!isPullRefresh) {
        wx.showLoading({ title: '加载中...' });
      }

      // 根据当前选中的分类调用不同的云函数
      const action = this.data.currentTab === 'published' ? 'getMyPublishedOrders' : 'getMyReceivedOrders';
      
      const res = await wx.cloud.callFunction({
        name: 'orderManage',
        data: {
          action: action,
          data: {
            page: 1,
            pageSize: 50
          }
        }
      });

      if (!isPullRefresh) {
        wx.hideLoading();
      }

      console.log('【我发布的订单页面】云函数返回结果:', res.result);

      if (res.result && res.result.code === 200) {
        const orderList = res.result.data?.list || [];
        
        const orders = orderList.map(order => ({
          id: order._id,
          orderNo: order.orderNo,
          orderType: order.orderType,
          orderTypeText: this.getOrderTypeText(order.orderType),
          statusText: this.getStatusText(order.orderStatus),
          statusClass: this.getStatusClass(order.orderStatus),
          orderStatus: order.orderStatus,
          createdAt: this.formatDateTime(order.createdAt),
          expiredAt: order.expiredAt || null,
          expiredMinutes: order.expiredMinutes || null,
          expiredAtDisplay: this.formatExpiredAtDisplay(order.expiredAt),
          amountTotal: order.amountTotal || '0.00',
          // 游戏陪玩订单信息
          gameType: order.gameType || null,
          sessionDuration: order.sessionDuration || null,
          taskDuration: order.taskDuration || null,
          taskDurationUnit: order.taskDurationUnit || 'hour',
          requirements: order.requirements || null,
          selectedRequirements: order.selectedRequirements || null,
          // 悬赏订单信息
          category: order.category || null,
          helpLocation: order.helpLocation || null,
          helpContent: order.helpContent || null,
          images: order.images || null,
          // 代拿快递订单信息
          pickupLocation: order.pickupLocation || null,
          deliveryLocation: order.deliveryLocation || null,
          pickupCode: order.pickupCode || null,
          packageSizes: order.packageSizes || null,
          bounty: order.bounty || null,
          // 发布者信息（用于我的接单）
          userOpenid: order.userOpenid || null,
          userId: order.userId || null,
          userInfo: order.userInfo || null,
          // 接单者信息（用于我的订单）
          receiverOpenid: order.receiverOpenid || null,
          receiverId: order.receiverId || null,
          receiverInfo: order.receiverInfo || null,
          receiverConfirmedAt: order.receiverConfirmedAt || null,
          receiverCompletedAt: order.receiverCompletedAt || null,
          userConfirmedAt: order.userConfirmedAt || null
        }));

        this.setData({
          orders: orders,
          loading: false
        });

        console.log('【我发布的订单页面】订单加载成功，共', orders.length, '条');
      } else {
        wx.showToast({
          title: res.result?.message || '加载失败',
          icon: 'none'
        });
        this.setData({ loading: false });
      }

    } catch (error) {
      if (!isPullRefresh) {
        wx.hideLoading();
      }
      console.error('【我发布的订单页面】加载异常:', error);
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      });
      this.setData({ loading: false });
    }
  },

  // 获取订单类型文本
  getOrderTypeText(orderType) {
    const typeMap = {
      'gaming': '游戏陪玩',
      'reward': '悬赏',
      'express': '代拿快递'
    };
    return typeMap[orderType] || '未知';
  },

  // 获取状态文本
  getStatusText(status) {
    const statusMap = {
      'pending': '待接单',
      'received': '已接单',
      'confirmed_by_receiver': '进行中',
      'waiting_user_confirm': '待确认完成',
      'completed': '已完成',
      'cancelled': '已取消'
    };
    return statusMap[status] || '未知状态';
  },

  // 获取状态样式类
  getStatusClass(status) {
    const classMap = {
      'pending': 'pending',
      'received': 'received',
      'confirmed_by_receiver': 'in-progress',
      'waiting_user_confirm': 'waiting-confirm',
      'completed': 'completed',
      'cancelled': 'cancelled'
    };
    return classMap[status] || 'normal';
  },

  // 格式化日期时间
  formatDateTime(dateStr) {
    if (!dateStr) return '';
    
    let d;
    if (dateStr.getTime && typeof dateStr.getTime === 'function') {
      d = new Date(dateStr.getTime());
    } else if (dateStr instanceof Date) {
      d = dateStr;
    } else if (typeof dateStr === 'string') {
      let dateString = dateStr;
      if (dateString.includes(' ') && !dateString.includes('T')) {
        const hasTimezone = dateString.endsWith('Z') || 
                           /[+-]\d{2}:?\d{2}$/.test(dateString) ||
                           dateString.match(/[+-]\d{4}$/);
        if (!hasTimezone) {
          dateString = dateString.replace(' ', 'T') + 'Z';
        } else {
          dateString = dateString.replace(' ', 'T');
        }
      }
      d = new Date(dateString);
    } else if (typeof dateStr === 'object' && dateStr.type === 'date') {
      if (dateStr.date) {
        d = new Date(dateStr.date);
      } else {
        d = new Date(dateStr);
      }
    } else {
      d = new Date(dateStr);
    }
    
    if (isNaN(d.getTime())) {
      return '';
    }
    
    const chinaTimeOffset = 8 * 60 * 60 * 1000;
    const chinaTime = new Date(d.getTime() + chinaTimeOffset);
    
    const year = chinaTime.getUTCFullYear();
    const month = String(chinaTime.getUTCMonth() + 1).padStart(2, '0');
    const day = String(chinaTime.getUTCDate()).padStart(2, '0');
    const hours = String(chinaTime.getUTCHours()).padStart(2, '0');
    const minutes = String(chinaTime.getUTCMinutes()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}`;
  },

  // 格式化截止时间显示
  formatExpiredAtDisplay(expiredAt) {
    if (!expiredAt) return '';
    
    try {
      let expiredDate;
      if (expiredAt instanceof Date) {
        expiredDate = expiredAt;
      } else if (expiredAt && expiredAt.getTime && typeof expiredAt.getTime === 'function') {
        expiredDate = new Date(expiredAt.getTime());
      } else if (typeof expiredAt === 'string') {
        expiredDate = new Date(expiredAt.replace(' ', 'T'));
      } else if (typeof expiredAt === 'object' && expiredAt.type === 'date') {
        expiredDate = new Date(expiredAt.date || expiredAt);
      } else {
        return '';
      }
      
      if (isNaN(expiredDate.getTime())) {
        if (typeof expiredAt === 'string') {
          const dateString = expiredAt.includes(' ') ? expiredAt.replace(' ', 'T') + 'Z' : expiredAt;
          expiredDate = new Date(dateString);
        }
        if (isNaN(expiredDate.getTime())) {
          return '';
        }
      }
      
      const now = new Date();
      const chinaTimeOffset = 8 * 60 * 60 * 1000;
      const expiredChinaTime = new Date(expiredDate.getTime() + chinaTimeOffset);
      const nowChinaTime = new Date(now.getTime());
      
      const diff = expiredChinaTime.getTime() - nowChinaTime.getTime();
      
      // 不再显示已过期，订单不会过期
      // if (diff < 0) {
      //   return '已过期';
      // }
      
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const month = expiredChinaTime.getMonth() + 1;
      const date = expiredChinaTime.getDate();
      const hoursStr = String(expiredChinaTime.getHours()).padStart(2, '0');
      const minutesStr = String(expiredChinaTime.getMinutes()).padStart(2, '0');
      
      if (days === 0) {
        return `今天 ${hoursStr}:${minutesStr}截止`;
      } else if (days === 1) {
        return `明天 ${hoursStr}:${minutesStr}截止`;
      } else {
        return `${month}/${date} ${hoursStr}:${minutesStr}截止`;
      }
    } catch (error) {
      console.error('格式化截止时间失败:', error, expiredAt);
      return '';
    }
  },

  // 用户确认订单完成
  async onUserConfirmComplete(e) {
    const orderId = e.currentTarget.dataset.id;
    
    if (!orderId) {
      wx.showToast({
        title: '缺少订单ID',
        icon: 'none'
      });
      return;
    }
    
    try {
      wx.showLoading({ title: '处理中...' });

      const res = await wx.cloud.callFunction({
        name: 'orderManage',
        data: {
          action: 'userConfirmComplete',
          data: {
            orderId: orderId
          }
        }
      });

      wx.hideLoading();

      if (res.result && res.result.code === 200) {
        wx.showToast({
          title: '确认完成成功',
          icon: 'success'
        });
        
        this.loadOrders();
      } else {
        wx.showToast({
          title: res.result?.message || '操作失败',
          icon: 'none'
        });
      }

    } catch (error) {
      wx.hideLoading();
      console.error('【我发布的订单页面】用户确认订单完成异常:', error);
      wx.showToast({
        title: '操作失败',
        icon: 'none'
      });
    }
  },

  // 联系发布者（我的接单中）
  async onContactPublisher(e) {
    console.log('【我接取的订单页面】点击联系发布者', e);
    const orderId = e.currentTarget.dataset.id;
    console.log('【我接取的订单页面】订单ID:', orderId);
    
    const order = this.data.orders.find(o => o.id === orderId);
    console.log('【我接取的订单页面】找到订单:', order);
    
    if (!order) {
      wx.showToast({
        title: '订单不存在',
        icon: 'none',
        duration: 2000
      });
      return;
    }
    
    if (!order.userInfo) {
      wx.showToast({
        title: '暂无发布者信息',
        icon: 'none',
        duration: 2000
      });
      return;
    }
    
    console.log('【我接取的订单页面】发布者信息:', order.userInfo);

    // 从 userInfo 中获取联系方式
    let phone = order.userInfo.phone || '';
    let wechat = order.userInfo.wechat || '';
    let qq = order.userInfo.qq || '';
    
    // 如果 userInfo 中没有完整的联系方式，尝试从用户信息中获取
    if ((!phone && !wechat && !qq) && (order.userId || order.userOpenid)) {
      try {
        wx.showLoading({ title: '获取联系方式...' });
        let userRes;
        
        if (order.userId) {
          userRes = await wx.cloud.callFunction({
            name: 'userManage',
            data: {
              action: 'getDetail',
              data: {
                userId: order.userId
              }
            }
          });
        } else if (order.userOpenid) {
          userRes = await wx.cloud.callFunction({
            name: 'userManage',
            data: {
              action: 'getDetail',
              data: {
                openid: order.userOpenid
              }
            }
          });
        }
        
        wx.hideLoading();
        
        if (userRes && userRes.result && userRes.result.code === 200 && userRes.result.data && userRes.result.data.user) {
          const user = userRes.result.data.user;
          // 如果 userInfo 中没有，则使用用户信息中的
          if (!phone && user.phone) {
            phone = user.phone;
          }
          if (!wechat && user.wechat) {
            wechat = user.wechat;
          }
          if (!qq && user.qq) {
            qq = user.qq;
          }
        }
      } catch (err) {
        wx.hideLoading();
        console.error('【我接取的订单页面】获取发布者信息失败:', err);
        // 即使获取失败，也继续显示已有的信息
      }
    }
    
    // 构建联系方式列表
    const contactOptions = [];
    const contactActions = [];
    
    if (phone && phone.trim() !== '') {
      contactOptions.push(`📞 电话：${phone}`);
      contactActions.push({ type: 'phone', value: phone });
    }
    
    if (wechat && wechat.trim() !== '') {
      contactOptions.push(`💬 微信号：${wechat}`);
      contactActions.push({ type: 'wechat', value: wechat });
    }
    
    if (qq && qq.trim() !== '') {
      contactOptions.push(`💬 QQ号：${qq}`);
      contactActions.push({ type: 'qq', value: qq });
    }
    
    if (contactOptions.length === 0) {
      wx.showModal({
        title: '提示',
        content: '发布者未设置联系方式，无法联系',
        showCancel: false,
        confirmText: '知道了'
      });
      return;
    }
    
    // 显示联系方式选择菜单
    wx.showActionSheet({
      itemList: contactOptions,
      success: (res) => {
        const selectedAction = contactActions[res.tapIndex];
        if (selectedAction.type === 'phone') {
          // 电话相关操作
          wx.showActionSheet({
            itemList: ['复制电话', '拨打电话'],
            success: (phoneRes) => {
              if (phoneRes.tapIndex === 0) {
                // 复制电话
                wx.setClipboardData({
                  data: selectedAction.value,
                  success: () => {
                    wx.showToast({
                      title: '电话已复制',
                      icon: 'success'
                    });
                  }
                });
              } else if (phoneRes.tapIndex === 1) {
                // 拨打电话
                wx.makePhoneCall({
                  phoneNumber: selectedAction.value,
                  fail: () => {
                    wx.showToast({
                      title: '拨打失败',
                      icon: 'none'
                    });
                  }
                });
              }
            }
          });
        } else if (selectedAction.type === 'wechat') {
          // 微信号相关操作
          wx.showActionSheet({
            itemList: ['复制微信号'],
            success: (wechatRes) => {
              if (wechatRes.tapIndex === 0) {
                // 复制微信号
                wx.setClipboardData({
                  data: selectedAction.value,
                  success: () => {
                    wx.showToast({
                      title: '微信号已复制',
                      icon: 'success'
                    });
                  }
                });
              }
            }
          });
        } else if (selectedAction.type === 'qq') {
          // QQ号相关操作
          wx.showActionSheet({
            itemList: ['复制QQ号'],
            success: (qqRes) => {
              if (qqRes.tapIndex === 0) {
                // 复制QQ号
                wx.setClipboardData({
                  data: selectedAction.value,
                  success: () => {
                    wx.showToast({
                      title: 'QQ号已复制',
                      icon: 'success'
                    });
                  }
                });
              }
            }
          });
        }
      },
      fail: (err) => {
        console.error('【我接取的订单页面】显示联系方式菜单失败:', err);
      }
    });
  },

  // 联系接单者
  async onContactReceiver(e) {
    console.log('【我发布的订单页面】点击联系接单者', e);
    const orderId = e.currentTarget.dataset.id;
    console.log('【我发布的订单页面】订单ID:', orderId);
    
    const order = this.data.orders.find(o => o.id === orderId);
    console.log('【我发布的订单页面】找到订单:', order);
    
    if (!order) {
      wx.showToast({
        title: '订单不存在',
        icon: 'none',
        duration: 2000
      });
      return;
    }
    
    if (!order.receiverInfo) {
      wx.showToast({
        title: '暂无接单者信息',
        icon: 'none',
        duration: 2000
      });
      return;
    }
    
    console.log('【我发布的订单页面】接单者信息:', order.receiverInfo);

    // 从 receiverInfo 中获取联系方式（优先使用 receiverInfo 中的信息）
    let phone = order.receiverInfo.phone || '';
    let wechat = order.receiverInfo.wechat || '';
    let qq = order.receiverInfo.qq || '';
    
    // 如果 receiverInfo 中没有完整的联系方式，尝试从用户信息中获取
    if ((!phone && !wechat && !qq) && (order.receiverId || order.receiverOpenid)) {
      try {
        wx.showLoading({ title: '获取联系方式...' });
        let userRes;
        
        if (order.receiverId) {
          userRes = await wx.cloud.callFunction({
            name: 'userManage',
            data: {
              action: 'getDetail',
              data: {
                userId: order.receiverId
              }
            }
          });
        } else if (order.receiverOpenid) {
          userRes = await wx.cloud.callFunction({
            name: 'userManage',
            data: {
              action: 'getDetail',
              data: {
                openid: order.receiverOpenid
              }
            }
          });
        }
        
        wx.hideLoading();
        
        if (userRes && userRes.result && userRes.result.code === 200 && userRes.result.data && userRes.result.data.user) {
          const user = userRes.result.data.user;
          // 如果 receiverInfo 中没有，则使用用户信息中的
          if (!phone && user.phone) {
            phone = user.phone;
          }
          if (!wechat && user.wechat) {
            wechat = user.wechat;
          }
          if (!qq && user.qq) {
            qq = user.qq;
          }
        }
      } catch (err) {
        wx.hideLoading();
        console.error('【我发布的订单页面】获取接单者信息失败:', err);
        // 即使获取失败，也继续显示已有的信息
      }
    }
    
    // 构建联系方式列表
    const contactOptions = [];
    const contactActions = [];
    
    if (phone && phone.trim() !== '') {
      contactOptions.push(`📞 电话：${phone}`);
      contactActions.push({ type: 'phone', value: phone });
    }
    
    if (wechat && wechat.trim() !== '') {
      contactOptions.push(`💬 微信号：${wechat}`);
      contactActions.push({ type: 'wechat', value: wechat });
    }
    
    if (qq && qq.trim() !== '') {
      contactOptions.push(`💬 QQ号：${qq}`);
      contactActions.push({ type: 'qq', value: qq });
    }
    
    if (contactOptions.length === 0) {
      wx.showModal({
        title: '提示',
        content: '接单者未设置联系方式，无法联系',
        showCancel: false,
        confirmText: '知道了'
      });
      return;
    }
    
    // 显示联系方式选择菜单
    wx.showActionSheet({
      itemList: contactOptions,
      success: (res) => {
        const selectedAction = contactActions[res.tapIndex];
        if (selectedAction.type === 'phone') {
          // 电话相关操作
          wx.showActionSheet({
            itemList: ['复制电话', '拨打电话'],
            success: (phoneRes) => {
              if (phoneRes.tapIndex === 0) {
                // 复制电话
                wx.setClipboardData({
                  data: selectedAction.value,
                  success: () => {
                    wx.showToast({
                      title: '电话已复制',
                      icon: 'success'
                    });
                  }
                });
              } else if (phoneRes.tapIndex === 1) {
                // 拨打电话
                wx.makePhoneCall({
                  phoneNumber: selectedAction.value,
                  fail: () => {
                    wx.showToast({
                      title: '拨打失败',
                      icon: 'none'
                    });
                  }
                });
              }
            }
          });
        } else if (selectedAction.type === 'wechat') {
          // 微信号相关操作
          wx.showActionSheet({
            itemList: ['复制微信号'],
            success: (wechatRes) => {
              if (wechatRes.tapIndex === 0) {
                // 复制微信号
                wx.setClipboardData({
                  data: selectedAction.value,
                  success: () => {
                    wx.showToast({
                      title: '微信号已复制',
                      icon: 'success'
                    });
                  }
                });
              }
            }
          });
        } else if (selectedAction.type === 'qq') {
          // QQ号相关操作
          wx.showActionSheet({
            itemList: ['复制QQ号'],
            success: (qqRes) => {
              if (qqRes.tapIndex === 0) {
                // 复制QQ号
                wx.setClipboardData({
                  data: selectedAction.value,
                  success: () => {
                    wx.showToast({
                      title: 'QQ号已复制',
                      icon: 'success'
                    });
                  }
                });
              }
            }
          });
        }
      },
      fail: (err) => {
        console.error('【我发布的订单页面】显示联系方式菜单失败:', err);
      }
    });
  },

  // 阻止事件冒泡
  stopPropagation() {
    // 空函数，用于阻止事件冒泡
  },

  // 返回
  onBack() {
    const pages = getCurrentPages();
    if (pages.length > 1) {
      wx.navigateBack();
    } else {
      wx.reLaunch({ url: '/subpackages/order/pages/receive-order/index' });
    }
  }
});

