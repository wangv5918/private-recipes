The user is asking me to list what parameters/categories can be written by the single recipe parsing script. Let me look at the `parse_recipe.py` script to understand its structure and what fields it supports.

The user wants to know what parameters/categories can be written by the single recipe parsing script. Let me also check the current categories in recipes_full.json to give a complete picture.

Now I have the complete picture. Let me summarize the parameters and categories for the user.
`parse_recipe.py` 脚本支持的参数和分类如下：

## 命令行参数

| 参数 | 说明 | 可选值 |
|------|------|--------|
| `file` | 菜谱文本文件路径 | 必填 |
| `--category` | 一级分类 | 见下方分类表，默认 `家常菜` |
| `--subcategory` | 二级分类 | 见下方分类表 |
| `--tags` | 标签，逗号分隔 | 如 `滑蛋,鸡腿,下饭` |
| `--difficulty` | 难度 | `简单` / `中等` / `困难`（默认 `中等`） |
| `--time` | 烹饪时间（分钟） | 默认 `30` |
| `--servings` | 份量 | 默认 `2-3人份` |
| `--dry-run` | 预览 JSON，不写入 | 布尔标志 |
| `--json-only` | 仅输出 JSON 到 stdout | 布尔标志 |

## 可用分类

| 一级分类 (--category) | 二级分类 (--subcategory) |
|----------------------|--------------------------|
| **肉类** (184) | 猪肉、鸡肉、海鲜、牛肉、羊肉 |
| **家常菜** (34) | 素菜、豆腐、蛋类、其他 |
| **面食** (28) | 面食、炒面、拌面 |
| **饮品** (26) | 茶饮、咖啡、鸡尾酒、奶茶、热饮、气泡水、奶昔 |
| **汤羹** (23) | 汤羹 |
| **小吃** (22) | 小吃 |
| **烘焙** (17) | 蛋糕、甜点、饼干、酥点、面包 |
| **米饭** (15) | 米饭 |
| **甜品** (10) | 奶冻、冰品、糖水、炖品 |
| **火锅** (5) | 火锅 |

## 脚本自动解析的字段

脚本从文本中**自动提取**，无需手动指定：

- `title` — 菜名
- `ingredients` — 食材清单（`{name, amount, note}` 结构）
- `steps` — 烹饪步骤（`[{phase, items}]` 结构）
- `tips` — 烹饪技巧
- `nutrition` — 营养信息
- `tags` — 自动从文本关键词匹配标签（如检测到"辣椒"→"麻辣"、"快手"→"快手"等）

## 使用示例

```bash
# 最简用法
python3 parse_recipe.py 双皮奶.txt

# 完整指定分类
python3 parse_recipe.py 红烧排骨.txt \
  --category 肉类 --subcategory 猪肉 \
  --difficulty 中等 --time 45 --servings "3-4人份" \
  --tags "红烧,下饭,硬菜"
```