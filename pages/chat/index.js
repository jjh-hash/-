// pages/chat/index.js
Page({
  data: {
    statusBarHeight: wx.getWindowInfo().statusBarHeight || 20,
    chatId: '',
    toUserId: '',
    toUserName: '',
    toUserAvatar: '',
    messages: [],
    inputValue: '',
    loading: false,
    hasMore: true,
    page: 1,
    pageSize: 50,
    messageType: '',
    relatedTitle: '',
    relatedId: '',
    userInfo: null,
    scrollTop: 0,
    scrollIntoView: ''
  },

  onLoad(options) {
    // 获取参数
    const { toUserId, toUserName, chatId, messageType, relatedTitle, relatedId } = options;
    
    if (!toUserId && !chatId) {
      wx.showToast({
        title: '缺少对方信息',
        icon: 'none'
      });
      setTimeout(() => wx.navigateBack(), 1500);
      return;
    }

    // 获取用户信息
    const userInfo = wx.getStorageSync('userInfo');
    this.setData({
      toUserId: toUserId || '',
      toUserName: toUserName ? decodeURIComponent(toUserName) : '用户',
      chatId: chatId || '',
      messageType: messageType || 'order',
      relatedTitle: relatedTitle ? decodeURIComponent(relatedTitle) : '',
      relatedId: relatedId || '',
      userInfo: userInfo
    });

    // 加载对方用户信息（获取头像）
    this.loadToUserInfo();
    
    // 加载聊天消息
    this.loadMessages();
    
    // 标记为已读
    this.markAsRead();
  },

  onShow() {
    // 每次显示时刷新消息列表
    this.setData({
      page: 1,
      hasMore: true,
      messages: []
    });
    this.loadMessages();
    this.markAsRead();
  },

  // 加载对方用户信息
  async loadToUserInfo() {
    if (!this.data.toUserId) return;
    
    try {
      const res = await wx.cloud.callFunction({
        name: 'userManage',
        data: {
          action: 'getUserDetail',
          data: {
            userId: this.data.toUserId,
            openid: this.data.toUserId
          }
        }
      });

      if (res.result && res.result.code === 200) {
        const toUserInfo = res.result.data.user || res.result.data;
        this.setData({
          toUserAvatar: toUserInfo.avatar || '/pages/小标/商家.png',
          toUserName: toUserInfo.nickname || toUserInfo.userName || this.data.toUserName
        });
      }
    } catch (err) {
      console.error('加载对方用户信息失败:', err);
      // 使用默认头像
      this.setData({
        toUserAvatar: '/pages/小标/商家.png'
      });
    }
  },

  // 加载聊天消息
  async loadMessages() {
    if (this.data.loading) return Promise.resolve();
    
    this.setData({ loading: true });

    try {
      const res = await wx.cloud.callFunction({
        name: 'chatManage',
        data: {
          action: 'getChatMessages',
          data: {
            chatId: this.data.chatId,
            toUserId: this.data.toUserId,
            page: this.data.page,
            pageSize: this.data.pageSize
          }
        }
      });

      if (res.result && res.result.code === 200) {
        const newMessages = res.result.data.list || [];
        const messages = this.data.page === 1 
          ? newMessages 
          : [...newMessages, ...this.data.messages]; // 历史消息在前面

        this.setData({
          messages: messages,
          chatId: res.result.data.chatId || this.data.chatId,
          hasMore: newMessages.length >= this.data.pageSize,
          loading: false
        }, () => {
          // 滚动到底部
          if (this.data.page === 1) {
            setTimeout(() => {
              this.scrollToBottom();
            }, 300);
          }
        });
        return Promise.resolve();
      } else {
        wx.showToast({
          title: res.result?.message || '加载失败',
          icon: 'none'
        });
        this.setData({ loading: false });
        return Promise.resolve();
      }
    } catch (err) {
      console.error('加载聊天消息失败:', err);
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      });
      this.setData({ loading: false });
      return Promise.resolve();
    }
  },

  // 输入内容
  onInput(e) {
    this.setData({
      inputValue: e.detail.value
    });
  },

  // 发送消息
  async onSend() {
    const content = this.data.inputValue.trim();
    
    if (!content) {
      wx.showToast({
        title: '请输入消息内容',
        icon: 'none'
      });
      return;
    }

    if (!this.data.toUserId) {
      wx.showToast({
        title: '缺少对方信息',
        icon: 'none'
      });
      return;
    }

    // 显示发送中的消息（乐观更新）
    const tempMessage = {
      _id: 'temp_' + Date.now(),
      chatId: this.data.chatId,
      fromUserId: this.data.userInfo?.openid || '',
      fromUserName: this.data.userInfo?.nickname || '我',
      fromUserAvatar: this.data.userInfo?.avatar || '/pages/小标/商家.png',
      toUserId: this.data.toUserId,
      toUserName: this.data.toUserName,
      toUserAvatar: this.data.toUserAvatar || '/pages/小标/商家.png',
      content: content,
      messageType: this.data.messageType,
      relatedId: '',
      relatedTitle: this.data.relatedTitle,
      status: 'sending',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.setData({
      messages: [...this.data.messages, tempMessage],
      inputValue: ''
    });

    this.scrollToBottom();

    try {
      const res = await wx.cloud.callFunction({
        name: 'chatManage',
        data: {
          action: 'sendMessage',
          data: {
            toUserId: this.data.toUserId,
            toUserName: this.data.toUserName,
            content: content,
            messageType: this.data.messageType,
            relatedId: this.data.relatedId,
            relatedTitle: this.data.relatedTitle
          }
        }
      });

      if (res.result && res.result.code === 200) {
        // 替换临时消息为真实消息
        const messages = this.data.messages.map(msg => {
          if (msg._id === tempMessage._id) {
            return {
              ...msg,
              _id: res.result.data.messageId,
              chatId: res.result.data.chatId,
              status: 'read'
            };
          }
          return msg;
        });

        this.setData({
          messages: messages,
          chatId: res.result.data.chatId || this.data.chatId
        }, () => {
          // 滚动到底部
          setTimeout(() => {
            this.scrollToBottom();
          }, 100);
        });
        
        // 如果这是第一次发送消息，创建消息记录（用于消息列表显示）
        if (this.data.relatedId) {
          try {
            await wx.cloud.callFunction({
              name: 'messageManage',
              data: {
                action: 'createMessage',
                data: {
                  toUserId: this.data.toUserId,
                  toUserName: this.data.toUserName,
                  messageType: this.data.messageType,
                  relatedId: this.data.relatedId,
                  relatedTitle: this.data.relatedTitle,
                  contactPhone: '',
                  contactAction: 'message'
                }
              }
            });
          } catch (err) {
            console.error('【聊天页面】创建消息记录失败:', err);
            // 忽略错误，不影响聊天功能
          }
        }
      } else {
        // 发送失败，移除临时消息
        const messages = this.data.messages.filter(msg => msg._id !== tempMessage._id);
        this.setData({ messages });
        
        wx.showToast({
          title: res.result?.message || '发送失败',
          icon: 'none'
        });
      }
    } catch (err) {
      console.error('发送消息失败:', err);
      
      // 发送失败，移除临时消息
      const messages = this.data.messages.filter(msg => msg._id !== tempMessage._id);
      this.setData({ messages });
      
      wx.showToast({
        title: '发送失败，请重试',
        icon: 'none'
      });
    }
  },

  // 标记为已读
  async markAsRead() {
    if (!this.data.chatId && !this.data.toUserId) return;

    try {
      await wx.cloud.callFunction({
        name: 'chatManage',
        data: {
          action: 'markAsRead',
          data: {
            chatId: this.data.chatId,
            toUserId: this.data.toUserId
          }
        }
      });
    } catch (err) {
      console.error('标记已读失败:', err);
    }
  },

  // 滚动到底部
  scrollToBottom() {
    if (this.data.messages.length === 0) return;
    
    const lastIndex = this.data.messages.length - 1;
    this.setData({
      scrollIntoView: `msg-${lastIndex}`
    });
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

  // 格式化时间
  formatTime(timestamp) {
    if (!timestamp) return '';
    
    const date = new Date(timestamp);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const messageDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    
    const diff = now - date;
    const minute = 60 * 1000;
    const hour = 60 * minute;
    
    if (diff < minute) {
      return '刚刚';
    } else if (diff < hour) {
      return `${Math.floor(diff / minute)}分钟前`;
    } else if (messageDate.getTime() === today.getTime()) {
      // 今天
      const hours = date.getHours();
      const minutes = date.getMinutes();
      return `${hours < 10 ? '0' + hours : hours}:${minutes < 10 ? '0' + minutes : minutes}`;
    } else {
      // 其他日期
      const month = date.getMonth() + 1;
      const day = date.getDate();
      const hours = date.getHours();
      const minutes = date.getMinutes();
      return `${month}月${day}日 ${hours < 10 ? '0' + hours : hours}:${minutes < 10 ? '0' + minutes : minutes}`;
    }
  },

  // 头像加载错误处理
  onAvatarError(e) {
    const type = e.currentTarget.dataset.type;
    if (type === 'self') {
      // 自己的头像加载失败，使用默认头像
      const userInfo = this.data.userInfo;
      if (userInfo) {
        userInfo.avatar = '/pages/小标/商家.png';
        this.setData({ userInfo });
      }
    } else {
      // 对方的头像加载失败，使用默认头像
      this.setData({
        toUserAvatar: '/pages/小标/商家.png'
      });
    }
  },

  // 返回
  onBack() {
    wx.navigateBack();
  }
});

