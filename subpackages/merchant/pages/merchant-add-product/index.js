Page({
  data: {
    statusBarHeight: wx.getWindowInfo().statusBarHeight || 20,
    isEditMode: false,
    productStatus: 'on', // 商品状态：on/off
    formData: {
      name: '',
      categoryId: '',
      categoryName: '',
      prepTime: '',
      price: '',
      specifications: [], // 规格配置数组
      image: '',
      imageUrl: ''
    },
    categories: [],
    categoryNames: [],
    specs: ['小份', '中份', '大份', '特大份'],
    attrs: ['不辣', '微辣', '中辣', '重辣', '特辣'],
    productId: null,
    showCategoryModal: false // 分类选择弹窗显示状态
  },

  onLoad(options) {
    // 加载分类列表
    this.loadCategories();
    
    // 如果是编辑模式，加载商品信息
    if (options.id) {
      this.setData({ 
        productId: options.id,
        isEditMode: true
      });
      this.loadProduct(options.id);
    }
  },

  // 加载分类列表（与商品管理页一致：传入 merchantId/storeId，避免云函数用 openid 查不到导致 0 分类）
  loadCategories() {
    const merchantInfo = wx.getStorageSync('merchantInfo') || {};
    const merchantId = merchantInfo._id || null;
    const storeId = merchantInfo.storeId || null;

    wx.cloud.callFunction({
      name: 'categoryManage',
      data: {
        action: 'getCategories',
        data: {
          merchantId: merchantId,
          storeId: storeId
        }
      }
    }).then(res => {
      console.log('【添加商品】分类加载结果:', res.result);
      
      if (res.result.code === 200) {
        const categories = res.result.data.categories || [];
        const categoryNames = categories.map(cat => cat.name);
        
        this.setData({
          categories: categories,
          categoryNames: categoryNames
        });
        
        console.log('【添加商品】分类加载成功，共', categories.length, '个分类');
      }
    }).catch(err => {
      console.error('【添加商品】分类加载失败:', err);
    });
  },

  // 加载商品信息（编辑模式）
  loadProduct(productId) {
    wx.showLoading({ title: '加载中...' });
    
    // 获取当前登录的商家信息
    const merchantInfo = wx.getStorageSync('merchantInfo') || {};
    const merchantId = merchantInfo._id;
    const storeId = merchantInfo.storeId;
    
    wx.cloud.callFunction({
      name: 'productManage',
      data: {
        action: 'getProductDetail',
        data: {
          productId: productId,
          merchantId: merchantId,
          storeId: storeId
        }
      }
    }).then(res => {
      wx.hideLoading();
      
      console.log('【编辑商品】加载结果:', res.result);
      
      if (res.result.code === 200) {
        const product = res.result.data.product;
        
        // 填充表单数据
        // 处理规格数据：如果存在specifications则使用，否则尝试从旧的spec/attr字段转换
        let specifications = [];
        if (product.specifications && Array.isArray(product.specifications) && product.specifications.length > 0) {
          // 云函数已经将价格转换为元，直接使用，并确保有 type 字段
          specifications = product.specifications.map(group => ({
            name: group.name || '',
            type: group.type || 'single', // 默认为单选
            options: (group.options || []).map(option => ({
              name: option.name || '',
              price: typeof option.price === 'number' ? option.price : parseFloat(option.price) || 0
            }))
          }));
        }
        
        this.setData({
          'formData.name': product.name,
          'formData.categoryId': product.categoryId,
          'formData.categoryName': product.categoryName,
          'formData.price': product.price,
          'formData.imageUrl': product.coverUrl,
          'formData.image': product.coverUrl || '',
          'formData.prepTime': product.prepTime || '',
          'formData.specifications': specifications,
          productStatus: product.status || 'on' // 记录商品状态
        });
        
        console.log('【编辑商品】表单已填充:', this.data.formData);
      } else {
        wx.showToast({
          title: res.result.message || '加载失败',
          icon: 'none'
        });
      }
    }).catch(err => {
      wx.hideLoading();
      console.error('【编辑商品】加载失败:', err);
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      });
    });
  },

  onBack() {
    wx.navigateBack();
  },

  onInput(e) {
    const field = e.currentTarget.dataset.field;
    const value = e.detail.value;
    this.setData({
      [`formData.${field}`]: value
    });
  },

  onSelectCategory() {
    if (this.data.categories.length === 0) {
      wx.showToast({ title: '暂无分类，请先添加分类', icon: 'none' });
      return;
    }
    
    // 显示自定义分类选择弹窗
    this.setData({
      showCategoryModal: true
    });
  },

  // 关闭分类选择弹窗
  onCloseCategoryModal() {
    this.setData({
      showCategoryModal: false
    });
  },

  // 选择分类项
  onCategoryItemTap(e) {
    const index = e.currentTarget.dataset.index;
    const selectedCategory = this.data.categories[index];
    
    if (selectedCategory) {
      this.setData({
        'formData.categoryId': selectedCategory.id,
        'formData.categoryName': selectedCategory.name,
        showCategoryModal: false
      });
      console.log('【添加商品】选择的分类:', selectedCategory);
    }
  },

  // 添加规格组
  addSpecGroup() {
    const specifications = JSON.parse(JSON.stringify(this.data.formData.specifications || []));
    specifications.push({
      name: '',
      type: 'single', // 默认单选
      options: [
        { name: '', price: 0 }
      ]
    });
    this.setData({
      'formData.specifications': specifications
    });
  },

  // 更新规格组类型
  updateSpecGroupType(e) {
    const index = parseInt(e.currentTarget.dataset.index);
    const type = e.currentTarget.dataset.type;
    const specifications = JSON.parse(JSON.stringify(this.data.formData.specifications || []));
    
    if (!specifications[index]) {
      console.error('规格组不存在:', index);
      return;
    }
    
    specifications[index].type = type;
    
    this.setData({
      'formData.specifications': specifications
    });
  },

  // 删除规格组
  removeSpecGroup(e) {
    const index = e.currentTarget.dataset.index;
    wx.showModal({
      title: '确认删除',
      content: '确定要删除这个规格组吗？',
      success: (res) => {
        if (res.confirm) {
          const specifications = JSON.parse(JSON.stringify(this.data.formData.specifications || []));
          specifications.splice(index, 1);
          this.setData({
            'formData.specifications': specifications
          });
        }
      }
    });
  },

  // 添加规格项
  addSpecOption(e) {
    const groupIndex = e.currentTarget.dataset.index;
    const specifications = JSON.parse(JSON.stringify(this.data.formData.specifications || []));
    
    if (!specifications[groupIndex]) {
      console.error('规格组不存在:', groupIndex);
      return;
    }
    
    if (!specifications[groupIndex].options) {
      specifications[groupIndex].options = [];
    }
    
    specifications[groupIndex].options.push({
      name: '',
      price: 0
    });
    
    this.setData({
      'formData.specifications': specifications
    });
  },

  // 删除规格项
  removeSpecOption(e) {
    const { groupIndex, optionIndex } = e.currentTarget.dataset;
    const specifications = JSON.parse(JSON.stringify(this.data.formData.specifications || []));
    
    // 防御性检查 - 确保索引是有效的数字
    let groupIndexNum = parseInt(groupIndex);
    let optionIndexNum = parseInt(optionIndex);
    
    // 检查解析结果
    if (isNaN(groupIndexNum)) {
      console.error('删除规格项 - 规格组索引无效（NaN）:', groupIndex);
      return;
    }
    
    if (isNaN(optionIndexNum)) {
      console.error('删除规格项 - 规格项索引无效（NaN）:', optionIndex);
      return;
    }
    
    if (!specifications[groupIndexNum] || !specifications[groupIndexNum].options) {
      console.error('规格组或选项数组不存在');
      return;
    }
    
    const options = specifications[groupIndexNum].options;
    
    // 至少保留一个规格项
    if (options.length <= 1) {
      wx.showToast({
        title: '至少保留一个规格项',
        icon: 'none'
      });
      return;
    }
    
    // 检查索引是否有效
    if (optionIndexNum < 0 || optionIndexNum >= options.length) {
      console.error('删除规格项 - 规格项索引超出范围:', optionIndexNum, '选项数量:', options.length);
      return;
    }
    
    options.splice(optionIndexNum, 1);
    this.setData({
      'formData.specifications': specifications
    });
  },

  // 更新规格组名称
  updateSpecGroupName(e) {
    const index = e.currentTarget.dataset.index;
    const value = e.detail.value;
    
    // 创建深拷贝以避免数据绑定问题
    const specifications = JSON.parse(JSON.stringify(this.data.formData.specifications || []));
    
    // 防御性检查
    if (!specifications[index]) {
      console.error('规格组索引不存在:', index);
      return;
    }
    
    specifications[index].name = value;
    this.setData({
      'formData.specifications': specifications
    });
  },

  // 更新规格项信息
  updateSpecOption(e) {
    const { groupIndex, optionIndex, field } = e.currentTarget.dataset;
    const value = e.detail.value;
    
    // 创建深拷贝以避免数据绑定问题
    const specifications = JSON.parse(JSON.stringify(this.data.formData.specifications || []));
    
    // 防御性检查 - 确保索引是有效的数字
    let groupIndexNum = parseInt(groupIndex);
    let optionIndexNum = parseInt(optionIndex);
    
    // 检查解析结果
    if (isNaN(groupIndexNum)) {
      console.error('规格组索引无效（NaN）:', groupIndex, '原始值:', e.currentTarget.dataset);
      return;
    }
    
    if (isNaN(optionIndexNum)) {
      console.error('规格项索引无效（NaN）:', optionIndex, '原始值:', e.currentTarget.dataset);
      return;
    }
    
    if (groupIndexNum < 0 || !specifications[groupIndexNum]) {
      console.error('规格组索引不存在:', groupIndexNum, '规格组数量:', specifications.length);
      return;
    }
    
    const group = specifications[groupIndexNum];
    if (!group.options || !Array.isArray(group.options)) {
      console.error('规格组选项数组不存在:', groupIndexNum);
      return;
    }
    
    if (optionIndexNum < 0 || optionIndexNum >= group.options.length || !group.options[optionIndexNum]) {
      console.error('规格项索引无效:', optionIndexNum, '选项数量:', group.options.length);
      return;
    }
    
    const option = group.options[optionIndexNum];
    
    // 确保option对象存在
    if (!option) {
      console.error('规格项不存在:', { groupIndexNum, optionIndexNum });
      return;
    }
    
    // 更新字段
    if (field === 'price') {
      option.price = parseFloat(value) || 0;
    } else if (field === 'name') {
      option.name = value;
    } else {
      console.error('无效的字段名:', field);
      return;
    }
    
    this.setData({
      'formData.specifications': specifications
    });
  },

  onUploadImage() {
    wx.chooseImage({
      count: 1,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: async (res) => {
        const tempFilePath = res.tempFilePaths[0];
        
        // 显示临时图片
        this.setData({
          'formData.image': tempFilePath
        });
        
        // 上传到云存储
        wx.showLoading({ title: '上传中...' });
        
        try {
          const timestamp = Date.now();
          const randomStr = Math.random().toString(36).substr(2, 9);
          const cloudPath = `product-images/${timestamp}-${randomStr}.jpg`;
          
          const uploadRes = await wx.cloud.uploadFile({
            cloudPath: cloudPath,
            filePath: tempFilePath
          });
          
          wx.hideLoading();
          
          console.log('【添加商品】图片上传成功:', uploadRes.fileID);
          
          this.setData({
            'formData.imageUrl': uploadRes.fileID
          });
          
          wx.showToast({
            title: '图片上传成功',
            icon: 'success',
            duration: 1000
          });
        } catch (err) {
          wx.hideLoading();
          console.error('【添加商品】图片上传失败:', err);
          wx.showToast({
            title: '图片上传失败',
            icon: 'none'
          });
        }
      }
    });
  },

  async onSave() {
    const { formData, productId } = this.data;
    
    console.log('【添加商品】准备保存，表单数据:', formData);
    
    // 验证必填项
    if (!formData.name || !formData.name.trim()) {
      wx.showToast({ title: '请输入商品名称', icon: 'none' });
      return;
    }
    
    if (!formData.categoryId) {
      wx.showToast({ title: '请选择商品分类', icon: 'none' });
      return;
    }
    
    if (!formData.price || isNaN(formData.price) || parseFloat(formData.price) <= 0) {
      wx.showToast({ title: '请输入有效价格', icon: 'none' });
      return;
    }

    wx.showLoading({ title: '保存中...' });
    
    try {
      // 如果是编辑模式
      if (productId) {
        await this.updateProduct(productId, formData);
      } else {
        // 新增模式
        await this.addProduct(formData);
      }
    } catch (err) {
      wx.hideLoading();
      console.error('【添加商品】保存失败:', err);
      wx.showToast({
        title: '保存失败，请重试',
        icon: 'none'
      });
    }
  },
  
  // 添加商品
  async addProduct(formData) {
    // 先上传图片（如果还没有上传）
    let coverUrl = formData.imageUrl;
    
    if (formData.image && !formData.imageUrl) {
      // 如果选了图片但还没上传
      wx.showToast({ title: '请等待图片上传完成', icon: 'none' });
      wx.hideLoading();
      return;
    }
    
    // 处理规格数据：验证并转换价格单位为分
    let specifications = [];
    if (formData.specifications && Array.isArray(formData.specifications) && formData.specifications.length > 0) {
      specifications = formData.specifications
        .filter(group => group.name && group.name.trim() && group.options && group.options.length > 0)
        .map(group => ({
          name: group.name.trim(),
          type: group.type || 'single', // 保存规格组类型
          options: group.options
            .filter(option => option.name && option.name.trim())
            .map(option => ({
              name: option.name.trim(),
              price: Math.round((parseFloat(option.price) || 0) * 100) // 转换为分
            }))
        }));
    }
    
    const merchantInfo = wx.getStorageSync('merchantInfo') || {};
    const merchantId = merchantInfo._id || null;

    const res = await wx.cloud.callFunction({
      name: 'productManage',
      data: {
        action: 'addProduct',
        data: {
          merchantId: merchantId,
          name: formData.name.trim(),
          categoryId: formData.categoryId,
          price: parseFloat(formData.price),
          description: formData.prepTime || '',
          coverUrl: coverUrl || '',
          stock: 0,
          specifications: specifications,
          prepTime: formData.prepTime || ''
        }
      }
    });
    
    wx.hideLoading();
    
    console.log('【添加商品】保存结果:', res.result);

    if (res.result.code === 200) {
      wx.showToast({ 
        title: '保存成功', 
        icon: 'success',
        duration: 1500
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
  },
  
  // 更新商品
  async updateProduct(productId, formData) {
    // 先上传图片（如果还没有上传）
    let coverUrl = formData.imageUrl;
    
    if (formData.image && !formData.imageUrl) {
      // 如果选了图片但还没上传
      wx.showToast({ title: '请等待图片上传完成', icon: 'none' });
      wx.hideLoading();
      return;
    }
    
    // 处理规格数据：验证并转换价格单位为分
    let specifications = [];
    if (formData.specifications && Array.isArray(formData.specifications) && formData.specifications.length > 0) {
      specifications = formData.specifications
        .filter(group => group.name && group.name.trim() && group.options && group.options.length > 0)
        .map(group => ({
          name: group.name.trim(),
          type: group.type || 'single', // 保存规格组类型
          options: group.options
            .filter(option => option.name && option.name.trim())
            .map(option => ({
              name: option.name.trim(),
              price: Math.round((parseFloat(option.price) || 0) * 100) // 转换为分
            }))
        }));
    }
    
    // 获取当前登录的商家信息
    const merchantInfo = wx.getStorageSync('merchantInfo') || {};
    const merchantId = merchantInfo._id;
    const storeId = merchantInfo.storeId;
    
    const res = await wx.cloud.callFunction({
      name: 'productManage',
      data: {
        action: 'updateProduct',
        data: {
          productId: productId,
          name: formData.name.trim(),
          categoryId: formData.categoryId,
          price: parseFloat(formData.price),
          description: formData.prepTime || '',
          coverUrl: coverUrl || '',
          stock: 0,
          specifications: specifications,
          prepTime: formData.prepTime || '',
          merchantId: merchantId,
          storeId: storeId
        }
      }
    });
    
    wx.hideLoading();
    
    console.log('【编辑商品】更新结果:', res.result);
    
    if (res.result.code === 200) {
      wx.showToast({ 
        title: '更新成功', 
        icon: 'success',
        duration: 1500
      });
      
      setTimeout(() => {
        wx.navigateBack();
      }, 1500);
    } else {
      wx.showToast({
        title: res.result.message || '更新失败',
        icon: 'none'
      });
    }
  },
  
  // 下架商品
  async onOffline() {
    const { productId } = this.data;
    
    if (!productId) {
      wx.showToast({ title: '商品ID不存在', icon: 'none' });
      return;
    }
    
    // 确认下架
    wx.showModal({
      title: '确认下架',
      content: '确定要下架该商品吗？下架后商品将不会在客户端显示。',
      confirmColor: '#ff4d4f',
      success: async (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '下架中...' });
          
          // 获取当前登录的商家信息
          const merchantInfo = wx.getStorageSync('merchantInfo') || {};
          const merchantId = merchantInfo._id;
          const storeId = merchantInfo.storeId;
          
          try {
            const result = await wx.cloud.callFunction({
              name: 'productManage',
              data: {
                action: 'setProductStatus',
                data: {
                  productId: productId,
                  status: 'off',
                  merchantId: merchantId,
                  storeId: storeId
                }
              }
            });
            
            wx.hideLoading();
            
            console.log('【下架商品】结果:', result.result);
            
            if (result.result.code === 200) {
              wx.showToast({
                title: '下架成功',
                icon: 'success',
                duration: 1500
              });
              
              setTimeout(() => {
                wx.navigateBack();
              }, 1500);
            } else {
              wx.showToast({
                title: result.result.message || '下架失败',
                icon: 'none'
              });
            }
          } catch (err) {
            wx.hideLoading();
            console.error('【下架商品】失败:', err);
            wx.showToast({
              title: '下架失败',
              icon: 'none'
            });
          }
        }
      }
    });
  },
  
  // 上架商品
  async onOnline() {
    const { productId } = this.data;
    
    if (!productId) {
      wx.showToast({ title: '商品ID不存在', icon: 'none' });
      return;
    }
    
    // 确认上架
    wx.showModal({
      title: '确认上架',
      content: '确定要上架该商品吗？上架后商品将在客户端显示。',
      confirmColor: '#1677ff',
      success: async (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '上架中...' });
          
          // 获取当前登录的商家信息
          const merchantInfo = wx.getStorageSync('merchantInfo') || {};
          const merchantId = merchantInfo._id;
          const storeId = merchantInfo.storeId;
          
          try {
            const result = await wx.cloud.callFunction({
              name: 'productManage',
              data: {
                action: 'setProductStatus',
                data: {
                  productId: productId,
                  status: 'on',
                  merchantId: merchantId,
                  storeId: storeId
                }
              }
            });
            
            wx.hideLoading();
            
            console.log('【上架商品】结果:', result.result);
            
            if (result.result.code === 200) {
              wx.showToast({
                title: '上架成功',
                icon: 'success',
                duration: 1500
              });
              
              setTimeout(() => {
                wx.navigateBack();
              }, 1500);
            } else {
              wx.showToast({
                title: result.result.message || '上架失败',
                icon: 'none'
              });
            }
          } catch (err) {
            wx.hideLoading();
            console.error('【上架商品】失败:', err);
            wx.showToast({
              title: '上架失败',
              icon: 'none'
            });
          }
        }
      }
    });
  }
});
