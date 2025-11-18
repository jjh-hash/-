// pages/admin-settings/index.js
const adminLog = require('../../utils/adminLog');

Page({
  data: {
    statusBarHeight: wx.getWindowInfo().statusBarHeight || 20,
    
    // 平台参数配置
    platformConfig: {
      platformFeeRate: 0.08, // 平台服务费比例（8%）
      deliveryFee: 3, // 配送费（元）
      minOrderAmountLimit: 20, // 最低订单金额下限（元）
      estimatedDeliveryMinutes: 30, // 预计送达时间（分钟）
      orderTimeoutMinutes: 15 // 订单超时时间（分钟）
    },
    
    // 邀请码列表
    inviteCodes: [],
    
    // 轮播图列表
    banners: [],
    
    // 系统公告
    announcements: [],
    
    // 公告弹窗
    showAnnouncementModal: false,
    announcementForm: {
      content: '',
      targetType: 'all' // all/client/merchant
    },
    
    // 开关配置
    switches: {
      allowGuestOrder: false, // 允许游客下单
      autoAcceptOrder: false, // 自动接单
      enableProfitSharing: true, // 启用分账
      enableNotification: true // 启用通知
    }
  },

  onLoad(options) {
    console.log('系统设置页面加载', options);
    
    // 检查是否有特殊操作参数
    if (options.action === 'publishAnnouncement') {
      // 延迟一点打开弹窗，确保页面已加载
      setTimeout(() => {
        this.onPublishAnnouncement();
      }, 300);
    }
    
    this.loadSettings();
  },

  onShow() {
    this.loadSettings();
  },

  // 加载设置数据
  async loadSettings() {
    wx.showLoading({ title: '加载中...' });
    
    try {
      // 加载平台配置
      try {
        const configRes = await wx.cloud.callFunction({
          name: 'platformConfig',
          data: {
            action: 'getConfig',
            data: {}
          }
        });
        
        if (configRes.result && configRes.result.code === 200) {
          const config = configRes.result.data;
          this.setData({
            platformConfig: {
              platformFeeRate: config.platformFeeRate || 0.08,
              deliveryFee: (config.deliveryFee || 300) / 100, // 转换为元
              minOrderAmountLimit: (config.minOrderAmountLimit || 2000) / 100, // 转换为元
              estimatedDeliveryMinutes: config.estimatedDeliveryMinutes || 30,
              orderTimeoutMinutes: config.orderTimeoutMinutes || 15
            }
          });
        }
      } catch (err) {
        console.error('加载平台配置失败:', err);
      }
      
      // 加载邀请码列表
      const inviteRes = await wx.cloud.callFunction({
        name: 'inviteCodeManage',
        data: {
          action: 'getList',
          data: {}
        }
      });
      
      if (inviteRes.result && inviteRes.result.code === 200) {
        this.setData({
          inviteCodes: inviteRes.result.data.list || []
        });
      }
      
      // 加载轮播图列表
      const bannerRes = await wx.cloud.callFunction({
        name: 'bannerManage',
        data: {
          action: 'getList',
          data: {}
        }
      });
      
      if (bannerRes.result && bannerRes.result.code === 200) {
        this.setData({
          banners: bannerRes.result.data.list || []
        });
      }
      
      // 加载公告列表
      const announcementRes = await wx.cloud.callFunction({
        name: 'announcementManage',
        data: {
          action: 'getList',
          data: {}
        }
      });
      
      if (announcementRes.result && announcementRes.result.code === 200) {
        // 格式化时间
        const announcements = (announcementRes.result.data.list || []).map(item => {
          return {
            ...item,
            createdAt: this.formatDate(item.createdAt)
          };
        });
        this.setData({
          announcements: announcements
        });
      }
      
      wx.hideLoading();
    } catch (err) {
      wx.hideLoading();
      console.error('加载设置失败:', err);
      // 使用默认数据
    }
  },

  // 修改平台参数
  onEditConfig(e) {
    const type = e.currentTarget.dataset.type;
    const config = this.data.platformConfig;
    let title = '';
    let placeholder = '';
    let currentValue = '';
    
    switch (type) {
      case 'platformFeeRate':
        title = '修改平台服务费比例';
        placeholder = '请输入百分比（例如：8 表示8%）';
        currentValue = String(config.platformFeeRate * 100);
        break;
      case 'deliveryFee':
        title = '修改配送费';
        placeholder = '请输入配送费（元）';
        currentValue = String(config.deliveryFee);
        break;
      case 'minOrderAmountLimit':
        title = '修改最低订单金额下限';
        placeholder = '请输入金额（元）';
        currentValue = String(config.minOrderAmountLimit);
        break;
      case 'estimatedDeliveryMinutes':
        title = '修改预计送达时间';
        placeholder = '请输入分钟数';
        currentValue = String(config.estimatedDeliveryMinutes);
        break;
      case 'orderTimeoutMinutes':
        title = '修改订单超时时间';
        placeholder = '请输入分钟数';
        currentValue = String(config.orderTimeoutMinutes);
        break;
      default:
        return;
    }
    
    wx.showModal({
      title: title,
      editable: true,
      placeholderText: placeholder,
      content: currentValue,
      success: (res) => {
        if (res.confirm && res.content) {
          this.updateConfig(type, res.content.trim());
        }
      }
    });
  },

  // 更新配置
  async updateConfig(type, value) {
    wx.showLoading({ title: '保存中...' });
    
    try {
      const updateData = {};
      
      // 根据类型转换数据
      switch (type) {
        case 'platformFeeRate':
          const rate = parseFloat(value) / 100; // 转换为小数
          if (isNaN(rate) || rate < 0 || rate > 1) {
            wx.hideLoading();
            wx.showToast({
              title: '服务费比例必须在0-100%之间',
              icon: 'none'
            });
            return;
          }
          updateData.platformFeeRate = rate;
          break;
        case 'deliveryFee':
          updateData.deliveryFee = value;
          break;
        case 'minOrderAmountLimit':
          updateData.minOrderAmountLimit = value;
          break;
        case 'estimatedDeliveryMinutes':
          updateData.estimatedDeliveryMinutes = value;
          break;
        case 'orderTimeoutMinutes':
          updateData.orderTimeoutMinutes = value;
          break;
        default:
          wx.hideLoading();
          wx.showToast({
            title: '无效的参数类型',
            icon: 'none'
          });
          return;
      }
      
      // 调用云函数更新配置
      const res = await wx.cloud.callFunction({
        name: 'platformConfig',
        data: {
          action: 'updateConfig',
          data: updateData
        }
      });
      
      wx.hideLoading();
      
      if (res.result && res.result.code === 200) {
        wx.showToast({
          title: '保存成功',
          icon: 'success'
        });
        
        // 重新加载配置
        this.loadSettings();
      } else {
        wx.showToast({
          title: res.result?.message || '保存失败',
          icon: 'none'
        });
      }
    } catch (err) {
      wx.hideLoading();
      console.error('更新配置失败:', err);
      wx.showToast({
        title: '保存失败',
        icon: 'none'
      });
    }
  },

  // 创建邀请码
  onCreateInviteCode() {
    wx.showModal({
      title: '创建邀请码',
      content: '请输入邀请码的有效天数',
      editable: true,
      placeholderText: '例如：30',
      success: async (res) => {
        if (res.confirm && res.content) {
          const days = parseInt(res.content);
          if (isNaN(days) || days <= 0) {
            wx.showToast({
              title: '请输入有效天数',
              icon: 'none'
            });
            return;
          }
          
          // 生成随机邀请码
          const code = this.generateRandomCode();
          
          wx.showLoading({ title: '创建中...' });
          
          try {
            const createRes = await wx.cloud.callFunction({
              name: 'inviteCodeManage',
              data: {
                action: 'create',
                data: {
                  code: code,
                  maxUses: 1,
                  description: '平台邀请码',
                  expiredDays: days
                }
              }
            });
            
            wx.hideLoading();
            
            if (createRes.result && createRes.result.code === 200) {
              // 记录操作日志
              await adminLog.recordInviteCodeManage('create', code, 'success');
              
              wx.showModal({
                title: '创建成功',
                content: `邀请码：${code}\n有效期：${days}天`,
                showCancel: false,
                success: () => {
                  this.loadSettings();
                }
              });
            } else {
              wx.showToast({
                title: createRes.result.message || '创建失败',
                icon: 'none'
              });
            }
          } catch (err) {
            wx.hideLoading();
            wx.showToast({
              title: '创建失败',
              icon: 'none'
            });
          }
        }
      }
    });
  },

  // 生成随机邀请码
  generateRandomCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  },

  // 复制邀请码
  onCopyCode(e) {
    const code = e.currentTarget.dataset.code;
    wx.setClipboardData({
      data: code,
      success: () => {
        wx.showToast({
          title: '已复制',
          icon: 'success'
        });
      }
    });
  },

  // 删除邀请码
  onDeleteCode(e) {
    const codeId = e.currentTarget.dataset.id;
    
    wx.showModal({
      title: '确认删除',
      content: '确定要删除此邀请码吗？',
      success: async (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '删除中...' });
          
          try {
            const deleteRes = await wx.cloud.callFunction({
              name: 'inviteCodeManage',
              data: {
                action: 'delete',
                data: { codeId }
              }
            });
            
            wx.hideLoading();
            
            if (deleteRes.result && deleteRes.result.code === 200) {
              // 记录操作日志
              await adminLog.recordInviteCodeManage('delete', '', 'success');
              
              wx.showToast({
                title: '删除成功',
                icon: 'success'
              });
              this.loadSettings();
            } else {
              wx.showToast({
                title: deleteRes.result.message || '删除失败',
                icon: 'none'
              });
            }
          } catch (err) {
            wx.hideLoading();
            wx.showToast({
              title: '删除失败',
              icon: 'none'
            });
          }
        }
      }
    });
  },

  // 发布公告
  onPublishAnnouncement() {
    this.setData({
      showAnnouncementModal: true,
      announcementForm: {
        content: '',
        targetType: 'all' // 默认全部
      }
    });
  },

  // 关闭公告弹窗
  onCloseAnnouncementModal() {
    this.setData({
      showAnnouncementModal: false
    });
  },

  // 选择发布范围
  onSelectTargetType(e) {
    const targetType = e.currentTarget.dataset.type;
    this.setData({
      'announcementForm.targetType': targetType
    });
  },

  // 输入公告内容
  onAnnouncementContentInput(e) {
    this.setData({
      'announcementForm.content': e.detail.value
    });
  },

  // 确认发布公告
  async onConfirmPublishAnnouncement() {
    const { content, targetType } = this.data.announcementForm;
    
    if (!content || !content.trim()) {
      wx.showToast({
        title: '请输入公告内容',
        icon: 'none'
      });
      return;
    }
    
    wx.showLoading({ title: '发布中...' });
    
    try {
      // 调用云函数发布公告
      const createRes = await wx.cloud.callFunction({
        name: 'announcementManage',
        data: {
          action: 'create',
          data: {
            title: '系统公告',
            content: content.trim(),
            status: 'active',
            priority: 0,
            targetType: targetType
          }
        }
      });
      
      wx.hideLoading();
      
      if (createRes.result && createRes.result.code === 200) {
        // 记录操作日志
        await adminLog.recordAnnouncementManage('create', 'success');
        
        wx.showToast({
          title: '发布成功',
          icon: 'success'
        });
        
        this.onCloseAnnouncementModal();
        this.loadSettings();
      } else {
        wx.showToast({
          title: createRes.result.message || '发布失败',
          icon: 'none'
        });
      }
    } catch (err) {
      wx.hideLoading();
      console.error('发布公告失败:', err);
      wx.showToast({
        title: '发布失败',
        icon: 'none'
      });
    }
  },

  // 切换开关
  onToggleSwitch(e) {
    const key = e.currentTarget.dataset.key;
    const value = !this.data.switches[key];
    
    this.setData({
      [`switches.${key}`]: value
    });
    
    wx.showToast({
      title: value ? '已开启' : '已关闭',
      icon: 'success'
    });
  },

  // 数据备份
  onBackupData() {
    wx.showModal({
      title: '数据备份',
      content: '确定要备份所有数据吗？备份可能需要较长时间。',
      success: async (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '备份中...' });
          
          try {
            // 模拟备份
            setTimeout(() => {
              wx.hideLoading();
              wx.showToast({
                title: '备份成功',
                icon: 'success'
              });
            }, 2000);
          } catch (err) {
            wx.hideLoading();
            wx.showToast({
              title: '备份失败',
              icon: 'none'
            });
          }
        }
      }
    });
  },

  // 清理缓存
  onClearCache() {
    wx.showModal({
      title: '清理缓存',
      content: '确定要清理所有缓存数据吗？',
      success: (res) => {
        if (res.confirm) {
          wx.clearStorageSync();
          wx.showToast({
            title: '清理成功',
            icon: 'success'
          });
        }
      }
    });
  },

  // 添加轮播图
  onAddBanner() {
    wx.navigateTo({
      url: '/subpackages/admin/pages/admin-banner-edit/index?mode=add'
    });
  },

  // 编辑轮播图
  onEditBanner(e) {
    const bannerId = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/subpackages/admin/pages/admin-banner-edit/index?mode=edit&bannerId=${bannerId}`
    });
  },

  // 删除轮播图
  onDeleteBanner(e) {
    const bannerId = e.currentTarget.dataset.id;
    
    wx.showModal({
      title: '确认删除',
      content: '确定要删除此轮播图吗？',
      success: async (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '删除中...' });
          
          try {
            const deleteRes = await wx.cloud.callFunction({
              name: 'bannerManage',
              data: {
                action: 'delete',
                data: { bannerId }
              }
            });
            
            wx.hideLoading();
            
            if (deleteRes.result && deleteRes.result.code === 200) {
              // 记录操作日志
              await adminLog.recordBannerManage('delete', 'success');
              
              wx.showToast({
                title: '删除成功',
                icon: 'success'
              });
              this.loadSettings();
            } else {
              wx.showToast({
                title: deleteRes.result.message || '删除失败',
                icon: 'none'
              });
            }
          } catch (err) {
            wx.hideLoading();
            wx.showToast({
              title: '删除失败',
              icon: 'none'
            });
          }
        }
      }
    });
  },

  // 删除公告
  onDeleteAnnouncement(e) {
    const announcementId = e.currentTarget.dataset.id;
    
    wx.showModal({
      title: '确认删除',
      content: '确定要删除这条公告吗？删除后无法恢复。',
      confirmColor: '#ff4d4f',
      success: async (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '删除中...' });
          
          try {
            const deleteRes = await wx.cloud.callFunction({
              name: 'announcementManage',
              data: {
                action: 'delete',
                data: {
                  announcementId: announcementId
                }
              }
            });
            
            wx.hideLoading();
            
            if (deleteRes.result && deleteRes.result.code === 200) {
              // 记录操作日志
              await adminLog.recordAnnouncementManage('delete', 'success');
              
              wx.showToast({
                title: '删除成功',
                icon: 'success'
              });
              
              this.loadSettings();
            } else {
              wx.showToast({
                title: deleteRes.result.message || '删除失败',
                icon: 'none'
              });
            }
          } catch (err) {
            wx.hideLoading();
            console.error('删除公告失败:', err);
            wx.showToast({
              title: '删除失败',
              icon: 'none'
            });
          }
        }
      }
    });
  },

  // 格式化日期
  formatDate(date) {
    if (!date) return '';
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hour = String(d.getHours()).padStart(2, '0');
    const minute = String(d.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day} ${hour}:${minute}`;
  },

  // 返回
  onBack() {
    wx.navigateBack();
  }
});

