# adminLogManage 云函数修复说明

## 📋 问题描述

云函数 `adminLogManage` 显示"更新失败"状态。

## 🔍 问题原因

**原因：云函数目录存在但没有代码文件**

在检查 `cloudfunctions/adminLogManage/` 目录时发现：
- ✅ 目录存在
- ❌ 没有 `index.js` 文件
- ❌ 没有 `package.json` 文件

这导致云函数无法正常部署，显示更新失败。

## ✅ 解决方案

已为云函数创建了完整的代码：

### 1. 创建了 index.js

包含以下功能：
- **getList** - 获取日志列表（支持分页、筛选）
- **create** - 创建操作日志
- **getStats** - 获取日志统计

### 2. 创建了 package.json

配置了云函数依赖：
```json
{
  "name": "adminLogManage",
  "version": "1.0.0",
  "description": "管理员操作日志管理云函数",
  "main": "index.js",
  "dependencies": {
    "wx-server-sdk": "~2.6.3"
  }
}
```

## 🚀 部署步骤

### 方法一：云开发控制台部署

1. 进入云开发控制台
2. 点击"云函数" → "云函数列表"
3. 找到 `adminLogManage` 云函数
4. 点击"上传并部署"
5. 等待部署完成

### 方法二：命令行部署

```bash
# 进入云函数目录
cd cloudfunctions/adminLogManage

# 安装依赖
npm install

# 部署云函数
tcb fn deploy adminLogManage -e your_env_id
```

## 📝 云函数功能说明

### 1. 获取日志列表

```javascript
wx.cloud.callFunction({
  name: 'adminLogManage',
  data: {
    action: 'getList',
    data: {
      page: 1,
      pageSize: 20,
      action: 'updateMerchantStatus', // 可选，筛选操作类型
      startDate: '2025-01-01',        // 可选，开始日期
      endDate: '2025-01-31'            // 可选，结束日期
    }
  }
});
```

### 2. 创建操作日志

```javascript
wx.cloud.callFunction({
  name: 'adminLogManage',
  data: {
    action: 'create',
    data: {
      adminId: 'admin_123',
      action: 'updateMerchantStatus',
      target: '商家名称',
      targetType: 'merchant',
      result: 'success',
      details: {
        merchantId: 'merchant_123',
        oldStatus: 'pending',
        newStatus: 'active'
      }
    }
  }
});
```

### 3. 获取日志统计

```javascript
wx.cloud.callFunction({
  name: 'adminLogManage',
  data: {
    action: 'getStats',
    data: {
      startDate: '2025-01-01',
      endDate: '2025-01-31'
    }
  }
});
```

## 🗄️ 数据库设计

### admin_logs 集合

```javascript
{
  _id: "ObjectId",                // 主键
  adminId: "String",              // 管理员ID
  action: "String",               // 操作类型
  target: "String",               // 操作目标
  targetType: "String",           // 目标类型：merchant, order, system等
  result: "String",               // 操作结果：success, failed, approved, rejected等
  details: {},                    // 详细信息（对象）
  createdAt: Date,                // 创建时间
  updatedAt: Date                  // 更新时间
}
```

### 索引建议

```javascript
db.admin_logs.createIndex({ "adminId": 1, "createdAt": -1 })
db.admin_logs.createIndex({ "action": 1, "createdAt": -1 })
db.admin_logs.createIndex({ "targetType": 1, "createdAt": -1 })
```

## ⚠️ 注意事项

1. **权限控制**
   - 只有管理员可以访问日志
   - 建议在云函数中添加权限验证

2. **日志内容**
   - 不要记录敏感信息（密码、银行卡号等）
   - 记录关键操作的重要信息

3. **日志数量**
   - 定期清理旧日志
   - 建议保留最近3个月的日志

4. **性能优化**
   - 使用索引提高查询速度
   - 使用分页避免一次性加载过多数据

## 🔄 更新记录

### 2025-01-03
- ✅ 创建 adminLogManage 云函数代码
- ✅ 添加获取日志列表功能
- ✅ 添加创建日志功能
- ✅ 添加日志统计功能
- ✅ 配置云函数依赖

## 📂 涉及文件

- `cloudfunctions/adminLogManage/index.js` - 云函数主文件
- `cloudfunctions/adminLogManage/package.json` - 依赖配置

---

**文档版本：** v1.0  
**最后更新：** 2025-01-03  
**维护人员：** 开发团队

