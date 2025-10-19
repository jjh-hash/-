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
    // 页面加载时的逻辑
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
    this.setData({
      bounty: e.detail.value
    });
  },

  // 立即下单
  onPlaceOrder() {
    // 验证必填项
    if (!this.data.gameType) {
      wx.showToast({
        title: '请选择游戏类型',
        icon: 'none'
      });
      return;
    }

    if (this.data.sessionDuration < 1) {
      wx.showToast({
        title: '开黑时间至少1小时',
        icon: 'none'
      });
      return;
    }

    if (!this.data.requirements.trim() && this.data.selectedRequirements.length === 0) {
      wx.showToast({
        title: '请输入开黑要求或选择标签',
        icon: 'none'
      });
      return;
    }

    // 提交订单
    const orderData = {
      gameType: this.data.gameType,
      sessionDuration: this.data.sessionDuration,
      requirements: this.data.requirements,
      selectedRequirements: this.data.selectedRequirements,
      bounty: this.data.bounty
    };

    console.log('提交游戏陪玩订单:', orderData);
    
    wx.showToast({
      title: '订单提交成功',
      icon: 'success'
    });

    // 延迟返回上一页
    setTimeout(() => {
      wx.navigateBack();
    }, 1500);
  },

  // 返回
  onBackTap() {
    wx.navigateBack();
  }
});
