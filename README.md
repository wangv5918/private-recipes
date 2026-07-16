# 🍳 私房菜谱 — 智能美食检索与管理平台

🔍 智能搜索 · ❤️ 收藏夹 · 🎰 转盘抽奖 · ⏱ 烹饪计时 · 🛒 购物清单 · 🌓 深色模式 · 📱 PWA 支持

---

## ✨ 功能特性

### 核心功能
- **智能搜索**：基于 Fuse.js 模糊搜索，支持按菜名、食材、口味搜索
- **分类浏览**：侧边栏按类别（家常菜/主食）+ 子类别（猪肉/鸡肉/牛肉等）筛选
- **菜谱详情**：完整食材清单、分阶段步骤、烹饪技巧、营养分析

### 今日菜谱 · 轮盘抽奖
- **标签抽奖**：选择食材标签（如"牛肉"），随机抽取 10 道菜生成转盘
- **自定义抽奖**：输入任意选项，生成自定义转盘
- **Canvas 绘制**：彩色扇区 + 文字方向自动翻转，cubic ease-out 缓动动画

### 收藏夹
- 卡片和详情弹窗一键 ❤️ 收藏，点击有弹跳动画
- 筛选栏收藏徽章，点击只看收藏
- 数据持久化到 localStorage

### 烹饪计时器
- 右下角浮动小部件，支持多个并发计时器
- 菜谱详情中一键添加计时（自动填入菜名和烹饪时间）
- 完成时 Web Audio 提示音，可折叠/展开

### 购物清单
- 菜谱详情中「🛒 加入清单」，食材自动合并相同项
- 相同食材自动合并用量，标注来源菜谱
- 勾选已购、一键复制清单到剪贴板
- 右侧滑出面板

### 体验优化
- **深色模式**：暖色暗色调，自动跟随系统偏好，手动切换持久化
- **PWA 离线支持**：Service Worker 缓存，可添加到主屏幕
- **响应式设计**：桌面端 + 移动端完美适配

---

## 🛠️ 技术栈

| 技术 | 用途 |
|------|------|
| 原生 HTML5 / CSS3 / JS(ES6+) | 前端三件套，零框架 |
| Fuse.js | 模糊搜索引擎 |
| Canvas API | 转盘绘制与动画 |
| Web Audio API | 计时器提示音 |
| Service Worker | PWA 离线缓存 |
| localStorage | 收藏/购物清单/主题持久化 |
| Vercel | 免费部署 |

---

## 🚀 快速开始

```bash
git clone https://github.com/wangv5918/private-recipes.git
cd private-recipes

# 本地运行
python3 -m http.server 8000
# 打开 http://localhost:8000
```

---

## 📁 项目结构

```
private-recipes/
├── index.html             # 主页面（纯 HTML 结构）
├── styles.css             # 全局样式（含深色模式）
├── app.js                 # 前端逻辑（搜索/筛选/转盘/收藏/计时/清单/PWA）
├── recipes_full.json      # 完整菜谱数据（306 道）
├── recipes.json           # 精简菜谱数据
├── manifest.json          # PWA 清单
├── sw.js                  # Service Worker（离线缓存）
├── parse_recipe.py        # 菜谱解析脚本（文本 → JSON）
├── parse_cookbook.py      # 飞书文档解析脚本
├── favicon.svg            # 网站图标
├── vercel.json            # Vercel 配置
├── .gitignore             # Git 忽略文件
├── fetch-recipes.js       # 数据获取脚本
├── cover-image-options.md # 封面图技术路线分析
├── edit-feature-options.md# 编辑功能技术路线分析
├── optimization-plan.md   # 后续优化方向
└── sample-feishu-export.html # 示例飞书导出文件
```

---

## 📊 数据格式

```json
{
  "id": 1,
  "title": "菜名",
  "category": "主类别",
  "subcategory": "子类别",
  "tags": ["标签1", "标签2"],
  "difficulty": "难度",
  "cookingTime": 40,
  "servings": "2人份",
  "ingredients": [{ "name": "食材", "amount": "用量", "note": "备注" }],
  "steps": [{ "phase": "阶段名", "items": ["步骤"] }],
  "tips": ["烹饪技巧"],
  "nutrition": ["营养信息"],
  "extra": [{ "type": "table", "rows": [...] }]
}
```

---

## 🛠️ 菜谱解析脚本

`parse_recipe.py` 将菜谱文字自动解析为 JSON 并追加到 `recipes_full.json`。

```bash
# 基础用法
python3 parse_recipe.py recipe.txt \
  --subcategory 鸡肉 \
  --tags 滑蛋,鸡腿,下饭 \
  --time 40 \
  --servings "2人份"

# 仅预览不写入
python3 parse_recipe.py recipe.txt --dry-run

# 仅输出JSON
python3 parse_recipe.py recipe.txt --json-only
```

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `file` | 必填 | 菜谱文本文件路径 |
| `--category` | 家常菜 | 主分类 |
| `--subcategory` | 自动 | 子分类 |
| `--tags` | 自动 | 标签，逗号分隔 |
| `--difficulty` | 中等 | 简单/中等/困难 |
| `--time` | 30 | 烹饪时间（分钟） |
| `--servings` | 2-3人份 | 份量 |
| `--dry-run` | - | 仅预览 |
| `--json-only` | - | 仅输出JSON |

文本格式建议：菜名作为首行，用「一、食材清单」「二、详细步骤」等标识段落。

---

## 📝 后续优化方向

详见 [optimization-plan.md](optimization-plan.md)，包括：

- 转盘增强：历史记录、难度/时间偏好、食材库存匹配
- 核心新功能：每周菜谱计划、食材替换建议
- 技术升级：后端化、用户系统、数据可视化

---

## 📝 License

MIT License

---

## 🌟 贡献

欢迎提交 Issue 和 Pull Request！