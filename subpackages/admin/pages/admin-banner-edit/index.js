// pages/admin-banner-edit/index.js
Page({
  data: {
    statusBarHeight: wx.getWindowInfo().statusBarHeight || 20,
    mode: 'add', // add 或 edit
    bannerId: '',
    
    formData: {
      imageUrl: '',
      linkUrl: '',
      status: 'active'
    },
    
    // 预览图片
    previewImage: ''
  },

  onLoad(options) {
    const { mode, bannerId } = options;
    
    this.setData({
      mode: mode || 'add',
      bannerId: bannerId || ''
    });
    
    if (mode === 'edit' && bannerId) {
      this.loadBannerDetail(bannerId);
    }
  },

  // 加载轮播图详情
  async loadBannerDetail(bannerId) {
    wx.showLoading({ title: '加载中...' });
    
    try {
      const res = await wx.cloud.callFunction({
        name: 'bannerManage',
        data: {
          action: 'getList',
          data: {}
        }
      });
      
      wx.hideLoading();
      
      if (res.result && res.result.code === 200) {
        const banner = res.result.data.list.find(item => item._id === bannerId);
        if (banner) {
          this.setData({
            formData: {
              imageUrl: banner.imageUrl || '',
              linkUrl: banner.linkUrl || '',
              status: banner.status || 'active'
            },
            previewImage: banner.imageUrl || ''
          });
        }
      }
    } catch (err) {
      wx.hideLoading();
      console.error('加载轮播图详情失败:', err);
    }
  },

  // 删除原有照片
  onDeleteImage() {
    wx.showModal({
      title: '确认删除',
      content: '确定要删除当前图片吗？',
      success: (res) => {
        if (res.confirm) {
          this.setData({
            'formData.imageUrl': '',
            previewImage: ''
          });
          wx.showToast({
            title: '已删除',
            icon: 'success'
          });
        }
      }
    });
  },

  // 选择图片并上传
  async onChooseImage() {
    try {
      // 选择图片
      const res = await wx.chooseImage({
        count: 1,
        sizeType: ['compressed'],
        sourceType: ['album', 'camera']
      });
      
      if (res.tempFilePaths && res.tempFilePaths.length > 0) {
        const tempFilePath = res.tempFilePaths[0];
        
        wx.showLoading({ title: '上传中...' });
        
        try {
          // 直接上传图片到云存储
          const cloudPath = `banners/${Date.now()}-${Math.random().toString(36).substr(2, 9)}.jpg`;
          const uploadRes = await wx.cloud.uploadFile({
            cloudPath: cloudPath,
            filePath: tempFilePath
          });
          
          if (uploadRes.fileID) {
            // 获取图片的临时URL用于预览
            const urlRes = await wx.cloud.getTempFileURL({
              fileList: [uploadRes.fileID]
            });
            
            this.setData({
              'formData.imageUrl': uploadRes.fileID,
              previewImage: urlRes.fileList[0].tempFileURL
            });
            
            wx.hideLoading();
            wx.showToast({
              title: '上传成功',
              icon: 'success'
            });
          }
        } catch (err) {
          wx.hideLoading();
          console.error('上传失败:', err);
          wx.showToast({
            title: '上传失败',
            icon: 'none'
          });
        }
      }
    } catch (err) {
      console.error('选择图片失败:', err);
      wx.showToast({
        title: '选择图片失败',
        icon: 'none'
      });
    }
  },


  // 输入链接URL
  onLinkUrlInput(e) {
    this.setData({
      'formData.linkUrl': e.detail.value
    });
  },

  // 切换状态
  onToggleStatus(e) {
    const status = e.detail.value ? 'active' : 'inactive';
    this.setData({
      'formData.status': status
    });
  },

  // 保存
  async onSave() {
    const { formData, mode, bannerId } = this.data;
    
    // 校验必填项
    if (!formData.imageUrl) {
      wx.showToast({
        title: '请上传图片',
        icon: 'none'
      });
      return;
    }
    
    wx.showLoading({ title: '保存中...' });
    
    try {
      let res;
      
      if (mode === 'add') {
        // 创建轮播图
        res = await wx.cloud.callFunction({
          name: 'bannerManage',
          data: {
            action: 'create',
            data: formData
          }
        });
      } else {
        // 更新轮播图
        res = await wx.cloud.callFunction({
          name: 'bannerManage',
          data: {
            action: 'update',
            data: {
              bannerId: bannerId,
              ...formData
            }
          }
        });
      }
      
      wx.hideLoading();
      
      if (res.result && res.result.code === 200) {
        wx.showToast({
          title: '保存成功',
          icon: 'success'
        });
        
        setTimeout(() => {
          wx.navigateBack();
        }, 1500);
      } else {
        wx.showToast({
          title: res.result.message || '保存失败',
          icon: 'none'
        });
      }
    } catch (err) {
      wx.hideLoading();
      wx.showToast({
        title: '保存失败',
        icon: 'none'
      });
      console.error('保存轮播图失败:', err);
    }
  },

  // 返回
  onBack() {
    wx.navigateBack();
  }
});

