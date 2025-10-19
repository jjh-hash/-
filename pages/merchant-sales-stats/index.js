Page({
  data: {
    statusBarHeight: wx.getWindowInfo().statusBarHeight || 20,
    selectedYear: 2022,
    selectedPeriod: 'week',
    chartData: [
      { date: '09/10', orders: 45, revenue: 1200 },
      { date: '10/10', orders: 52, revenue: 1350 },
      { date: '11/10', orders: 38, revenue: 980 },
      { date: '12/10', orders: 61, revenue: 1580 },
      { date: '13/10', orders: 43, revenue: 1120 },
      { date: '14/10', orders: 48, revenue: 1250 }
    ],
    trendDates: ['09/10', '10/10', '11/10', '12/10', '13/10', '14/10', '15/10'],
    trendData: [
      { x: 20, y: 120 },
      { x: 60, y: 135 },
      { x: 100, y: 158 },
      { x: 140, y: 142 },
      { x: 180, y: 112 },
      { x: 220, y: 125 },
      { x: 260, y: 130 }
    ],
    maxRevenue: 1580,
    chartHeight: 160
  },

  onBack() {
    wx.navigateBack();
  },

  onYearSelect() {
    wx.showActionSheet({
      itemList: ['2022', '2023', '2024'],
      success: (res) => {
        const years = [2022, 2023, 2024];
        this.setData({
          selectedYear: years[res.tapIndex]
        });
        this.loadSalesData();
      }
    });
  },

  onTimeSelect() {
    wx.showActionSheet({
      itemList: ['近一周', '近一月', '近三月'],
      success: (res) => {
        const periods = ['week', 'month', 'quarter'];
        this.setData({
          selectedPeriod: periods[res.tapIndex]
        });
        this.loadTrendData();
      }
    });
  },

  loadSalesData() {
    // 模拟加载销售数据
    wx.showLoading({ title: '加载中...' });
    
    // TODO: 调用云函数 getSalesChart
    // wx.cloud.callFunction({
    //   name: 'statistics/getSalesChart',
    //   data: {
    //     storeId: 'your_store_id',
    //     startDate: '2022-10-09',
    //     endDate: '2022-10-14',
    //     type: 'day'
    //   }
    // }).then(res => {
    //   if (res.result.code === 0) {
    //     this.setData({
    //       chartData: res.result.data.dates.map((date, index) => ({
    //         date: date,
    //         orders: res.result.data.orders[index],
    //         revenue: res.result.data.revenues[index]
    //       }))
    //     });
    //   }
    //   wx.hideLoading();
    // }).catch(err => {
    //   console.error('加载销售数据失败:', err);
    //   wx.hideLoading();
    // });
    
    setTimeout(() => {
      wx.hideLoading();
      console.log('加载销售数据:', this.data.selectedYear);
    }, 500);
  },

  loadTrendData() {
    // 模拟加载趋势数据
    wx.showLoading({ title: '加载中...' });
    
    // TODO: 调用云函数 getSalesTrend
    // wx.cloud.callFunction({
    //   name: 'statistics/getSalesTrend',
    //   data: {
    //     storeId: 'your_store_id',
    //     period: this.data.selectedPeriod
    //   }
    // }).then(res => {
    //   if (res.result.code === 0) {
    //     this.setData({
    //       trendDates: res.result.data.dates,
    //       trendData: res.result.data.trendData
    //     });
    //     this.drawTrendChart();
    //   }
    //   wx.hideLoading();
    // }).catch(err => {
    //   console.error('加载趋势数据失败:', err);
    //   wx.hideLoading();
    // });
    
    setTimeout(() => {
      wx.hideLoading();
      console.log('加载趋势数据:', this.data.selectedPeriod);
      // 重新绘制折线图
      this.drawTrendChart();
    }, 500);
  },

  // 柱状图点击事件
  onBarClick(e) {
    const index = e.currentTarget.dataset.index;
    const data = this.data.chartData[index];
    
    wx.showModal({
      title: `${data.date} 销售详情`,
      content: `订单数: ${data.orders}单\n收益: ¥${data.revenue}`,
      showCancel: false,
      confirmText: '确定'
    });
  },

  onLoad() {
    // 页面加载时获取数据
    this.loadSalesData();
    this.loadTrendData();
    // 绘制折线图
    this.drawTrendChart();
  },

  // 绘制折线图
  drawTrendChart() {
    const ctx = wx.createCanvasContext('trendChart', this);
    const canvasWidth = 300; // 画布宽度
    const canvasHeight = 160; // 画布高度
    const padding = 20; // 内边距
    
    // 计算实际绘图区域
    const chartWidth = canvasWidth - padding * 2;
    const chartHeight = canvasHeight - padding * 2;
    
    // 趋势数据
    const trendValues = [1200, 1350, 1580, 1420, 1120, 1250, 1300];
    const maxValue = Math.max(...trendValues);
    const minValue = Math.min(...trendValues);
    const valueRange = maxValue - minValue;
    
    // 计算点的位置
    const points = trendValues.map((value, index) => {
      const x = padding + (index * chartWidth) / (trendValues.length - 1);
      const y = padding + chartHeight - ((value - minValue) / valueRange) * chartHeight;
      return { x, y, value };
    });
    
    // 绘制网格线
    ctx.setStrokeStyle('#f0f0f0');
    ctx.setLineWidth(1);
    for (let i = 0; i <= 4; i++) {
      const y = padding + (chartHeight / 4) * i;
      ctx.beginPath();
      ctx.moveTo(padding, y);
      ctx.lineTo(canvasWidth - padding, y);
      ctx.stroke();
    }
    
    // 绘制趋势线
    ctx.setStrokeStyle('#8b5cf6');
    ctx.setLineWidth(2);
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    
    // 使用贝塞尔曲线绘制平滑线条
    for (let i = 1; i < points.length; i++) {
      const prevPoint = points[i - 1];
      const currentPoint = points[i];
      const controlPoint1X = prevPoint.x + (currentPoint.x - prevPoint.x) / 3;
      const controlPoint1Y = prevPoint.y;
      const controlPoint2X = prevPoint.x + (currentPoint.x - prevPoint.x) * 2 / 3;
      const controlPoint2Y = currentPoint.y;
      
      ctx.bezierCurveTo(
        controlPoint1X, controlPoint1Y,
        controlPoint2X, controlPoint2Y,
        currentPoint.x, currentPoint.y
      );
    }
    ctx.stroke();
    
    // 绘制数据点
    ctx.setFillStyle('#8b5cf6');
    points.forEach(point => {
      ctx.beginPath();
      ctx.arc(point.x, point.y, 4, 0, 2 * Math.PI);
      ctx.fill();
      
      // 绘制白色边框
      ctx.setStrokeStyle('#fff');
      ctx.setLineWidth(2);
      ctx.stroke();
    });
    
    ctx.draw();
  }
});

