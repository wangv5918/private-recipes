#!/usr/bin/env python3
"""
分析 recipes_full.json 中食材/步骤为空的菜谱，更新 空数据菜谱清单.md
"""
import json
from pathlib import Path
from datetime import datetime

BASE_DIR = Path(__file__).parent
JSON_PATH = BASE_DIR / 'recipes_full.json'
OUTPUT_PATH = BASE_DIR / '空数据菜谱清单.md'


def load_recipes():
    with open(JSON_PATH, 'r', encoding='utf-8') as f:
        return json.load(f)


def is_empty(val):
    """判断字段是否为空"""
    if val is None:
        return True
    if isinstance(val, (list, dict)) and len(val) == 0:
        return True
    if isinstance(val, str) and val.strip() == '':
        return True
    return False


def analyze(recipes):
    both_empty = []   # 步骤和食材都为空
    steps_empty = []  # 步骤为空（有食材）
    ingredients_empty = []  # 食材为空（有步骤）

    for r in recipes:
        rid = r.get('id', '?')
        title = r.get('title', '?')
        category = r.get('category', '')
        subcategory = r.get('subcategory', '')
        cat = f"{category}/{subcategory}" if category and subcategory else (category or subcategory or '未分类')

        ing_empty = is_empty(r.get('ingredients'))
        step_empty = is_empty(r.get('steps'))

        if ing_empty and step_empty:
            both_empty.append((rid, title, cat))
        elif step_empty and not ing_empty:
            steps_empty.append((rid, title, cat))
        elif ing_empty and not step_empty:
            ingredients_empty.append((rid, title, cat))

    return both_empty, steps_empty, ingredients_empty


def generate_markdown(both_empty, steps_empty, ingredients_empty):
    total = len(both_empty) + len(steps_empty) + len(ingredients_empty)
    now = datetime.now().strftime('%Y-%m-%d')

    lines = [
        '# 空数据菜谱清单',
        '',
        f'> 总菜谱数：{total} 条  ',
        f'> 统计时间：{now}',
        '',
        '## 统计概览',
        '',
        '| 类别 | 数量 |',
        '|------|------|',
        f'| 步骤为空（有食材） | {len(steps_empty)} |',
        f'| 食材为空（有步骤） | {len(ingredients_empty)} |',
        f'| 步骤和食材都为空 | {len(both_empty)} |',
        f'| **合计** | **{total}** |',
        '',
    ]

    # 步骤和食材都为空
    lines.append(f'## 步骤和食材都为空（{len(both_empty)}条）')
    lines.append('')
    if both_empty:
        lines.append('| ID | 菜名 | 分类 |')
        lines.append('|----|------|------|')
        for rid, title, cat in both_empty:
            lines.append(f'| {rid} | {title} | {cat} |')
    lines.append('')

    # 步骤为空（有食材）
    lines.append(f'## 步骤为空（有食材）（{len(steps_empty)}条）')
    lines.append('')
    if steps_empty:
        lines.append('| ID | 菜名 | 分类 |')
        lines.append('|----|------|------|')
        for rid, title, cat in steps_empty:
            lines.append(f'| {rid} | {title} | {cat} |')
    lines.append('')

    # 食材为空（有步骤）
    lines.append(f'## 食材为空（有步骤）（{len(ingredients_empty)}条）')
    lines.append('')
    if ingredients_empty:
        lines.append('| ID | 菜名 | 分类 |')
        lines.append('|----|------|------|')
        for rid, title, cat in ingredients_empty:
            lines.append(f'| {rid} | {title} | {cat} |')
    lines.append('')

    return '\n'.join(lines)


def main():
    recipes = load_recipes()
    print(f"📖 读取 recipes_full.json：共 {len(recipes)} 条菜谱")

    both_empty, steps_empty, ingredients_empty = analyze(recipes)
    print(f"  步骤和食材都为空: {len(both_empty)} 条")
    print(f"  步骤为空（有食材）: {len(steps_empty)} 条")
    print(f"  食材为空（有步骤）: {len(ingredients_empty)} 条")

    content = generate_markdown(both_empty, steps_empty, ingredients_empty)
    with open(OUTPUT_PATH, 'w', encoding='utf-8') as f:
        f.write(content)

    print(f"✅ 已更新: {OUTPUT_PATH}")


if __name__ == '__main__':
    main()