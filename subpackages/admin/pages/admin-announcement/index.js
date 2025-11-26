// pages/admin-announcement/index.js
Page({
  data: {
    statusBarHeight: wx.getWindowInfo().statusBarHeight || 20,
    announcements: [],
    showTypeModal: false, // 显示选择公告类型弹窗
    showAddModal: false, // 显示添加/编辑公告弹窗
    currentAnnouncement: null,
    formData: {
      title: '',
      content: '',
      status: 'active',
      priority: 0,
      targetType: 'all' // 公告类型：client（客户端）、all（全部）、merchant（商家端）
    }
  },

  onLoad() {
    this.loadAnnouncements();
  },

  onShow() {
    this.loadAnnouncements();
  },

  // 加载公告列表
  async loadAnnouncements() {
    wx.showLoading({ title: '加载中...' });
    
    try {
      const res = await wx.cloud.callFunction({
        name: 'announcementManage',
        data: {
          action: 'getList',
          data: {}
        }
      });
      
      wx.hideLoading();
      
      console.log('加载公告返回结果:', res);
      
      if (res.result && res.result.code === 200) {
        console.log('公告列表:', res.result.data.list);
        this.setData({
          announcements: res.result.data.list || []
        });
      } else {
        console.error('加载失败，错误信息:', res.result);
        wx.showToast({
          title: res.result ? res.result.message : '加载失败',
          icon: 'none'
        });
      }
    } catch (err) {
      wx.hideLoading();
      console.error('加载公告失败:', err);
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      });
    }
  },

  // 显示选择公告类型弹窗
  showTypeModal() {
    this.setData({
      showTypeModal: true
    });
  },

  // 关闭选择类型弹窗
  closeTypeModal() {
    this.setData({
      showTypeModal: false
    });
  },

  // 选择公告类型并打开编辑弹窗
  onSelectAnnouncementType(e) {
    const targetType = e.currentTarget.dataset.type;
    const typeNames = {
      'client': '客户端公告',
      'all': '全部公告',
      'merchant': '商家端公告'
    };
    
    this.setData({
      showTypeModal: false,
      showAddModal: true,
      currentAnnouncement: null,
      formData: {
        title: typeNames[targetType],
        content: '',
        status: 'active',
        priority: 0,
        targetType: targetType
      }
    });
  },

  // 关闭弹窗
  closeModal() {
    this.setData({
      showAddModal: false,
      currentAnnouncement: null
    });
  },

  // 输入标题（禁用编辑，标题由类型决定）
  onTitleInput(e) {
    // 标题不允许修改，由公告类型自动设置
  },

  // 输入内容
  onContentInput(e) {
    this.setData({
      'formData.content': e.detail.value
    });
  },

  // 切换状态
  onToggleStatus(e) {
    const status = e.detail.value ? 'active' : 'inactive';
    this.setData({
      'formData.status': status
    });
  },

  // 保存公告
  async onSave() {
    const { formData, currentAnnouncement } = this.data;
    
    // 校验必填项
    if (!formData.title || !formData.content) {
      wx.showToast({
        title: '请填写完整信息',
        icon: 'none'
      });
      return;
    }
    
    wx.showLoading({ title: '保存中...' });
    
    try {
      let res;
      
      if (currentAnnouncement) {
        // 更新公告
        res = await wx.cloud.callFunction({
          name: 'announcementManage',
          data: {
            action: 'update',
            data: {
              announcementId: currentAnnouncement._id,
              ...formData
            }
          }
        });
      } else {
        // 创建公告
        console.log('准备创建公告，数据:', formData);
        res = await wx.cloud.callFunction({
          name: 'announcementManage',
          data: {
            action: 'create',
            data: formData
          }
        });
        console.log('云函数返回结果:', res);
      }
      
      wx.hideLoading();
      
      if (res.result && res.result.code === 200) {
        wx.showToast({
          title: '保存成功',
          icon: 'success'
        });
        
        this.closeModal();
        // 延迟刷新，确保数据已写入
        setTimeout(() => {
          this.loadAnnouncements();
        }, 500);
      } else {
        console.error('保存失败，错误信息:', res.result);
        wx.showModal({
          title: '保存失败',
          content: res.result ? res.result.message : '未知错误',
          showCancel: false
        });
      }
    } catch (err) {
      wx.hideLoading();
      console.error('保存公告失败，错误详情:', err);
      wx.showModal({
        title: '保存失败',
        content: err.message || '网络错误，请重试',
        showCancel: false
      });
    }
  },

  // 编辑公告
  onEdit(e) {
    const announcement = e.currentTarget.dataset.announcement;
    this.setData({
      showAddModal: true,
      currentAnnouncement: announcement,
      formData: {
        title: announcement.title,
        content: announcement.content,
        status: announcement.status,
        priority: announcement.priority || 0,
        targetType: announcement.targetType || 'all'
      }
    });
  },

  // 删除公告
  onDelete(e) {
    const announcement = e.currentTarget.dataset.announcement;
    
    wx.showModal({
      title: '确认删除',
      content: '确定要删除这条公告吗？',
      success: async (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '删除中...' });
          
          try {
            const result = await wx.cloud.callFunction({
              name: 'announcementManage',
              data: {
                action: 'delete',
                data: {
                  announcementId: announcement._id
                }
              }
            });
            
            wx.hideLoading();
            
            if (result.result && result.result.code === 200) {
              wx.showToast({
                title: '删除成功',
                icon: 'success'
              });
              this.loadAnnouncements();
            } else {
              wx.showToast({
                title: '删除失败',
                icon: 'none'
              });
            }
          } catch (err) {
            wx.hideLoading();
            wx.showToast({
              title: '删除失败',
              icon: 'none'
            });
            console.error('删除公告失败:', err);
          }
        }
      }
    });
  },

  // 阻止事件冒泡
  stopPropagation(e) {
    // 阻止事件冒泡，防止点击弹窗内部时关闭弹窗
  },

  // 返回
  onBack() {
    wx.navigateBack();
  }
});

