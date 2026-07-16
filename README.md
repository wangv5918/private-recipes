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
├── index.html           # 主页面（纯 HTML 结构）
├── styles.css           # 全局样式表
├── app.js               # 前端逻辑（搜索/筛选/转盘/详情）
├── recipes_full.json    # 完整菜谱数据（306道）
├── recipes.json         # 精简菜谱数据
├── parse_recipe.py      # 菜谱解析脚本（文本→JSON）
├── parse_cookbook.py    # 飞书文档解析脚本
├── favicon.svg          # 网站图标
├── vercel.json          # Vercel 配置
├── .gitignore           # Git 忽略文件
├── fetch-recipes.js     # 数据获取脚本
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

## 🛠️ 菜谱解析脚本

`parse_recipe.py` 可将菜谱文字自动解析为 JSON 并追加到 `recipes_full.json`。

### 用法

```bash
# 基础用法
python3 parse_recipe.py recipe.txt \
  --subcategory 鸡肉 \
  --tags 滑蛋,鸡腿,下饭 \
  --time 40 \
  --servings "2人份"

# 仅预览不写入
python3 parse_recipe.py recipe.txt --dry-run

# 仅输出JSON到stdout
python3 parse_recipe.py recipe.txt --json-only
```

### 参数说明

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `file` | 必填 | 菜谱文本文件路径 |
| `--category` | 家常菜 | 主分类 |
| `--subcategory` | 自动推断 | 子分类（如：鸡肉、猪肉） |
| `--tags` | 自动推断 | 标签，逗号分隔 |
| `--difficulty` | 中等 | 难度：简单/中等/困难 |
| `--time` | 30 | 烹饪时间（分钟） |
| `--servings` | 2-3人份 | 份量 |
| `--dry-run` | - | 仅打印JSON，不写入文件 |
| `--json-only` | - | 仅输出JSON到stdout |

### 完整示例

假设有菜谱文本文件 `番茄炒蛋.txt`：

```
番茄炒蛋

一、食材清单

类别 食材 用量 备注

主料 番茄 2个 切块
鸡蛋 3个 打散
葱 1根 切葱花

辅料 盐 1小勺
白糖 ½小勺 提鲜
食用油 适量

二、详细步骤

第一部分：准备
1. 番茄切块，鸡蛋打散加少许盐。
2. 葱切葱花备用。

第二部分：炒蛋
3. 热锅凉油，油温七成倒入蛋液。
4. 蛋液凝固后快速划散，盛出备用。

第三部分：炒番茄
5. 锅中少许油，放入番茄块炒软出汁。
6. 加盐和白糖调味。

第四部分：合炒
7. 倒入炒好的鸡蛋，翻炒均匀。
8. 撒葱花出锅。

三、成功关键与风味解析

1. 番茄要炒出汁才够味，可加少许水帮助出汁
2. 鸡蛋不要炒太老，七分熟就盛出，余温会继续熟化
3. 白糖是关键，中和番茄酸味，让口感更柔和

四、营养价值分析

番茄含丰富番茄红素和维生素C
鸡蛋提供优质蛋白和卵磷脂
热量约200大卡/人份
```

运行命令：

```bash
python3 parse_recipe.py 番茄炒蛋.txt \
  --subcategory 素菜 \
  --tags 番茄,鸡蛋,快手,下饭 \
  --time 15 \
  --difficulty 简单 \
  --servings "2人份"
```

输出预览：

```
============================================================
📖 菜名: 番茄炒蛋
📂 分类: 家常菜 / 素菜
🏷️  标签: 番茄, 鸡蛋, 快手, 下饭
📊 难度: 简单 | ⏱ 15分钟 | 👥 2人份
🛒 食材: 6 种
📝 步骤: 4 个阶段
💡 技巧: 3 条
🔬 营养: 3 条
============================================================

写入到 recipes_full.json? [Y/n]: y
✅ 已添加: ID=307 番茄炒蛋 → recipes_full.json
```

### 文本格式建议

脚本会尽力解析，但以下格式效果最佳：

- 以 **菜名** 作为第一行
- 用 **一、食材清单** 标识食材段，食材按 `名称  用量  备注` 格式
- 用 **二、详细步骤** 标识步骤段，以 **第X部分** 分段
- 用 **三、成功关键** 或 **技巧** 标识技巧段
- 用 **四、营养** 标识营养段

---

## 📝 License

MIT License

---

## 🌟 贡献

欢迎提交 Issue 和 Pull Request！