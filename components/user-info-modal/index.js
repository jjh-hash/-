// components/user-info-modal/index.js
Component({
  properties: {
    show: {
      type: Boolean,
      value: false
    },
    userInfo: {
      type: Object,
      value: {
        nickname: '',
        avatar: ''
      }
    }
  },

  data: {
    tempNickname: '',
    tempAvatar: '',
    nicknameSuggestions: ['别倒在黎明之前', '微风不燥', '时光匆匆']
  },

  observers: {
    'userInfo': function(userInfo) {
      console.log('接收用户信息:', userInfo);
      this.setData({
        tempNickname: userInfo.nickname || '',
        tempAvatar: userInfo.avatar || ''
      });
      console.log('临时头像设置:', userInfo.avatar);
    }
  },

  ready() {
    // 组件初始化时，如果有用户信息，设置到临时变量
    const { userInfo } = this.properties;
    if (userInfo) {
      this.setData({
        tempNickname: userInfo.nickname || '',
        tempAvatar: userInfo.avatar || ''
      });
    }
  },

  methods: {
    /**
     * 关闭弹窗
     */
    closeModal() {
      this.triggerEvent('close');
    },

    /**
     * 选择头像（显示额外选项）
     */
    chooseAvatar() {
      const that = this;
      wx.showActionSheet({
        itemList: ['从相册选择', '拍照'],
        success(res) {
          if (res.tapIndex === 0) {
            // 从相册选择
            that.chooseImage();
          } else if (res.tapIndex === 1) {
            // 拍照
            that.takePhoto();
          }
        }
      });
    },

    /**
     * 获取微信头像昵称（已废弃，保留兼容性）
     */
    getUserProfile() {
      wx.showModal({
        title: '提示',
        content: '请点击头像按钮选择微信头像',
        showCancel: false
      });
    },

    /**
     * 从相册选择图片
     */
    chooseImage() {
      const that = this;
      wx.chooseImage({
        count: 1,
        sizeType: ['compressed'],
        sourceType: ['album'],
        success: (res) => {
          // 上传图片到云存储
          that.uploadImage(res.tempFilePaths[0]);
        }
      });
    },

    /**
     * 拍照
     */
    takePhoto() {
      const that = this;
      wx.chooseImage({
        count: 1,
        sizeType: ['compressed'],
        sourceType: ['camera'],
        success: (res) => {
          // 上传图片到云存储
          that.uploadImage(res.tempFilePaths[0]);
        }
      });
    },

    /**
     * 上传图片到云存储
     */
    uploadImage(filePath) {
      const that = this;
      wx.showLoading({
        title: '上传中...',
        mask: true
      });

      const cloudPath = `avatars/${Date.now()}-${Math.random().toString(36).substr(2)}.jpg`;
      
      wx.cloud.uploadFile({
        cloudPath: cloudPath,
        filePath: filePath,
        success: (res) => {
          console.log('上传成功:', res);
          that.setData({
            tempAvatar: res.fileID
          });
          wx.hideLoading();
        },
        fail: (err) => {
          console.error('上传失败:', err);
          wx.hideLoading();
          wx.showToast({
            title: '上传失败',
            icon: 'none'
          });
        }
      });
    },

    /**
     * 选择头像（头像昵称填写能力）
     */
    onChooseAvatar(e) {
      const { avatarUrl } = e.detail;
      console.log('选择微信头像:', avatarUrl);
      
      // 下载微信头像并上传到云存储
      this.downloadAndUploadAvatar(avatarUrl);
    },

    /**
     * 下载并上传头像到云存储
     */
    downloadAndUploadAvatar(url) {
      const that = this;
      
      console.log('开始处理头像URL:', url);
      
      // 检查URL格式
      if (!url || url.trim() === '') {
        wx.showToast({
          title: '头像URL无效',
          icon: 'none'
        });
        return;
      }

      // 如果已经是临时文件路径（微信有时直接返回临时路径），直接上传
      if (url.startsWith('http://tmp/') || url.startsWith('wxfile://')) {
        console.log('检测到临时文件路径，直接上传');
        that.uploadToCloud(url);
        return;
      }

      wx.showLoading({
        title: '上传中...',
        mask: true
      });

      // 先下载图片
      wx.downloadFile({
        url: url,
        header: {
          'User-Agent': 'Mozilla/5.0'
        },
        success: (downloadRes) => {
          console.log('图片下载成功:', downloadRes);
          
          if (!downloadRes.tempFilePath) {
            console.error('下载结果中没有临时文件路径');
            wx.hideLoading();
            wx.showToast({
              title: '下载失败：文件路径无效',
              icon: 'none',
              duration: 2000
            });
            return;
          }
          
          // 上传到云存储
          that.uploadToCloud(downloadRes.tempFilePath);
        },
        fail: (err) => {
          console.error('图片下载失败:', err);
          console.error('错误详情:', JSON.stringify(err));
          
          // 如果下载失败，尝试直接使用原URL（某些情况下可能可以直接使用）
          // 但微信头像URL通常需要下载后才能使用
          wx.hideLoading();
          
          // 显示更详细的错误信息
          let errorMsg = '下载失败';
          if (err.errMsg) {
            if (err.errMsg.includes('timeout')) {
              errorMsg = '下载超时，请检查网络';
            } else if (err.errMsg.includes('fail')) {
              errorMsg = '下载失败，请重试';
            } else {
              errorMsg = `下载失败: ${err.errMsg}`;
            }
          }
          
          wx.showModal({
            title: '下载失败',
            content: errorMsg + '。请尝试重新选择头像，或使用相册/拍照功能上传头像。',
            showCancel: true,
            cancelText: '取消',
            confirmText: '重试',
            success: (res) => {
              if (res.confirm) {
                // 用户选择重试
                that.downloadAndUploadAvatar(url);
              }
            }
          });
        }
      });
    },

    /**
     * 上传文件到云存储
     */
    uploadToCloud(filePath) {
      const that = this;
      
      // 生成云存储路径
      const cloudPath = `avatars/${Date.now()}-${Math.random().toString(36).substr(2)}.jpg`;
      
      console.log('开始上传到云存储:', { filePath, cloudPath });
      
      // 上传到云存储
      wx.cloud.uploadFile({
        cloudPath: cloudPath,
        filePath: filePath,
        success: (uploadRes) => {
          console.log('头像上传成功:', uploadRes);
          that.setData({
            tempAvatar: uploadRes.fileID
          });
          wx.hideLoading();
          wx.showToast({
            title: '头像已保存',
            icon: 'success',
            duration: 1500
          });
        },
        fail: (err) => {
          console.error('头像上传失败:', err);
          console.error('上传错误详情:', JSON.stringify(err));
          wx.hideLoading();
          
          let errorMsg = '上传失败';
          if (err.errMsg) {
            if (err.errMsg.includes('permission')) {
              errorMsg = '上传失败：权限不足';
            } else if (err.errMsg.includes('network')) {
              errorMsg = '上传失败：网络错误';
            } else {
              errorMsg = `上传失败: ${err.errMsg}`;
            }
          }
          
          wx.showToast({
            title: errorMsg,
            icon: 'none',
            duration: 2000
          });
        }
      });
    },

    /**
     * 输入昵称
     */
    onNicknameInput(e) {
      this.setData({
        tempNickname: e.detail.value
      });
    },

    /**
     * 昵称失焦
     */
    onNicknameBlur(e) {
      this.setData({
        tempNickname: e.detail.value
      });
    },

    /**
     * 使用建议昵称
     */
    useSuggestion(e) {
      const nickname = e.currentTarget.dataset.nickname;
      this.setData({
        tempNickname: nickname
      });
    },

    /**
     * 使用微信昵称
     */
    useWechatNickname() {
      // 提示用户昵称输入框会自动获取微信昵称
      wx.showToast({
        title: '昵称框会自动获取',
        icon: 'none',
        duration: 1500
      });
    },

    /**
     * 确认保存
     */
    async confirmSave() {
      const { tempNickname, tempAvatar } = this.data;

      // 验证昵称
      if (!tempNickname || tempNickname.trim() === '') {
        wx.showToast({
          title: '请输入昵称',
          icon: 'none'
        });
        return;
      }

      if (tempNickname.length > 20) {
        wx.showToast({
          title: '昵称不能超过20个字符',
          icon: 'none'
        });
        return;
      }

      // 验证头像
      if (!tempAvatar || tempAvatar.trim() === '') {
        wx.showToast({
          title: '请选择头像',
          icon: 'none'
        });
        return;
      }

      wx.showLoading({
        title: '保存中...',
        mask: true
      });

      try {
        console.log('=== 准备保存用户信息 ===');
        console.log('昵称:', tempNickname.trim());
        console.log('头像URL:', tempAvatar);
        console.log('头像类型:', typeof tempAvatar);
        console.log('头像长度:', tempAvatar ? tempAvatar.length : 0);

        // 验证头像URL格式
        if (tempAvatar && !tempAvatar.startsWith('cloud://') && !tempAvatar.startsWith('http')) {
          console.warn('头像URL格式异常:', tempAvatar);
        }

        // 调用云函数更新用户信息
        const result = await wx.cloud.callFunction({
          name: 'updateUserInfo',
          data: {
            nickname: tempNickname.trim(),
            avatar: tempAvatar
          }
        });

        console.log('=== 云函数返回结果 ===');
        console.log('返回结果:', result);

        wx.hideLoading();

        if (result.result.code === 0) {
          const updatedUserInfo = result.result.data.userInfo;
          
          console.log('更新后的用户信息:', updatedUserInfo);
          
          // 更新本地存储
          wx.setStorageSync('userInfo', updatedUserInfo);
          console.log('本地存储已更新');
          
          // 更新全局数据
          const app = getApp();
          app.globalData.userInfo = updatedUserInfo;
          app.globalData.isLoggedIn = true;
          console.log('全局数据已更新');
          
          wx.showToast({
            title: '保存成功',
            icon: 'success',
            duration: 2000
          });

          // 通知父组件更新完成
          this.triggerEvent('update', {
            userInfo: updatedUserInfo
          });

          // 延迟关闭弹窗，确保提示显示
          setTimeout(() => {
            this.closeModal();
          }, 500);
        } else {
          console.error('云函数返回错误:', result.result);
          wx.showToast({
            title: result.result.message || '保存失败',
            icon: 'none',
            duration: 2000
          });
        }
      } catch (error) {
        wx.hideLoading();
        console.error('保存用户信息失败:', error);
        wx.showToast({
          title: '保存失败: ' + error.message,
          icon: 'none',
          duration: 2000
        });
      }
    }
  }
});

