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
    ]
  },

  onLoad() {
    // 页面加载时加载用户默认地址
    this.loadUserAddress();
    // 初始化总价
    this.updateTotalPrice();
  },

  onShow() {
    // 从地址选择页面返回时，地址已在onSelectAddress中通过setData设置
  },

  // 加载用户默认地址
  async loadUserAddress() {
    try {
      const res = await wx.cloud.callFunction({
        name: 'addressManage',
        data: {
          action: 'getAddressList',
          data: {}
        }
      });

      console.log('【游戏开黑页面】加载地址结果:', res.result);

      if (res.result && res.result.code === 200 && res.result.data.list.length > 0) {
        // 获取默认地址或第一个地址
        const defaultAddress = res.result.data.list.find(addr => addr.isDefault) || res.result.data.list[0];
        console.log('【游戏开黑页面】设置默认地址:', defaultAddress);
        this.setData({
          address: defaultAddress
        });
      } else {
        console.log('【游戏开黑页面】用户没有地址');
      }
    } catch (error) {
      console.error('加载地址失败:', error);
    }
  },

  // 选择地址
  onSelectAddress() {
    wx.navigateTo({
      url: '/pages/address/index?from=gaming'
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
      missingFields.push('收货地址');
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
        totalPrice: totalPrice
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
          title: '发布成功，已为您打开任务大厅',
          icon: 'success',
          duration: 2000
        });

        setTimeout(() => {
          wx.reLaunch({
            url: '/subpackages/order/pages/receive-order/index'
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

  // 返回
  onBackTap() {
    wx.navigateBack();
  }
});
