const { shouldIgnoreChooseAvatarDetail } = require('../../../../utils/chooseAvatarGuard');

Page({
  data: {
    statusBarHeight: wx.getWindowInfo().statusBarHeight || 20,
    tempNickname: '',
    tempAvatar: '',
    tempCampus: '',
    campusIndex: -1,
    campusList: [
      { name: '白沙校区', value: '白沙校区' },
      { name: '金水校区', value: '金水校区' }
    ],
    tempCollege: '',
    tempMajor: '',
    tempPhone: ''
  },

  onLoad() {
    // 加载用户信息
    this.loadUserInfo();
  },

  // 默认占位：未设置时展示，用户可自行修改
  DEFAULT_NICKNAME: '微信用户',
  DEFAULT_AVATAR: '/pages/小标/我的.png',

  /**
   * 加载用户信息（无数据时使用默认占位，用户可自行修改后保存）
   */
  loadUserInfo() {
    const app = getApp();
    let userInfo = null;

    if (app.globalData.isLoggedIn && app.globalData.userInfo) {
      userInfo = app.globalData.userInfo;
    } else {
      userInfo = wx.getStorageSync('userInfo');
    }

    const defaultNickname = this.DEFAULT_NICKNAME;
    const defaultAvatar = this.DEFAULT_AVATAR;

    let campusIndex = -1;
    if (userInfo && userInfo.campus) {
      const index = this.data.campusList.findIndex(item => item.value === userInfo.campus);
      campusIndex = index >= 0 ? index : -1;
    }

    this.setData({
      tempNickname: (userInfo && userInfo.nickname) ? userInfo.nickname : defaultNickname,
      tempAvatar: (userInfo && userInfo.avatar) ? userInfo.avatar : defaultAvatar,
      tempCampus: (userInfo && userInfo.campus) ? userInfo.campus : '',
      campusIndex,
      tempCollege: (userInfo && userInfo.college) ? userInfo.college : '',
      tempMajor: (userInfo && userInfo.major) ? userInfo.major : '',
      tempPhone: (userInfo && userInfo.phone) ? userInfo.phone : ''
    });
  },

  /**
   * 返回
   */
  onBack() {
    wx.navigateBack();
  },

  /**
   * 选择头像（头像昵称填写能力）
   */
  onChooseAvatar(e) {
    if (shouldIgnoreChooseAvatarDetail(e.detail)) return;
    const { avatarUrl } = e.detail;
    console.log('选择微信头像:', avatarUrl);
    this.downloadAndUploadAvatar(avatarUrl);
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
        wx.showToast({
          title: '头像上传成功',
          icon: 'success',
          duration: 1500
        });
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
   * 下载并上传头像到云存储
   */
  downloadAndUploadAvatar(url) {
    const that = this;
    
    console.log('开始处理头像URL:', url);
    
    if (!url || (typeof url === 'string' && url.trim() === '')) return;

    // 如果已经是临时文件路径，直接上传
    if (url.startsWith('http://tmp/') || url.startsWith('wxfile://')) {
      console.log('检测到临时文件路径，直接上传');
      that.uploadImage(url);
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
            title: '下载失败',
            icon: 'none'
          });
          return;
        }
        
        // 上传到云存储
        that.uploadImage(downloadRes.tempFilePath);
      },
      fail: (err) => {
        console.error('图片下载失败:', err);
        wx.hideLoading();
        wx.showToast({
          title: '下载失败，请重试',
          icon: 'none'
        });
      }
    });
  },

  /**
   * 昵称输入
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
    const nickname = e.detail.value.trim();
    this.setData({
      tempNickname: nickname
    });
  },

  /**
   * 校区选择
   */
  onCampusChange(e) {
    const index = parseInt(e.detail.value);
    const campus = this.data.campusList[index].value;
    this.setData({
      campusIndex: index,
      tempCampus: campus
    });
  },

  /**
   * 学院输入
   */
  onCollegeInput(e) {
    this.setData({
      tempCollege: e.detail.value
    });
  },

  /**
   * 学院失焦
   */
  onCollegeBlur(e) {
    const college = e.detail.value.trim();
    this.setData({
      tempCollege: college
    });
  },

  /**
   * 专业输入
   */
  onMajorInput(e) {
    this.setData({
      tempMajor: e.detail.value
    });
  },

  /**
   * 专业失焦
   */
  onMajorBlur(e) {
    const major = e.detail.value.trim();
    this.setData({
      tempMajor: major
    });
  },

  /**
   * 电话输入
   */
  onPhoneInput(e) {
    this.setData({
      tempPhone: e.detail.value
    });
  },

  /**
   * 电话失焦
   */
  onPhoneBlur(e) {
    const phone = e.detail.value.trim();
    this.setData({
      tempPhone: phone
    });
  },

  /**
   * 保存用户信息
   */
  async saveUserInfo() {
    const { tempNickname, tempAvatar, tempCampus, tempCollege, tempMajor, tempPhone } = this.data;
    const nickname = (tempNickname && tempNickname.trim()) ? tempNickname.trim() : this.DEFAULT_NICKNAME;

    if (!nickname) {
      wx.showToast({
        title: '请输入昵称',
        icon: 'none'
      });
      return;
    }

    if (nickname.length > 20) {
      wx.showToast({
        title: '昵称不能超过20个字符',
        icon: 'none'
      });
      return;
    }

    if (tempPhone && tempPhone.length !== 11) {
      wx.showToast({
        title: '请输入11位手机号',
        icon: 'none'
      });
      return;
    }

    wx.showLoading({
      title: '保存中...',
      mask: true
    });

    try {
      const result = await wx.cloud.callFunction({
        name: 'updateUserInfo',
        data: {
          nickname,
          avatar: tempAvatar || '',
          campus: tempCampus || '',
          college: tempCollege || '',
          major: tempMajor || '',
          phone: tempPhone || ''
        }
      });

      wx.hideLoading();

      if (result.result && result.result.code === 0) {
        const updatedUserInfo = result.result.data.userInfo;
        wx.setStorageSync('userInfo', updatedUserInfo);
        const app = getApp();
        if (app.globalData) {
          app.globalData.userInfo = updatedUserInfo;
          app.globalData.isLoggedIn = true;
        }
        wx.showToast({
          title: '保存成功',
          icon: 'success'
        });
      } else {
        wx.showToast({
          title: (result.result && result.result.message) || '保存失败',
          icon: 'none'
        });
      }
    } catch (error) {
      wx.hideLoading();
      console.error('保存用户信息失败:', error);
      wx.showToast({
        title: '保存失败，请重试',
        icon: 'none'
      });
    }
  }
});

