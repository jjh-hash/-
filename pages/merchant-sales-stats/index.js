Page({
  data: {
    statusBarHeight: wx.getWindowInfo().statusBarHeight || 20,
    storeId: '', // 店铺ID
    selectedYear: new Date().getFullYear(), // 默认当前年份
    selectedPeriod: 'week',
    // 销售概览数据
    totalSales: 0,
    dailyGrowth: 0, // 日增长金额（元），正数表示上涨，负数表示下跌
    dailyGrowthDisplay: '0.00', // 显示的日增长金额（绝对值）
    isGrowthPositive: true, // 是否为增长（true=上涨，false=下跌）
    currentRevenue: 0,
    effectiveOrders: 0,
    // 图表数据
    chartData: [],
    trendDates: [],
    trendData: [],
    maxRevenue: 0,
    maxOrders: 0, // 最大订单数
    chartHeight: 160,
    loading: false
  },

  // 格式化金额（保留两位小数）
  formatMoney(value) {
    if (value === null || value === undefined || isNaN(value)) {
      return '0.00';
    }
    return Number(value).toFixed(2);
  },

  // 格式化增长率
  formatGrowth(value) {
    if (value === null || value === undefined || isNaN(value)) {
      return '0.00';
    }
    return Number(value).toFixed(2);
  },

  onBack() {
    wx.navigateBack();
  },

  onYearSelect() {
    const currentYear = new Date().getFullYear();
    const years = [];
    for (let i = currentYear - 2; i <= currentYear; i++) {
      years.push(i.toString());
    }
    
    wx.showActionSheet({
      itemList: years,
      success: (res) => {
        const selectedYear = parseInt(years[res.tapIndex]);
        this.setData({
          selectedYear: selectedYear
        });
        // 重新加载数据
        this.loadSalesOverview();
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

  async loadSalesData() {
    const storeId = this.data.storeId;
    if (!storeId) {
      console.error('【销售统计】店铺ID为空');
      return;
    }

    try {
      wx.showLoading({ title: '加载中...' });
      console.log('【销售统计】加载销售图表数据，年份:', this.data.selectedYear);
      
      // 计算日期范围（当前年份的最近7天，或指定月份的日期范围）
      const now = new Date();
      const end = new Date(now);
      end.setHours(23, 59, 59, 999);
      const start = new Date(end);
      start.setDate(start.getDate() - 6); // 最近7天
      start.setHours(0, 0, 0, 0);
      
      // 获取当前登录的商家信息
      const merchantInfo = wx.getStorageSync('merchantInfo');
      const merchantId = merchantInfo?._id || null;
      
      const res = await wx.cloud.callFunction({
        name: 'statistics',
        data: {
          action: 'getSalesChart',
          data: {
            storeId: storeId,
            merchantId: merchantId, // 传递商家ID，优先使用
            startDate: start.toISOString().split('T')[0],
            endDate: end.toISOString().split('T')[0],
            type: 'day'
          }
        }
      });

      wx.hideLoading();

      console.log('【销售统计】销售图表返回:', res.result);

      if (res.result && res.result.code === 200) {
        const { dates, orders, revenues } = res.result.data;
        
        // 计算最大收益值（用于图表高度计算）
        const maxRevenue = Math.max(...revenues, 1);
        
        const chartData = dates.map((date, index) => ({
          date: date,
          orders: orders[index] || 0,
          revenue: revenues[index] || 0
        }));
        
        // 计算最大订单数
        const maxOrders = Math.max(...orders, 1);
        
        this.setData({
          chartData: chartData,
          maxRevenue: maxRevenue,
          maxOrders: maxOrders
        });
        
        console.log('【销售统计】销售图表数据加载成功，数据条数:', chartData.length);
      } else {
        console.error('【销售统计】销售图表返回错误:', res.result);
        wx.showToast({
          title: res.result?.message || '加载失败',
          icon: 'none'
        });
      }
    } catch (error) {
      wx.hideLoading();
      console.error('【销售统计】加载销售图表异常:', error);
      // 如果云函数未部署，显示友好提示
      if (error.errCode === -501000) {
        wx.showToast({
          title: '云函数未部署，请先部署statistics云函数',
          icon: 'none',
          duration: 3000
        });
      } else {
        wx.showToast({
          title: '加载失败',
          icon: 'none'
        });
      }
    }
  },

  async loadTrendData() {
    const storeId = this.data.storeId;
    if (!storeId) {
      console.error('【销售统计】店铺ID为空');
      return;
    }

    try {
      wx.showLoading({ title: '加载中...' });
      console.log('【销售统计】加载销售趋势数据，周期:', this.data.selectedPeriod);
      
      // 获取当前登录的商家信息
      const merchantInfo = wx.getStorageSync('merchantInfo');
      const merchantId = merchantInfo?._id || null;
      
      const res = await wx.cloud.callFunction({
        name: 'statistics',
        data: {
          action: 'getSalesTrend',
          data: {
            storeId: storeId,
            merchantId: merchantId, // 传递商家ID，优先使用
            period: this.data.selectedPeriod
          }
        }
      });

      wx.hideLoading();

      console.log('【销售统计】销售趋势返回:', res.result);

      if (res.result && res.result.code === 200) {
        const { dates, trendData } = res.result.data;
        
        this.setData({
          trendDates: dates,
          trendData: trendData
        }, () => {
          // setData完成后，等待Canvas渲染完成再绘制
          console.log('【销售统计】销售趋势数据加载成功，数据条数:', dates.length);
          console.log('【销售统计】趋势数据:', trendData);
          
          // 延迟绘制，确保Canvas已渲染到DOM
          setTimeout(() => {
            console.log('【销售统计】开始绘制折线图，数据条数:', trendData.length);
            this.drawTrendChart();
          }, 1000);
        });
      } else {
        console.error('【销售统计】销售趋势返回错误:', res.result);
        wx.showToast({
          title: res.result?.message || '加载失败',
          icon: 'none'
        });
      }
    } catch (error) {
      wx.hideLoading();
      console.error('【销售统计】加载销售趋势异常:', error);
      // 如果云函数未部署，显示友好提示
      if (error.errCode === -501000) {
        wx.showToast({
          title: '云函数未部署，请先部署statistics云函数',
          icon: 'none',
          duration: 3000
        });
      } else {
        wx.showToast({
          title: '加载失败',
          icon: 'none'
        });
      }
    }
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
    console.log('【销售统计】页面加载');
    this.initPage();
  },

  onReady() {
    console.log('【销售统计】页面准备完成，Canvas已就绪');
    // 如果已经有数据，绘制图表
    if (this.data.trendData && this.data.trendData.length > 0) {
      setTimeout(() => {
        this.drawTrendChart();
      }, 300);
    }
  },

  // 初始化页面
  async initPage() {
    // 先获取店铺ID
    const storeId = await this.getStoreId();
    if (storeId) {
      // 店铺ID获取成功后，加载所有数据
      await Promise.all([
        this.loadSalesOverview(),
        this.loadSalesData(),
        this.loadTrendData()
      ]);
      // 绘制折线图
      setTimeout(() => {
        this.drawTrendChart();
      }, 1000);
    } else {
      wx.showToast({
        title: '获取店铺信息失败',
        icon: 'none'
      });
    }
  },

  // 获取店铺ID
  async getStoreId() {
    const merchantInfo = wx.getStorageSync('merchantInfo');
    if (merchantInfo && merchantInfo.storeId) {
      this.setData({ storeId: merchantInfo.storeId });
      console.log('【销售统计】从本地存储获取店铺ID:', merchantInfo.storeId);
      return merchantInfo.storeId;
    }
    
    // 如果没有storeId，尝试从云函数获取
    try {
      wx.showLoading({ title: '获取店铺信息...' });
      const res = await wx.cloud.callFunction({
        name: 'storeManage',
        data: {
          action: 'getStoreInfo',
          data: {}
        }
      });
      wx.hideLoading();
      
      console.log('【销售统计】云函数返回:', res.result);
      
      if (res.result && res.result.code === 200 && res.result.data.storeInfo) {
        const storeInfo = res.result.data.storeInfo;
        const storeId = storeInfo._id || storeInfo.storeId || storeInfo.id;
        if (storeId) {
          console.log('【销售统计】获取到店铺ID:', storeId);
          this.setData({ storeId: storeId });
          // 更新本地存储
          const merchantInfo = wx.getStorageSync('merchantInfo') || {};
          merchantInfo.storeId = storeId;
          wx.setStorageSync('merchantInfo', merchantInfo);
          return storeId;
        }
      }
      
      console.error('【销售统计】未能获取店铺ID');
      return null;
    } catch (err) {
      wx.hideLoading();
      console.error('【销售统计】获取店铺ID失败:', err);
      return null;
    }
  },

  // 加载销售概览
  async loadSalesOverview() {
    const storeId = this.data.storeId;
    if (!storeId) {
      console.error('【销售统计】店铺ID为空');
      return;
    }

    try {
      console.log('【销售统计】加载销售概览，年份:', this.data.selectedYear);
      
      // 获取当前登录的商家信息
      const merchantInfo = wx.getStorageSync('merchantInfo');
      const merchantId = merchantInfo?._id || null;
      
      const res = await wx.cloud.callFunction({
        name: 'statistics',
        data: {
          action: 'getSalesOverview',
          data: {
            storeId: storeId,
            merchantId: merchantId, // 传递商家ID，优先使用
            year: this.data.selectedYear
          }
        }
      });

      console.log('【销售统计】销售概览返回:', res.result);

      if (res.result && res.result.code === 200) {
        const data = res.result.data;
        
        // 确保数据类型正确并格式化
        const totalSales = Number(data.totalSales) || 0;
        const dailyGrowth = Number(data.dailyGrowth) || 0; // 金额差值，正数=上涨，负数=下跌
        const currentRevenue = Number(data.currentRevenue) || 0;
        const effectiveOrders = Number(data.effectiveOrders) || 0;
        
        // 计算日增长显示信息
        const isGrowthPositive = dailyGrowth >= 0;
        const dailyGrowthDisplay = Math.abs(dailyGrowth).toFixed(2); // 绝对值，用于显示
        
        console.log('【销售统计】准备设置数据:', {
          totalSales,
          dailyGrowth,
          dailyGrowthDisplay,
          isGrowthPositive,
          currentRevenue,
          effectiveOrders
        });
        
        this.setData({
          totalSales: this.formatMoney(totalSales),
          dailyGrowth: dailyGrowth, // 保留原始值（正数或负数）
          dailyGrowthDisplay: dailyGrowthDisplay, // 显示用的绝对值
          isGrowthPositive: isGrowthPositive, // 是否为增长
          currentRevenue: this.formatMoney(currentRevenue),
          effectiveOrders: effectiveOrders
        });
        
        console.log('【销售统计】销售概览加载成功:', {
          totalSales: this.data.totalSales,
          dailyGrowth: this.data.dailyGrowth,
          currentRevenue: this.data.currentRevenue,
          effectiveOrders: this.data.effectiveOrders
        });
      } else {
        console.error('【销售统计】销售概览返回错误:', res.result);
      }
    } catch (error) {
      console.error('【销售统计】加载销售概览异常:', error);
      // 如果云函数未部署，显示友好提示
      if (error.errCode === -501000) {
        wx.showToast({
          title: '云函数未部署，请先部署statistics云函数',
          icon: 'none',
          duration: 3000
        });
      }
    }
  },

  // 绘制折线图
  drawTrendChart() {
    console.log('【销售统计】drawTrendChart 被调用');
    console.log('【销售统计】当前trendData:', this.data.trendData);
    console.log('【销售统计】当前trendDates:', this.data.trendDates);
    
    if (!this.data.trendData || this.data.trendData.length === 0) {
      console.log('【销售统计】没有趋势数据，跳过绘制');
      return;
    }
    
    try {
      const ctx = wx.createCanvasContext('trendChart', this);
      if (!ctx) {
        console.error('【销售统计】无法创建Canvas上下文');
        return;
      }
      
      // 使用固定尺寸（与WXML中设置的尺寸一致）
      const canvasWidth = 300;
      const canvasHeight = 160;
      const padding = 20;
      
      console.log('【销售统计】开始绘制，Canvas尺寸:', canvasWidth, canvasHeight);
      
      this.drawChartWithContext(ctx, canvasWidth, canvasHeight, padding);
    } catch (error) {
      console.error('【销售统计】绘制折线图异常:', error);
    }
  },

  // 实际绘制图表的函数
  drawChartWithContext(ctx, canvasWidth, canvasHeight, padding) {
    try {
      // 计算实际绘图区域
      const chartWidth = canvasWidth - padding * 2;
      const chartHeight = canvasHeight - padding * 2;
      
      // 使用实际的趋势数据
      const trendValues = this.data.trendData && this.data.trendData.length > 0 
        ? this.data.trendData 
        : [];
      
      console.log('【销售统计】趋势数据值:', trendValues);
      
      if (trendValues.length === 0) {
        // 如果没有数据，绘制空状态提示
        console.log('【销售统计】没有趋势数据，绘制空状态');
        ctx.setFillStyle('#999');
        ctx.setFontSize(12);
        ctx.fillText('暂无数据', canvasWidth / 2 - 30, canvasHeight / 2);
        ctx.draw();
        return;
      }
      
      // 检查是否所有值都是0
      const hasNonZeroValue = trendValues.some(v => v !== 0);
      if (!hasNonZeroValue) {
        console.log('【销售统计】所有趋势数据都是0，绘制空状态');
        ctx.setFillStyle('#999');
        ctx.setFontSize(12);
        ctx.fillText('暂无数据', canvasWidth / 2 - 30, canvasHeight / 2);
        ctx.draw();
        return;
      }
      
      const maxValue = Math.max(...trendValues);
      const minValue = Math.min(...trendValues);
      const valueRange = maxValue - minValue || 1; // 防止除零
      
      console.log('【销售统计】图表计算:', {
        maxValue,
        minValue,
        valueRange,
        dataCount: trendValues.length
      });
      
      // 计算点的位置
      const points = trendValues.map((value, index) => {
        const x = trendValues.length > 1 
          ? padding + (index * chartWidth) / (trendValues.length - 1)
          : padding + chartWidth / 2; // 只有一个点时居中
        const y = padding + chartHeight - ((value - minValue) / valueRange) * chartHeight;
        return { x, y, value };
      });
      
      console.log('【销售统计】计算的点:', points);
    
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
    if (points.length > 1) {
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
    } else if (points.length === 1) {
      // 只有一个点时，绘制一个点
      ctx.lineTo(points[0].x, points[0].y);
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
    
      ctx.draw(false, () => {
        console.log('【销售统计】折线图绘制完成');
      });
      
    } catch (error) {
      console.error('【销售统计】绘制折线图异常:', error);
    }
  }
});

