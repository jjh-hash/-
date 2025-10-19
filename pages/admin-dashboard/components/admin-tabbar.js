// 管理后台底部导航栏组件
Component({
  properties: {
    currentTab: {
      type: Number,
      value: 0
    }
  },
  
  methods: {
    switchTab(e) {
      const index = e.currentTarget.dataset.index;
      this.triggerEvent('tabchange', { index: index });
    }
  }
});
