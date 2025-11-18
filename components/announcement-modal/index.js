// components/announcement-modal/index.js
Component({
  properties: {
    show: {
      type: Boolean,
      value: false
    },
    announcement: {
      type: Object,
      value: null
    }
  },

  data: {
    showModal: false
  },

  observers: {
    'show': function(show) {
      this.setData({
        showModal: show
      });
    }
  },

  methods: {
    // 关闭弹窗
    onClose() {
      this.setData({
        showModal: false
      });
      this.triggerEvent('close');
    },

    // 阻止事件冒泡
    stopPropagation() {},

    // 确认按钮
    onConfirm() {
      // 移除已读标记逻辑，让公告每次都显示
      this.onClose();
    }
  }
});

