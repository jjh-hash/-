Page({
  data:{
    statusBarHeight: wx.getWindowInfo().statusBarHeight || 20,
    activeTab: 0,
    activeCat: 0,
    categories: [
      { name:'招牌菜' },{ name:'热门美食' },{ name:'把把串串' },{ name:'招牌烤肠' },{ name:'主食小吃' }
    ],
    goods: [
      { id:1, name:'难得一见披萨', price: 76.00, img:'https://picsum.photos/seed/p1/100/100', swipeOffset: 0 },
      { id:2, name:'两见偶心蛋烧酥', price: 9.50, img:'https://picsum.photos/seed/p2/100/100', swipeOffset: 0 },
      { id:3, name:'泪眼婆婆思念餐', price: 5.00, img:'https://picsum.photos/seed/p3/100/100', swipeOffset: 0 },
      { id:4, name:'想不起來忘卤肉', price: 5.00, img:'https://picsum.photos/seed/p4/100/100', swipeOffset: 0 }
    ],
    startX: 0,
    currentSwipeId: null
  },
  onBack(){ wx.navigateBack(); },
  onTab(e){ this.setData({ activeTab: Number(e.currentTarget.dataset.index) }); },
  onCat(e){ this.setData({ activeCat: Number(e.currentTarget.dataset.index) }); },
  onAdd(){ 
    wx.navigateTo({ 
      url: '/pages/merchant-add-product/index' 
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
      const currentItem = this.data.goods.find(item => item.id === id);
      const currentOffset = currentItem ? currentItem.swipeOffset : 0;
      swipeOffset = Math.min(currentOffset + deltaX, 0);
    }
    
    const goods = this.data.goods.map(item => {
      if (item.id === id) {
        return { ...item, swipeOffset: swipeOffset };
      }
      return { ...item, swipeOffset: 0 }; // 其他项复位
    });
    
    this.setData({ goods });
  },
  
  onTouchEnd(e) {
    const id = e.currentTarget.dataset.id;
    const currentX = e.changedTouches[0].clientX;
    const deltaX = currentX - this.data.startX;
    
    const goods = this.data.goods.map(item => {
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
    
    this.setData({ goods, currentSwipeId: null });
  },
  
  onEdit(e) {
    const id = e.currentTarget.dataset.id;
    wx.showToast({ title:`编辑商品${id}（示例）`, icon:'none' });
  },
  
  onDelete(e) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '确认删除',
      content: '确定要删除这个商品吗？',
      success: (res) => {
        if (res.confirm) {
          wx.showToast({ title:`删除商品${id}（示例）`, icon:'none' });
        }
      }
    });
  },
  
  // 点击商品区域，自动复原所有展开的项
  onGoodsAreaTap(e) {
    // 如果点击的不是商品项，则复原所有展开的项
    if (!e.target.dataset.id) {
      const goods = this.data.goods.map(item => ({
        ...item,
        swipeOffset: 0
      }));
      this.setData({ goods });
    }
  }
});


