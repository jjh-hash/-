Page({
  data:{
    statusBarHeight: wx.getWindowInfo().statusBarHeight || 20,
    cats: [
      { id:1, name:'招牌菜', swipeOffset: 0 },
      { id:2, name:'木炭烧烤', swipeOffset: 0 },
      { id:3, name:'把把串串', swipeOffset: 0 },
      { id:4, name:'牌龙虾', swipeOffset: 0 },
      { id:5, name:'主食小吃', swipeOffset: 0 }
    ],
    startX: 0,
    currentSwipeId: null
  },
  
  onBack(){ wx.navigateBack(); },
  
  onAdd(){ 
    wx.showModal({
      title: '添加分类',
      editable: true,
      placeholderText: '请输入分类名称',
      success: (res) => {
        if (res.confirm && res.content.trim()) {
          // TODO: 调用云函数添加分类
          // wx.cloud.callFunction({
          //   name: 'merchant/addCategory',
          //   data: {
          //     storeId: 'your_store_id',
          //     name: res.content.trim()
          //   }
          // }).then(res => {
          //   if (res.result.code === 0) {
          //     const newCategory = {
          //       id: res.result.data.categoryId,
          //       name: res.content.trim(),
          //       swipeOffset: 0
          //     };
          //     this.setData({
          //       cats: [...this.data.cats, newCategory]
          //     });
          //     wx.showToast({ title: '添加成功', icon: 'success' });
          //   }
          // }).catch(err => {
          //   console.error('添加分类失败:', err);
          //   wx.showToast({ title: '添加失败', icon: 'error' });
          // });
          
          // 模拟添加成功
          const newId = Math.max(...this.data.cats.map(item => item.id)) + 1;
          const newCategory = {
            id: newId,
            name: res.content.trim(),
            swipeOffset: 0
          };
          this.setData({
            cats: [...this.data.cats, newCategory]
          });
          wx.showToast({ title: '添加成功', icon: 'success' });
        }
      }
    });
  },
  
  // 滑动相关方法
  onTouchStart(e) {
    const id = e.currentTarget.dataset.id;
    this.setData({ 
      startX: e.touches[0].clientX,
      currentSwipeId: id
    });
  },
  
  onTouchMove(e) {
    const id = e.currentTarget.dataset.id;
    const currentX = e.touches[0].clientX;
    const deltaX = currentX - this.data.startX;
    
    // 允许向左滑动（显示操作按钮）和向右滑动（复原）
    const maxSwipe = 120; // 最大滑动距离
    let swipeOffset = 0;
    
    if (deltaX < 0) {
      // 向左滑动，显示操作按钮
      swipeOffset = Math.max(deltaX, -maxSwipe);
    } else if (deltaX > 0) {
      // 向右滑动，从当前状态开始复原
      const currentItem = this.data.cats.find(item => item.id === id);
      const currentOffset = currentItem ? currentItem.swipeOffset : 0;
      swipeOffset = Math.min(currentOffset + deltaX, 0);
    }
    
    const cats = this.data.cats.map(item => {
      if (item.id === id) {
        return { ...item, swipeOffset: swipeOffset };
      }
      return { ...item, swipeOffset: 0 }; // 其他项复位
    });
    
    this.setData({ cats });
  },
  
  onTouchEnd(e) {
    const id = e.currentTarget.dataset.id;
    const currentX = e.changedTouches[0].clientX;
    const deltaX = currentX - this.data.startX;
    
    const cats = this.data.cats.map(item => {
      if (item.id === id) {
        // 如果向左滑动距离超过60px，保持展开状态
        // 如果向右滑动距离超过30px，或者总滑动距离小于30px，则复位
        if (deltaX < -60) {
          return { ...item, swipeOffset: -120 };
        } else if (deltaX > 30 || Math.abs(deltaX) < 30) {
          return { ...item, swipeOffset: 0 };
        } else {
          // 保持当前状态
          return item;
        }
      }
      return item;
    });
    
    this.setData({ cats, currentSwipeId: null });
  },
  
  onEdit(e) {
    const id = e.currentTarget.dataset.id;
    const category = this.data.cats.find(item => item.id === id);
    wx.showModal({
      title: '编辑分类',
      editable: true,
      placeholderText: '请输入分类名称',
      content: category.name,
      success: (res) => {
        if (res.confirm && res.content.trim()) {
          // TODO: 调用云函数更新分类名称
          // wx.cloud.callFunction({
          //   name: 'merchant/updateCategory',
          //   data: {
          //     storeId: 'your_store_id',
          //     categoryId: id,
          //     name: res.content.trim()
          //   }
          // }).then(res => {
          //   if (res.result.code === 0) {
          //     const cats = this.data.cats.map(item => {
          //       if (item.id === id) {
          //         return { ...item, name: res.content.trim(), swipeOffset: 0 };
          //       }
          //       return item;
          //     });
          //     this.setData({ cats });
          //     wx.showToast({ title: '编辑成功', icon: 'success' });
          //   }
          // }).catch(err => {
          //   console.error('编辑分类失败:', err);
          //   wx.showToast({ title: '编辑失败', icon: 'error' });
          // });
          
          // 模拟编辑成功
          const cats = this.data.cats.map(item => {
            if (item.id === id) {
              return { ...item, name: res.content.trim(), swipeOffset: 0 };
            }
            return item;
          });
          this.setData({ cats });
          wx.showToast({ title: '编辑成功', icon: 'success' });
        }
      }
    });
  },
  
  onDelete(e) {
    const id = e.currentTarget.dataset.id;
    const category = this.data.cats.find(item => item.id === id);
    wx.showModal({
      title: '确认删除',
      content: `确定要删除分类"${category.name}"吗？`,
      success: (res) => {
        if (res.confirm) {
          // TODO: 调用云函数删除分类
          // wx.cloud.callFunction({
          //   name: 'merchant/deleteCategory',
          //   data: {
          //     storeId: 'your_store_id',
          //     categoryId: id
          //   }
          // }).then(res => {
          //   if (res.result.code === 0) {
          //     const cats = this.data.cats.filter(item => item.id !== id);
          //     this.setData({ cats });
          //     wx.showToast({ title: '删除成功', icon: 'success' });
          //   }
          // }).catch(err => {
          //   console.error('删除分类失败:', err);
          //   wx.showToast({ title: '删除失败', icon: 'error' });
          // });
          
          // 模拟删除成功
          const cats = this.data.cats.filter(item => item.id !== id);
          this.setData({ cats });
          wx.showToast({ title: '删除成功', icon: 'success' });
        }
      }
    });
  },
  
  // 点击列表区域，自动复原所有展开的项
  onListAreaTap(e) {
    // 如果点击的不是分类项，则复原所有展开的项
    if (!e.target.dataset.id) {
      const cats = this.data.cats.map(item => ({
        ...item,
        swipeOffset: 0
      }));
      this.setData({ cats });
    }
  }
});


