// components/payment-qrcode-modal/index.js
Component({
  properties: {
    show: {
      type: Boolean,
      value: false
    },
    orderInfo: {
      type: Object,
      value: null
    },
    qrcodeUrl: {
      type: String,
      value: ''
    }
  },

  data: {
    showModal: false,
    qrcodeImage: '', // 本地图片路径（用于长按识别）
    qrcodeUrl: '' // 网络图片URL
  },

  observers: {
    'show': function(show) {
      this.setData({
        showModal: show
      });
      if (show) {
        this.generateQRCode();
      }
    },
    'qrcodeUrl': function(url) {
      if (url) {
        // 如果是网络图片，需要下载到本地才能支持长按识别
        this.downloadQRCode(url);
      }
    }
  },

  methods: {
    // 生成收款码
    generateQRCode() {
      const { orderInfo, qrcodeUrl } = this.properties;
      
      // 优先使用外部提供的收款码URL（固定微信支付收款码）
      if (qrcodeUrl) {
        console.log('使用外部提供的收款码URL:', qrcodeUrl);
        this.downloadQRCode(qrcodeUrl);
        return;
      }

      // 如果没有提供收款码，使用固定的微信支付收款码图片
      // 优先使用本地图片路径（支持长按识别）
      const defaultQRCodeUrl = '/images/wechat-pay-qrcode.png';
      
      console.log('使用默认收款码路径:', defaultQRCodeUrl);
      // 直接使用本地路径（如果图片存在）
      // 如果图片不存在，会在 onImageError 中处理
      this.setData({
        qrcodeImage: defaultQRCodeUrl
      });
    },

    // 下载二维码图片到本地（长按识别需要本地路径）
    downloadQRCode(url) {
      if (!url) {
        return;
      }

      // 如果是本地路径（以 / 开头），直接使用
      // 本地路径可以直接支持长按识别
      if (url.startsWith('/')) {
        console.log('使用本地图片路径:', url);
        this.setData({
          qrcodeImage: url
        });
        // 如果图片加载失败，会在 onImageError 中处理
        return;
      }

      // 网络图片必须下载到本地才能支持长按识别
      wx.showLoading({
        title: '加载中...',
        mask: false
      });

      wx.downloadFile({
        url: url,
        success: (res) => {
          wx.hideLoading();
          if (res.statusCode === 200 && res.tempFilePath) {
            // 使用本地临时文件路径，才能支持长按识别
            console.log('二维码下载成功，本地路径:', res.tempFilePath);
            this.setData({
              qrcodeImage: res.tempFilePath
            });
          } else {
            wx.hideLoading();
            wx.showToast({
              title: '二维码加载失败',
              icon: 'none'
            });
            // 如果下载失败，仍然使用网络URL（虽然可能不支持长按识别）
            this.setData({
              qrcodeImage: url
            });
          }
        },
        fail: (err) => {
          wx.hideLoading();
          console.error('下载二维码失败:', err);
          wx.showToast({
            title: '二维码加载失败',
            icon: 'none'
          });
          // 如果下载失败，仍然使用网络URL
          this.setData({
            qrcodeImage: url
          });
        }
      });
    },

    // 图片加载成功
    onImageLoad(e) {
      console.log('二维码图片加载成功:', e.detail);
      // 确保图片已加载完成
    },

    // 预览二维码（支持长按识别）
    onPreviewQRCode() {
      if (!this.data.qrcodeImage) {
        wx.showToast({
          title: '二维码未加载',
          icon: 'none'
        });
        return;
      }

      // 确保使用本地路径（临时文件路径或本地文件路径）
      let imagePath = this.data.qrcodeImage;
      
      // 如果是网络URL，需要先下载
      if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
        wx.showLoading({
          title: '加载中...',
          mask: false
        });
        
        wx.downloadFile({
          url: imagePath,
          success: (res) => {
            wx.hideLoading();
            if (res.statusCode === 200 && res.tempFilePath) {
              // 使用下载后的本地路径
              this.openPreview(res.tempFilePath);
            } else {
              wx.showToast({
                title: '图片加载失败',
                icon: 'none'
              });
            }
          },
          fail: (err) => {
            wx.hideLoading();
            console.error('下载图片失败:', err);
            wx.showToast({
              title: '图片加载失败',
              icon: 'none'
            });
          }
        });
      } else {
        // 本地路径直接预览
        this.openPreview(imagePath);
      }
    },

    // 打开预览界面
    openPreview(imagePath) {
      console.log('打开预览，图片路径:', imagePath);
      
      // 使用 wx.previewImage 预览图片，在预览界面支持长按识别二维码
      wx.previewImage({
        current: imagePath, // 当前显示图片的链接（必须是本地路径）
        urls: [imagePath], // 需要预览的图片链接列表（必须是本地路径）
        success: () => {
          console.log('预览图片成功，请在预览界面长按识别二维码');
          // 提示用户如何操作
          setTimeout(() => {
            wx.showToast({
              title: '在预览界面长按识别二维码',
              icon: 'none',
              duration: 2000
            });
          }, 500);
        },
        fail: (err) => {
          console.error('预览图片失败:', err);
          wx.showToast({
            title: '预览失败',
            icon: 'none'
          });
        }
      });
    },

    // 图片加载错误
    onImageError(e) {
      console.error('二维码图片加载错误:', e);
      // 如果本地图片加载失败，尝试使用网络图片
      const { qrcodeUrl } = this.properties;
      if (qrcodeUrl && !qrcodeUrl.startsWith('/')) {
        this.downloadQRCode(qrcodeUrl);
      } else {
        wx.showToast({
          title: '二维码加载失败，请检查图片路径',
          icon: 'none',
          duration: 2000
        });
      }
    },

    // 关闭弹窗
    onClose() {
      this.setData({
        showModal: false
      });
      this.triggerEvent('close');
    },

    // 阻止事件冒泡
    stopPropagation() {},

    // 扫描二维码（从相册选择或相机扫描）
    onScanQRCode() {
      wx.scanCode({
        onlyFromCamera: false, // 允许从相册选择
        scanType: ['qrCode', 'barCode'],
        success: (res) => {
          console.log('扫描结果:', res.result);
          
          const scanResult = res.result;
          
          // 处理扫描结果
          // 方式1：检查是否是JSON格式的支付码
          try {
            const scanData = JSON.parse(scanResult);
            if (scanData.type === 'payment') {
              wx.showModal({
                title: '扫描成功',
                content: `订单号：${scanData.orderNo}\n金额：¥${scanData.amount}\n商家：${scanData.merchantName}`,
                showCancel: false,
                confirmText: '确定'
              });
              return;
            }
          } catch (e) {
            // 不是JSON格式，继续检查其他格式
          }
          
          // 方式2：检查是否是管道符分隔的支付码格式（PAYMENT|订单号|金额|商家|时间戳）
          if (scanResult.startsWith('PAYMENT|')) {
            const parts = scanResult.split('|');
            if (parts.length >= 4) {
              wx.showModal({
                title: '扫描成功',
                content: `订单号：${parts[1]}\n金额：¥${parts[2]}\n商家：${parts[3]}`,
                showCancel: false,
                confirmText: '确定'
              });
              return;
            }
          }
          
          // 方式3：检查是否是微信支付URL
          if (scanResult.includes('wxp://') || scanResult.includes('weixin://')) {
            wx.showModal({
              title: '微信支付码',
              content: '检测到微信支付码，请使用微信扫码支付',
              showCancel: false,
              confirmText: '确定'
            });
            return;
          }
          
          // 其他类型的二维码，显示原始内容
          wx.showModal({
            title: '扫描结果',
            content: scanResult.length > 100 ? scanResult.substring(0, 100) + '...' : scanResult,
            showCancel: false,
            confirmText: '确定'
          });
        },
        fail: (err) => {
          console.error('扫描失败:', err);
          if (err.errMsg.includes('auth deny')) {
            wx.showModal({
              title: '需要相机权限',
              content: '请在小程序设置中开启相机权限',
              showCancel: false,
              confirmText: '去设置',
              success: (res) => {
                if (res.confirm) {
                  wx.openSetting();
                }
              }
            });
          } else if (!err.errMsg.includes('cancel')) {
            wx.showToast({
              title: '扫描失败',
              icon: 'none'
            });
          }
        }
      });
    },

    // 确认支付
    onConfirmPayment() {
      wx.showModal({
        title: '确认支付',
        content: '请确认已完成支付',
        success: (res) => {
          if (res.confirm) {
            // 触发支付确认事件
            this.triggerEvent('paymentConfirmed');
            // 关闭弹窗
            this.onClose();
          }
        }
      });
    },

    // 保存收款码到相册
    onSaveQRCode() {
      if (!this.data.qrcodeImage) {
        wx.showToast({
          title: '收款码未生成',
          icon: 'none'
        });
        return;
      }

      wx.showLoading({
        title: '保存中...'
      });

      // 下载图片
      wx.downloadFile({
        url: this.data.qrcodeImage,
        success: (res) => {
          if (res.statusCode === 200) {
            // 保存到相册
            wx.saveImageToPhotosAlbum({
              filePath: res.tempFilePath,
              success: () => {
                wx.hideLoading();
                wx.showToast({
                  title: '保存成功',
                  icon: 'success'
                });
              },
              fail: (err) => {
                wx.hideLoading();
                if (err.errMsg.includes('auth deny')) {
                  wx.showModal({
                    title: '需要相册权限',
                    content: '请在小程序设置中开启相册权限',
                    showCancel: false
                  });
                } else {
                  wx.showToast({
                    title: '保存失败',
                    icon: 'none'
                  });
                }
              }
            });
          } else {
            wx.hideLoading();
            wx.showToast({
              title: '下载失败',
              icon: 'none'
            });
          }
        },
        fail: () => {
          wx.hideLoading();
          wx.showToast({
            title: '下载失败',
            icon: 'none'
          });
        }
      });
    }
  }
});

