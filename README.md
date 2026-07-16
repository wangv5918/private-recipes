# 🍳 私房菜谱 - 智能美食检索与管理平台

🔍 AI 驱动的菜谱搜索与推荐  
❤️ 菜谱收藏与个性化管理  
🎲 每日转盘随机推荐今日菜谱（支持自定义转盘内容）

---

## ✨ 功能特性

- **智能检索**：基于 Fuse.js 的模糊搜索，支持按菜名、食材、口味搜索
- **分类浏览**：支持按类别（家常菜、主食等）和子类别筛选
- **菜谱详情**：完整的食材清单、详细步骤、烹饪技巧、营养分析
- **收藏功能**：本地存储收藏夹，随时回顾喜欢的菜式
- **每日转盘**：随机抽取今日菜谱，支持自定义转盘内容
- **响应式设计**：完美适配桌面端和移动端

---

## 🛠️ 技术栈

- **前端框架**：原生 HTML5 / CSS3 / JavaScript（ES6+）
- **搜索引擎**：Fuse.js（轻量级模糊搜索库）
- **部署平台**：Vercel
- **数据存储**：localStorage（收藏功能）
- **图标**：自定义 SVG Logo

---

## 🚀 快速开始

### 本地运行

```bash
# 克隆仓库
git clone https://github.com/你的用户名/private-recipes.git

# 进入项目目录
cd private-recipes

# 使用本地服务器运行（推荐）
python -m http.server 8000
# 或
npx serve

# 打开浏览器访问
open http://localhost:8000
```

### 部署到 Vercel

1. 在 GitHub 创建仓库并推送代码
2. 打开 [Vercel Dashboard](https://vercel.com/dashboard)
3. 点击 **New Project** → **Import Git Repository**
4. 选择你的 GitHub 仓库，点击 **Import**
5. Vercel 会自动检测项目配置并部署

---

## 📁 项目结构

```
private-recipes/
├── index.html          # 主页面（包含所有 HTML/CSS/JS）
├── recipes_full.json   # 完整菜谱数据（947KB）
├── recipes.json        # 精简菜谱数据
├── favicon.svg         # 网站图标
├── vercel.json         # Vercel 配置
├── .gitignore          # Git 忽略文件
├── fetch-recipes.js    # 数据获取脚本
├── parse_cookbook.py   # 飞书文档解析脚本
└── sample-feishu-export.html  # 示例飞书导出文件
```

---

## 📊 数据格式

每条菜谱包含以下字段：

```json
{
  "id": 1,
  "title": "菜名",
  "category": "主类别",
  "subcategory": "子类别",
  "tags": ["标签1", "标签2"],
  "difficulty": "难度",
  "cookingTime": 烹饪时间(分钟),
  "servings": "份量",
  "ingredients": [{ "name": "食材名", "amount": "用量", "note": "备注" }],
  "steps": [{ "phase": "阶段名", "items": ["步骤1", "步骤2"] }],
  "tips": ["技巧1", "技巧2"],
  "nutrition": ["营养信息"],
  "extra": [{ "type": "table", "rows": [...] }]
}
```

---

## 📝 License

MIT License

---

## 🌟 贡献

欢迎提交 Issue 和 Pull Request！