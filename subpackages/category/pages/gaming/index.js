Page({
  data: {
    statusBarHeight: wx.getWindowInfo().statusBarHeight || 20,
    gameType: '英雄联盟手游',
    sessionDuration: 1,
    requirements: '',
    selectedRequirements: [],
    bounty: 0,
    showGameModal: false,
    selectedGameIndex: 0,
    address: null, // 选中的地址信息
    pricePerHour: 0, // 每小时价格（元）- 已取消基础费用
    totalPrice: '0.00', // 总价（格式化后的字符串）
    basePriceDisplay: '0.00', // 基础费用显示
    bountyDisplay: '0.00', // 赏金显示
    gameTypes: [
      '英雄联盟手游',
      '王者荣耀',
      '和平精英',
      '绝地求生手游',
      '原神',
      '穿越火线',
      'QQ飞车',
      '其他游戏'
    ],
    requirementTags: [
      { id: 1, name: '需要女生', active: false },
      { id: 2, name: '需要男生', active: false },
      { id: 3, name: '菜鸟勿扰', active: false },
      { id: 4, name: '大神带飞', active: false },
      { id: 5, name: '黄金以上来', active: false },
      { id: 6, name: '铂金以上来', active: false },
      { id: 7, name: '性别不限', active: false },
      { id: 8, name: '立刻上线', active: false }
    ],
    orderExpiredAt: '', // 订单截止时间（日期时间字符串）
    orderExpiredAtDisplay: '' // 订单截止时间显示文本
  },

  onLoad() {
    // 页面加载时加载用户联系信息
    this.loadContactInfo();
    // 初始化总价
    this.updateTotalPrice();
  },

  onShow() {
    // 从联系信息页面返回时，联系信息已在onSelectAddress中通过setData设置
    // 检查是否有联系信息需要加载
    this.loadContactInfo();
  },

  // 加载用户联系信息
  async loadContactInfo() {
    try {
      // 从本地存储获取用户信息
      const userInfo = wx.getStorageSync('userInfo') || getApp().globalData.userInfo;
      if (userInfo) {
        // 构建联系信息对象（兼容地址格式，用于订单创建）
        const contactInfo = {
          name: userInfo.nickname || '微信用户',
          phone: userInfo.phone || '',
          wechat: userInfo.wechat || '',
          qq: userInfo.qq || '',
          avatar: userInfo.avatar || '',
          // 为了兼容订单创建，保留地址格式字段
          buildingName: '',
          houseNumber: '',
          addressDetail: '',
          address: ''
        };
        
        this.setData({
          address: contactInfo
        });
        console.log('【游戏开黑页面】设置联系信息:', contactInfo);
      } else {
        console.log('【游戏开黑页面】用户信息不存在');
      }
    } catch (error) {
      console.error('加载联系信息失败:', error);
    }
  },

  // 选择联系信息
  onSelectAddress() {
    wx.navigateTo({
      url: '/subpackages/common/pages/contact-info/index?from=gaming'
    });
  },

  // 选择游戏类型
  onGameTypeTap() {
    this.setData({
      showGameModal: true,
      selectedGameIndex: this.data.gameTypes.indexOf(this.data.gameType)
    });
  },

  // 选择游戏
  onSelectGame(e) {
    const index = e.currentTarget.dataset.index;
    const selectedGame = this.data.gameTypes[index];
    this.setData({
      selectedGameIndex: index,
      gameType: selectedGame
    });
  },

  // 确认选择游戏
  onConfirmGame() {
    const selectedGame = this.data.gameTypes[this.data.selectedGameIndex];
    this.setData({
      gameType: selectedGame,
      showGameModal: false
    });
  },

  // 取消选择游戏
  onCancelGame() {
    this.setData({
      showGameModal: false
    });
  },

  // 调整开黑时间
  onDurationChange(e) {
    const type = e.currentTarget.dataset.type;
    let duration = this.data.sessionDuration;
    
    if (type === 'increase') {
      duration = Math.min(duration + 1, 24);
    } else if (type === 'decrease') {
      duration = Math.max(duration - 1, 1);
    }
    
    this.setData({
      sessionDuration: duration
    });
    
    // 更新总价显示
    this.updateTotalPrice();
  },

  // 开黑要求输入
  onRequirementsInput(e) {
    this.setData({
      requirements: e.detail.value
    });
  },

  // 选择要求标签
  onRequirementTagTap(e) {
    const index = e.currentTarget.dataset.index;
    const tags = this.data.requirementTags;
    
    // 切换标签状态
    tags[index].active = !tags[index].active;
    
    // 更新选中的要求
    const selectedRequirements = tags.filter(tag => tag.active).map(tag => tag.name);
    
    this.setData({
      requirementTags: tags,
      selectedRequirements: selectedRequirements
    });
  },

  // 设置赏金
  onBountyInput(e) {
    const bounty = parseFloat(e.detail.value) || 0;
    this.setData({
      bounty: bounty
    });
    
    // 更新总价显示
    this.updateTotalPrice();
  },

  // 更新总价显示（已取消基础费用）
  updateTotalPrice() {
    const totalPrice = this.calculateTotalPrice();
    const bounty = parseFloat(this.data.bounty) || 0;
    
    this.setData({
      totalPrice: totalPrice.toFixed(2),
      basePriceDisplay: '0.00', // 基础费用始终为0
      bountyDisplay: bounty > 0 ? bounty.toFixed(2) : '0.00'
    });
  },

  // 计算总价（已取消基础费用，只计算赏金）
  calculateTotalPrice() {
    const bounty = parseFloat(this.data.bounty) || 0;
    return bounty; // 只返回赏金，不计算基础费用
  },

  // 立即下单
  async onPlaceOrder() {
    // 验证必填项
    const missingFields = [];
    
    if (!this.data.gameType) {
      missingFields.push('游戏类型');
    }

    if (this.data.sessionDuration < 1) {
      missingFields.push('开黑时间至少1小时');
    } else {
      // 验证通过，不添加错误
    }

    if (!this.data.requirements.trim() && this.data.selectedRequirements.length === 0) {
      missingFields.push('开黑要求');
    }

    if (!this.data.address) {
      missingFields.push('联系信息');
    }

    // 如果有缺失项，统一提示
    if (missingFields.length > 0) {
      wx.showToast({
        title: `请完善：${missingFields.join('、')}`,
        icon: 'none',
        duration: 3000
      });
      return;
    }

    wx.showLoading({ title: '提交订单中...' });

    try {
      // 计算总价
      const totalPrice = this.calculateTotalPrice();
      
      // 准备订单数据
      const orderData = {
        orderType: 'gaming', // 订单类型：游戏陪玩
        gameType: this.data.gameType,
        sessionDuration: this.data.sessionDuration,
        requirements: this.data.requirements.trim(),
        selectedRequirements: this.data.selectedRequirements,
        bounty: parseFloat(this.data.bounty) || 0,
        pricePerHour: this.data.pricePerHour,
        address: this.data.address,
        totalPrice: totalPrice,
        orderExpiredAt: this.data.orderExpiredAt // 订单截止时间（日期时间字符串）
      };

      console.log('提交游戏陪玩订单:', orderData);

      // 调用云函数创建订单
      const res = await wx.cloud.callFunction({
        name: 'orderManage',
        data: {
          action: 'createGamingOrder',
          data: orderData
        }
      });

      wx.hideLoading();

      if (res.result && res.result.code === 200) {
        wx.showToast({
          title: '订单提交成功',
          icon: 'success',
          duration: 1500
        });

        // 延迟跳转到首页，跳出当前页面
        setTimeout(() => {
          wx.reLaunch({
            url: '/pages/home/index'
          });
        }, 1500);
      } else {
        wx.showToast({
          title: res.result?.message || '订单提交失败',
          icon: 'none',
          duration: 2000
        });
      }
    } catch (error) {
      wx.hideLoading();
      console.error('提交订单异常:', error);
      wx.showToast({
        title: '订单提交失败，请重试',
        icon: 'none',
        duration: 2000
      });
    }
  },

  // 选择订单截止时间
  onOrderExpiredAtChange(e) {
    const [dateIndex, timeIndex] = e.detail.value;
    const dates = this.data.dateTimeRange[0];
    const times = this.data.dateTimeRange[1];
    
    const dateStr = dates[dateIndex];
    const timeStr = times[timeIndex];
    
    // 解析日期
    const now = new Date();
    const dateMatch = dateStr.match(/(\d+)-(\d+)/);
    if (!dateMatch) return;
    
    const month = parseInt(dateMatch[1]) - 1;
    const date = parseInt(dateMatch[2]);
    const year = now.getFullYear();
    
    // 解析时间
    const [hours, minutes] = timeStr.split(':').map(Number);
    
    // 构建日期时间
    const expiredAt = new Date(year, month, date, hours, minutes);
    
    // 如果选择的是今天，且时间已过，则设置为明天
    if (dateIndex === 0 && expiredAt.getTime() <= now.getTime()) {
      expiredAt.setDate(expiredAt.getDate() + 1);
    }
    
    const expiredAtStr = expiredAt.toISOString().slice(0, 16).replace('T', ' ');
    
    this.setData({
      orderExpiredAt: expiredAtStr,
      orderExpiredAtDisplay: this.formatExpiredAtDisplay(expiredAt),
      dateTimeValue: [dateIndex, timeIndex]
    });
  },

  // 格式化截止时间显示
  formatExpiredAtDisplay(expiredAt) {
    if (!expiredAt) return '';
    
    const now = new Date();
    const diff = expiredAt.getTime() - now.getTime();
    
    if (diff < 0) {
      return '已过期';
    }
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const month = expiredAt.getMonth() + 1;
    const date = expiredAt.getDate();
    const hoursStr = String(expiredAt.getHours()).padStart(2, '0');
    const minutesStr = String(expiredAt.getMinutes()).padStart(2, '0');
    
    if (days === 0) {
      return `今天 ${hoursStr}:${minutesStr}截止`;
    } else if (days === 1) {
      return `明天 ${hoursStr}:${minutesStr}截止`;
    } else {
      return `${month}/${date} ${hoursStr}:${minutesStr}截止`;
    }
  },

  // 返回
  onBackTap() {
    wx.navigateBack();
  }
});
