// pages/message/index.js
Page({
  data: {
    statusBarHeight: wx.getWindowInfo().statusBarHeight || 20,
    messages: [],
    loading: false,
    hasMore: true,
    page: 1,
    pageSize: 20,
    userInfo: null
  },

  onLoad() {
    // 获取用户信息
    const userInfo = wx.getStorageSync('userInfo');
    this.setData({ userInfo });
    this.loadMessages();
  },

  onShow() {
    // 更新用户信息
    const userInfo = wx.getStorageSync('userInfo');
    this.setData({ userInfo });
    
    // 每次显示时刷新消息列表
    this.setData({
      page: 1,
      hasMore: true,
      messages: []
    });
    this.loadMessages();
  },

  // 加载消息列表
  async loadMessages() {
    if (this.data.loading) return;
    
    this.setData({ loading: true });

    try {
      const res = await wx.cloud.callFunction({
        name: 'messageManage',
        data: {
          action: 'getMessageList',
          data: {
            page: this.data.page,
            pageSize: this.data.pageSize
          }
        }
      });

      if (res.result && res.result.code === 200) {
        const newMessages = res.result.data.list || [];
        const messages = this.data.page === 1 
          ? newMessages 
          : [...this.data.messages, ...newMessages];

        this.setData({
          messages: messages,
          hasMore: newMessages.length >= this.data.pageSize,
          loading: false
        });
      } else {
        wx.showToast({
          title: res.result?.message || '加载失败',
          icon: 'none'
        });
        this.setData({ loading: false });
      }
    } catch (err) {
      console.error('加载消息列表失败:', err);
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      });
      this.setData({ loading: false });
    }
  },

  // 下拉刷新
  onPullDownRefresh() {
    this.setData({
      page: 1,
      hasMore: true,
      messages: []
    });
    this.loadMessages().then(() => {
      wx.stopPullDownRefresh();
    });
  },

  // 上拉加载更多
  onReachBottom() {
    if (this.data.hasMore && !this.data.loading) {
      this.setData({
        page: this.data.page + 1
      });
      this.loadMessages();
    }
  },

  // 获取消息类型图标和文本
  getMessageTypeInfo(type) {
    const typeMap = {
      'order': { icon: '📦', text: '订单联系', color: '#1a73e8' },
      'gaming': { icon: '🎮', text: '游戏陪玩', color: '#ff6b35' },
      'express': { icon: '🚚', text: '快递跑腿', color: '#10b981' },
      'reward': { icon: '🏷️', text: '悬赏', color: '#f59e0b' },
      'secondhand': { icon: '🛍️', text: '闲置出售', color: '#8b5cf6' }
    };
    return typeMap[type] || { icon: '💬', text: '消息', color: '#6b7280' };
  },

  // 格式化时间
  formatTime(timestamp) {
    if (!timestamp) return '';
    
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    
    const minute = 60 * 1000;
    const hour = 60 * minute;
    const day = 24 * hour;
    
    if (diff < minute) {
      return '刚刚';
    } else if (diff < hour) {
      return `${Math.floor(diff / minute)}分钟前`;
    } else if (diff < day) {
      return `${Math.floor(diff / hour)}小时前`;
    } else if (diff < 7 * day) {
      return `${Math.floor(diff / day)}天前`;
    } else {
      const month = date.getMonth() + 1;
      const day = date.getDate();
      return `${month}月${day}日`;
    }
  },

  // 点击消息
  onMessageTap(e) {
    const index = e.currentTarget.dataset.index;
    const message = this.data.messages[index];
    
    if (!message) return;

    // 标记为已读
    const currentUserInfo = wx.getStorageSync('userInfo');
    if (message.status === 'unread' && currentUserInfo && message.toUserId === currentUserInfo.openid) {
      this.updateMessageStatus(message._id, 'read');
    }

    // 跳转到聊天页面
    const otherUserId = message.fromUserId === (currentUserInfo?.openid) ? message.toUserId : message.fromUserId;
    const otherUserName = message.fromUserId === (currentUserInfo?.openid) ? message.toUserName : message.fromUserName;
    
    wx.navigateTo({
      url: `/pages/chat/index?toUserId=${otherUserId}&toUserName=${encodeURIComponent(otherUserName)}&messageType=${message.messageType}&relatedTitle=${encodeURIComponent(message.relatedTitle || '')}`
    });
  },

  // 联系对方
  onContactTap(e) {
    const index = e.currentTarget.dataset.index;
    const message = this.data.messages[index];
    
    if (!message) {
      wx.showToast({
        title: '消息不存在',
        icon: 'none'
      });
      return;
    }

    // 跳转到聊天页面
    const currentUserInfo = wx.getStorageSync('userInfo');
    const otherUserId = message.fromUserId === (currentUserInfo?.openid) ? message.toUserId : message.fromUserId;
    const otherUserName = message.fromUserId === (currentUserInfo?.openid) ? message.toUserName : message.fromUserName;
    
    wx.navigateTo({
      url: `/pages/chat/index?toUserId=${otherUserId}&toUserName=${encodeURIComponent(otherUserName)}&messageType=${message.messageType}&relatedTitle=${encodeURIComponent(message.relatedTitle || '')}`
    });
  },

  // 更新消息状态
  async updateMessageStatus(messageId, status) {
    try {
      await wx.cloud.callFunction({
        name: 'messageManage',
        data: {
          action: 'updateMessageStatus',
          data: {
            messageId: messageId,
            status: status
          }
        }
      });

      // 更新本地状态
      const messages = this.data.messages.map(msg => {
        if (msg._id === messageId) {
          return { ...msg, status: status };
        }
        return msg;
      });

      this.setData({ messages });
    } catch (err) {
      console.error('更新消息状态失败:', err);
    }
  },

  // Tab切换
  onTabTap(e) {
    const tab = e.currentTarget.dataset.tab;
    if (tab === 'home') {
      wx.reLaunch({
        url: '/pages/home/index'
      });
    } else if (tab === 'order') {
      wx.reLaunch({
        url: '/pages/order/index'
      });
    } else if (tab === 'receive') {
      // 接单功能正在开发中
      wx.showToast({
        title: '正在开发中',
        icon: 'none',
        duration: 2000
      });
      // wx.reLaunch({
      //   url: '/pages/receive-order/index'
      // });
    } else if (tab === 'profile') {
      wx.reLaunch({
        url: '/pages/profile/index'
      });
    }
  }
});

