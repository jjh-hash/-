Page({
  data: {
    statusBarHeight: wx.getWindowInfo().statusBarHeight || 20,
    orderId: '',
    orderInfo: null,
    
    // 退款原因
    refundReason: '', // 选择的退款原因
    refundReasonText: '', // 退款原因描述
    refundReasons: [
      '商品质量问题',
      '商品与描述不符',
      '商品损坏',
      '配送超时',
      '商家服务态度差',
      '其他原因'
    ],
    showReasonPicker: false,
    
    // 图片
    images: [],
    maxImages: 9,
    
    // 退款来源（默认退款至支付账户）
    refundSource: 'payment', // payment: 退款至支付账户
    
    // 退款商品选择
    refundItems: [], // 可退款的商品列表
    selectedItems: [], // 选中的商品ID列表
    selectAll: false, // 全选状态
    
    // 已退款信息
    refundedItems: [], // 已退款的商品列表
    totalRefundedAmount: 0, // 已退款总金额
    
    // 退款金额
    refundAmount: 0,
    
    // 其他费用
    otherFees: [], // 准时宝、配送费等
    
    isSubmitting: false
  },

  onLoad(options) {
    console.log('【退款申请】接收参数:', options);
    
    if (options.orderId) {
      this.setData({ orderId: options.orderId });
      this.loadOrderDetail(options.orderId);
    } else {
      wx.showToast({
        title: '订单ID缺失',
        icon: 'none'
      });
      setTimeout(() => {
        wx.navigateBack();
      }, 1500);
    }
  },

  // 加载订单详情
  async loadOrderDetail(orderId) {
    try {
      wx.showLoading({ title: '加载中...' });

      // 并行加载订单信息和已退款信息
      const [orderRes, refundRes] = await Promise.all([
        wx.cloud.callFunction({
          name: 'orderManage',
          data: {
            action: 'getOrderList',
            data: {
              page: 1,
              pageSize: 100
            }
          }
        }),
        wx.cloud.callFunction({
          name: 'refundManage',
          data: {
            action: 'getRefundList',
            data: {
              page: 1,
              pageSize: 100
            }
          }
        })
      ]);

      wx.hideLoading();

      if (orderRes.result && orderRes.result.code === 200) {
        const orderList = orderRes.result.data?.list || [];
        const order = orderList.find(o => o._id === orderId);

        if (!order) {
          wx.showToast({
            title: '订单不存在',
            icon: 'none'
          });
          setTimeout(() => {
            wx.navigateBack();
          }, 1500);
          return;
        }

        // 处理已退款信息
        let refundedItemsMap = {}; // {productId_spec: {quantity: 已退款数量, amount: 已退款金额}}
        let totalRefundedAmount = 0;
        
        if (refundRes.result && refundRes.result.code === 200) {
          const refundList = refundRes.result.data?.list || [];
          // 筛选出该订单的已完成的退款
          const orderRefunds = refundList.filter(r => 
            r.orderId === orderId && 
            (r.status === 'approved' || r.status === 'completed')
          );

          orderRefunds.forEach(refund => {
            if (refund.refundAmount) {
              totalRefundedAmount += parseFloat(refund.refundAmount);
            }
            
            // 记录已退款的商品
            if (refund.selectedItems && Array.isArray(refund.selectedItems)) {
              refund.selectedItems.forEach(item => {
                const key = `${item.productId || item.id}_${item.spec || ''}`;
                if (!refundedItemsMap[key]) {
                  refundedItemsMap[key] = {
                    productId: item.productId || item.id,
                    spec: item.spec || '',
                    quantity: 0,
                    amount: 0
                  };
                }
                refundedItemsMap[key].quantity += (item.quantity || 1);
                refundedItemsMap[key].amount += (parseFloat(item.price || 0) * (item.quantity || 1));
              });
            }
          });
        }

        // 处理订单商品列表
        let refundItems = [];
        if (order.items && Array.isArray(order.items)) {
          refundItems = order.items.map((item, index) => {
            let price = item.price || 0;
            if (typeof price === 'number') {
              price = price >= 100 ? (price / 100) : price;
            } else if (typeof price === 'string') {
              const numPrice = parseFloat(price);
              price = numPrice >= 100 ? (numPrice / 100) : numPrice;
            }
            
            const key = `${item.productId || `item_${index}`}_${item.spec || ''}`;
            const refundedInfo = refundedItemsMap[key];
            const orderQuantity = item.quantity || 1;
            const refundedQuantity = refundedInfo ? refundedInfo.quantity : 0;
            const availableQuantity = orderQuantity - refundedQuantity;
            
            return {
              id: `${item.productId || `item_${index}`}_${item.spec || ''}_${index}`, // 使用 productId_spec_index 组合确保唯一性
              productId: item.productId,
              productName: item.productName || '商品',
              spec: item.spec || '',
              quantity: orderQuantity, // 订单数量
              availableQuantity: availableQuantity, // 可退款数量
              refundedQuantity: refundedQuantity, // 已退款数量
              refundQuantity: availableQuantity, // 用户选择的退款数量（默认等于可退款数量）
              price: price,
              priceText: price.toFixed(2), // 格式化后的价格文本
              subtotal: (price * availableQuantity).toFixed(2), // 小计金额（格式化后）
              image: item.image || '/pages/小标/商家.png',
              selected: false,
              isFullyRefunded: availableQuantity <= 0 // 是否已全部退款
            };
          });
        }

        // 过滤掉已全部退款的商品，只显示可退款的商品
        refundItems = refundItems.filter(item => item.availableQuantity > 0);

        // 如果有可退款商品，默认全选
        if (refundItems.length > 0) {
          refundItems.forEach(item => {
            item.selected = true;
            item.refundQuantity = item.availableQuantity; // 默认退款全部可退款数量
            item.subtotal = (item.price * item.availableQuantity).toFixed(2); // 更新小计金额
          });
        }

        // 计算退款金额（使用用户选择的退款数量）
        const refundAmount = refundItems
          .filter(item => item.selected)
          .reduce((sum, item) => {
            return sum + (item.price * item.refundQuantity);
          }, 0);

        // 处理配送费（从分转换为元）
        let deliveryFee = order.amountDelivery || 0;
        if (typeof deliveryFee === 'number') {
          deliveryFee = deliveryFee >= 100 ? (deliveryFee / 100) : deliveryFee;
        } else if (typeof deliveryFee === 'string') {
          const numFee = parseFloat(deliveryFee);
          deliveryFee = numFee >= 100 ? (numFee / 100) : numFee;
        }

        // 其他费用（准时宝、配送费等，这些通常不退）
        const otherFees = [
          { name: '准时宝', amount: 0 },
          { name: '用户配送费', amount: deliveryFee.toFixed(2) }
        ];

        // 构建已退款商品列表（用于显示）
        const refundedItems = Object.values(refundedItemsMap).map(item => {
          // 从订单商品中查找商品名称
          const orderItem = order.items.find(oi => 
            (oi.productId || oi.id) === item.productId && 
            (oi.spec || '') === item.spec
          );
          return {
            productId: item.productId,
            productName: orderItem ? (orderItem.productName || '商品') : '商品',
            spec: item.spec,
            quantity: item.quantity,
            amount: item.amount.toFixed(2)
          };
        });

        this.setData({
          orderInfo: order,
          refundItems: refundItems,
          selectedItems: refundItems.map(item => item.id),
          selectAll: refundItems.length > 0,
          refundAmount: refundAmount.toFixed(2),
          otherFees: otherFees,
          refundedItems: refundedItems,
          totalRefundedAmount: totalRefundedAmount.toFixed(2)
        });

        console.log('【退款申请】订单加载成功:', order);
        console.log('【退款申请】已退款信息:', {
          refundedItems,
          totalRefundedAmount
        });
      } else {
        wx.showToast({
          title: orderRes.result?.message || '加载失败',
          icon: 'none'
        });
      }
    } catch (error) {
      wx.hideLoading();
      console.error('【退款申请】加载异常:', error);
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      });
    }
  },

  // 选择退款原因
  onSelectReason() {
    wx.showActionSheet({
      itemList: this.data.refundReasons,
      success: (res) => {
        const reason = this.data.refundReasons[res.tapIndex];
        this.setData({
          refundReason: reason
        });
      }
    });
  },

  // 输入退款原因描述
  onReasonTextInput(e) {
    this.setData({
      refundReasonText: e.detail.value
    });
  },

  // 选择图片
  onChooseImage() {
    const { images, maxImages } = this.data;
    const remaining = maxImages - images.length;

    if (remaining <= 0) {
      wx.showToast({
        title: `最多只能上传${maxImages}张图片`,
        icon: 'none'
      });
      return;
    }

    wx.chooseImage({
      count: remaining,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const tempFiles = res.tempFilePaths;
        this.uploadImages(tempFiles);
      },
      fail: (err) => {
        console.error('选择图片失败:', err);
        wx.showToast({
          title: '选择图片失败',
          icon: 'none'
        });
      }
    });
  },

  // 上传图片到云存储
  uploadImages(tempFiles) {
    wx.showLoading({ title: '上传中...' });

    const uploadPromises = tempFiles.map((filePath, index) => {
      return new Promise((resolve, reject) => {
        const timestamp = Date.now();
        const randomStr = Math.random().toString(36).substring(2, 8);
        const orderId = this.data.orderId || randomStr;
        const cloudPath = `refunds/${orderId}_${timestamp}_${index}.jpg`;
        
        wx.cloud.uploadFile({
          cloudPath: cloudPath,
          filePath: filePath,
          success: (res) => {
            resolve(res.fileID);
          },
          fail: (err) => {
            console.error('上传图片失败:', err);
            reject(err);
          }
        });
      });
    });

    Promise.all(uploadPromises)
      .then((fileIDs) => {
        wx.hideLoading();
        const images = [...this.data.images, ...fileIDs];
        this.setData({ images });
        wx.showToast({
          title: '上传成功',
          icon: 'success',
          duration: 1000
        });
      })
      .catch((err) => {
        wx.hideLoading();
        console.error('上传图片失败:', err);
        wx.showToast({
          title: '上传失败，请重试',
          icon: 'none'
        });
      });
  },

  // 预览图片
  onPreviewImage(e) {
    const index = e.currentTarget.dataset.index;
    wx.previewImage({
      current: this.data.images[index],
      urls: this.data.images
    });
  },

  // 删除图片
  onDeleteImage(e) {
    const index = e.currentTarget.dataset.index;
    const images = this.data.images.filter((_, i) => i !== index);
    this.setData({ images });
  },

  // 切换商品选择
  onToggleItem(e) {
    const itemId = e.currentTarget.dataset.id;
    const refundItems = this.data.refundItems.map(item => {
      if (item.id === itemId) {
        item.selected = !item.selected;
        // 如果取消选择，重置退款数量为可退款数量
        if (!item.selected) {
          item.refundQuantity = item.availableQuantity;
          item.subtotal = (item.price * item.availableQuantity).toFixed(2);
        } else {
          // 如果选择，更新小计金额
          item.subtotal = (item.price * item.refundQuantity).toFixed(2);
        }
      }
      return item;
    });

    const selectedItems = refundItems.filter(item => item.selected).map(item => item.id);
    const selectAll = selectedItems.length === refundItems.length;

    // 重新计算退款金额（使用用户选择的退款数量）
    const refundAmount = refundItems
      .filter(item => item.selected)
      .reduce((sum, item) => {
        return sum + (item.price * item.refundQuantity);
      }, 0);

    this.setData({
      refundItems: refundItems,
      selectedItems: selectedItems,
      selectAll: selectAll,
      refundAmount: refundAmount.toFixed(2)
    });
  },

  // 调整退款数量
  onAdjustQuantity(e) {
    const itemId = e.currentTarget.dataset.id;
    const type = e.currentTarget.dataset.type; // 'increase' 或 'decrease'
    
    const refundItems = this.data.refundItems.map(item => {
      if (item.id === itemId && item.selected) {
        if (type === 'increase') {
          // 增加数量，但不能超过可退款数量
          if (item.refundQuantity < item.availableQuantity) {
            item.refundQuantity += 1;
          }
        } else if (type === 'decrease') {
          // 减少数量，但不能小于1
          if (item.refundQuantity > 1) {
            item.refundQuantity -= 1;
          }
        }
        // 更新小计金额
        item.subtotal = (item.price * item.refundQuantity).toFixed(2);
      }
      return item;
    });

    // 重新计算退款金额
    const refundAmount = refundItems
      .filter(item => item.selected)
      .reduce((sum, item) => {
        return sum + (item.price * item.refundQuantity);
      }, 0);

    this.setData({
      refundItems: refundItems,
      refundAmount: refundAmount.toFixed(2)
    });
  },

  // 输入退款数量
  onQuantityInput(e) {
    const itemId = e.currentTarget.dataset.id;
    const value = parseInt(e.detail.value) || 1;
    
    const refundItems = this.data.refundItems.map(item => {
      if (item.id === itemId && item.selected) {
        // 限制数量范围：1 到 availableQuantity
        if (value >= 1 && value <= item.availableQuantity) {
          item.refundQuantity = value;
        } else if (value < 1) {
          item.refundQuantity = 1;
        } else if (value > item.availableQuantity) {
          item.refundQuantity = item.availableQuantity;
        }
        // 更新小计金额
        item.subtotal = (item.price * item.refundQuantity).toFixed(2);
      }
      return item;
    });

    // 重新计算退款金额
    const refundAmount = refundItems
      .filter(item => item.selected)
      .reduce((sum, item) => {
        return sum + (item.price * item.refundQuantity);
      }, 0);

    this.setData({
      refundItems: refundItems,
      refundAmount: refundAmount.toFixed(2)
    });
  },

  // 全选/取消全选
  onToggleSelectAll() {
    const selectAll = !this.data.selectAll;
    const refundItems = this.data.refundItems.map(item => {
      item.selected = selectAll;
      // 如果全选，重置退款数量为可退款数量
      if (selectAll) {
        item.refundQuantity = item.availableQuantity;
        item.subtotal = (item.price * item.availableQuantity).toFixed(2);
      }
      return item;
    });

    const selectedItems = selectAll ? refundItems.map(item => item.id) : [];
    
    // 重新计算退款金额（使用用户选择的退款数量）
    const refundAmount = selectAll
      ? refundItems.reduce((sum, item) => {
          return sum + (item.price * item.refundQuantity);
        }, 0)
      : 0;

    this.setData({
      refundItems: refundItems,
      selectedItems: selectedItems,
      selectAll: selectAll,
      refundAmount: refundAmount.toFixed(2)
    });
  },

  // 提交退款申请
  async onSubmitRefund() {
    // 验证必填项
    if (!this.data.refundReason) {
      wx.showToast({
        title: '请选择退款原因',
        icon: 'none'
      });
      return;
    }

    if (this.data.selectedItems.length === 0) {
      wx.showToast({
        title: '请至少选择一件商品',
        icon: 'none'
      });
      return;
    }

    // 验证退款数量是否超过可退款数量
    const invalidItems = this.data.refundItems.filter(item => 
      item.selected && (item.refundQuantity > item.availableQuantity || item.refundQuantity < 1)
    );
    
    if (invalidItems.length > 0) {
      wx.showToast({
        title: '退款数量超出可退款范围',
        icon: 'none'
      });
      return;
    }

    if (parseFloat(this.data.refundAmount) <= 0) {
      wx.showToast({
        title: '退款金额必须大于0',
        icon: 'none'
      });
      return;
    }

    if (this.data.isSubmitting) {
      return;
    }

    this.setData({ isSubmitting: true });

    wx.showLoading({ title: '提交中...' });

    try {
      // 获取选中的商品信息（使用用户选择的退款数量）
      const selectedItemsData = this.data.refundItems
        .filter(item => item.selected && item.refundQuantity > 0)
        .map(item => ({
          id: item.id,
          productId: item.productId,
          productName: item.productName,
          spec: item.spec,
          quantity: item.refundQuantity, // 使用用户选择的退款数量
          price: item.price,
          image: item.image
        }));

      const res = await wx.cloud.callFunction({
        name: 'refundManage',
        data: {
          action: 'createRefund',
          data: {
            orderId: this.data.orderId,
            refundReason: this.data.refundReason,
            refundReasonText: this.data.refundReasonText,
            images: this.data.images,
            refundSource: this.data.refundSource,
            selectedItems: selectedItemsData,
            refundAmount: parseFloat(this.data.refundAmount)
          }
        }
      });

      wx.hideLoading();
      this.setData({ isSubmitting: false });

      console.log('【退款申请】提交结果:', res.result);

      if (res.result && res.result.code === 200) {
        wx.showToast({
          title: '退款申请已提交',
          icon: 'success',
          duration: 2000
        });

        setTimeout(() => {
          wx.navigateBack();
        }, 2000);
      } else {
        wx.showToast({
          title: res.result?.message || '提交失败',
          icon: 'none',
          duration: 2000
        });
      }
    } catch (error) {
      wx.hideLoading();
      this.setData({ isSubmitting: false });
      console.error('【退款申请】提交异常:', error);
      wx.showToast({
        title: '提交失败，请重试',
        icon: 'none',
        duration: 2000
      });
    }
  },

  // 返回
  onBack() {
    wx.navigateBack();
  }
});

