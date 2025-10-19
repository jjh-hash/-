Page({
  data:{
    statusBarHeight: wx.getWindowInfo().statusBarHeight || 20,
    activeTab: 0,
    bottomActive: 'orders',
    orders: [
      {
        id: 1, deskNo: 8, statusText: '待确认', remark: '不要很难吃噢，老板你看着办吧！',
        items: [
          { name: '麻辣土豆肉丝春卷', price: 6.00, qty: 1, img: 'https://picsum.photos/seed/a/80/80' },
          { name: '慕斯里草莓相思夹心蛋糕（三层）', price: 21.00, qty: 1, img: 'https://picsum.photos/seed/b/80/80' }
        ]
      },
      {
        id: 2, deskNo: 8, statusText: '商家忙碌中', remark: '老板，麻烦多给我来点辣椒，辣死我那种',
        items: [
          { name: '巨无霸紫菜培根肉丝夹心汉堡', price: 18.00, qty: 3, img: 'https://picsum.photos/seed/c/80/80' },
          { name: '意大利香辣一叉子就卷没面', price: 21.00, qty: 1, img: 'https://picsum.photos/seed/d/80/80' }
        ]
      }
    ]
  },

  onTabTap(e){
    this.setData({ activeTab: Number(e.currentTarget.dataset.index) });
  },
  onContactUser(){ wx.showToast({ title:'联系用户', icon:'none' }); },
  onConfirmOrder(){ wx.showToast({ title:'已确认', icon:'success' }); },
  onOpenDetail(e){
    const id = e.currentTarget.dataset.id;
    const order = this.data.orders.find(o=>o.id===id);
    this.setData({ showDetail: true, detail: order });
  },
  onCloseDetail(){ this.setData({ showDetail: false }); },
  onCancelOrder(){ wx.showToast({ title:'已取消', icon:'none' }); this.setData({ showDetail:false }); },
  onBottomTap(e){
    const tab = e.currentTarget.dataset.tab;
    this.setData({ bottomActive: tab });
    if(tab==='workbench'){
      wx.reLaunch({ url: '/pages/merchant-workbench/index' });
    } else if(tab==='mine'){
      wx.reLaunch({ url: '/pages/merchant-mine/index' });
    }
  }
});


