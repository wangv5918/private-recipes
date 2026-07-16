#!/usr/bin/env python3
"""
菜谱解析脚本 — 将菜谱文字自动解析为 JSON 并追加到 recipes_full.json

用法：
  1. 将菜谱文字保存为 .txt 文件
  2. 运行: python3 parse_recipe.py recipe.txt
  3. 可选参数:
     --category   指定分类，默认"家常菜"
     --subcategory 指定子分类，自动推断
     --tags       逗号分隔标签，自动推断
     --difficulty 难度：简单/中等/困难，默认"中等"
     --time       烹饪时间（分钟），默认30
     --servings   份量，默认"2-3人份"
     --dry-run    仅打印JSON，不写入文件

菜谱文本格式建议（脚本会尽力解析，非强制）：
  - 第一行作为菜名（或以 # 开头）
  - 食材清单：表格或列表形式
  - 步骤：以"第X部分"或"第X步"分隔
  - 技巧：以"成功关键"或"技巧"标识
  - 营养：以"营养"标识

示例：
  python3 parse_recipe.py 滑蛋鸡腿饭.txt --subcategory 鸡肉 --tags 滑蛋,鸡腿,下饭 --time 40
"""

import json
import re
import sys
import os
import argparse
from typing import Optional


def parse_args():
    parser = argparse.ArgumentParser(
        description="将菜谱文字解析为 JSON 并追加到 recipes_full.json"
    )
    parser.add_argument("file", help="菜谱文本文件路径")
    parser.add_argument("--category", default="家常菜", help="分类（默认：家常菜）")
    parser.add_argument("--subcategory", default=None, help="子分类（如：鸡肉、猪肉）")
    parser.add_argument("--tags", default=None, help="标签，逗号分隔（如：滑蛋,鸡腿,下饭）")
    parser.add_argument("--difficulty", default="中等", choices=["简单", "中等", "困难"])
    parser.add_argument("--time", type=int, default=30, help="烹饪时间（分钟）")
    parser.add_argument("--servings", default="2-3人份", help="份量")
    parser.add_argument("--dry-run", action="store_true", help="仅打印JSON，不写入文件")
    parser.add_argument("--json-only", action="store_true", help="仅输出JSON到stdout")
    return parser.parse_args()


def read_text(filepath: str) -> str:
    """读取菜谱文本文件"""
    with open(filepath, "r", encoding="utf-8") as f:
        return f.read()


def extract_title(text: str) -> str:
    """从文本中提取菜名"""
    lines = text.strip().split("\n")
    for line in lines:
        line = line.strip()
        if not line:
            continue
        # 跳过以数字、符号开头的行
        if re.match(r"^[#＃\-\*·•\d]", line):
            continue
        # 取第一行有意义的中文文本作为标题
        # 移除常见的前缀
        title = re.sub(r"^(Mr\.Wang[，,]\s*|h3\s+|###\s+)", "", line)
        # 截取到第一个括号或标点前
        title = re.split(r"[（(\[【]", title)[0].strip()
        if len(title) >= 2 and re.search(r"[\u4e00-\u9fff]", title):
            return title
    return "未命名菜谱"


def extract_tags_from_text(text: str, subcategory: str = None) -> list:
    """从文本中提取标签"""
    tags = []
    # 根据子分类添加
    if subcategory:
        tags.append(subcategory)

    # 常见关键词匹配
    keyword_map = {
        "下饭": ["下饭", "拌饭", "盖饭"],
        "快手": ["快手", "简单", "快速"],
        "麻辣": ["麻辣", "辣", "辣椒"],
        "清蒸": ["清蒸", "蒸"],
        "红烧": ["红烧"],
        "汤": ["汤", "炖"],
        "凉拌": ["凉拌", "拌"],
        "煎": ["煎", "香煎"],
        "炒": ["炒", "爆炒", "快炒"],
        "卤": ["卤", "卤制"],
        "烤": ["烤", "烤箱"],
        "炸": ["炸", "酥炸"],
        "滑蛋": ["滑蛋"],
        "茶餐厅": ["茶餐厅", "港式"],
        "日式": ["日式", "亲子丼", "味淋"],
    }

    for tag, keywords in keyword_map.items():
        for kw in keywords:
            if kw in text:
                tags.append(tag)
                break

    # 去重，最多8个
    seen = set()
    result = []
    for t in tags:
        if t not in seen:
            seen.add(t)
            result.append(t)
    return result[:8]


def parse_ingredients(text: str) -> list:
    """
    解析食材清单
    尝试识别表格或列表格式的食材
    格式: 食材名 用量 备注
    """
    ingredients = []
    # 尝试找到食材清单段落
    ing_section = None
    patterns = [
        r"食材清单[：:](.*?)(?=二[、.]|第[二三四五]|三[、.]|详细步骤|成功关键|营养|$)",
        r"一[、.]\s*食材清单(.*?)(?=二[、.]|第[二三四五]|三[、.]|详细步骤|成功关键|营养|$)",
        r"食材[：:](.*?)(?=步骤|做法|技巧|营养|$)",
    ]
    for pat in patterns:
        m = re.search(pat, text, re.DOTALL)
        if m:
            ing_section = m.group(1)
            break

    if ing_section:
        # 尝试解析表格行
        lines = ing_section.strip().split("\n")
        for line in lines:
            line = line.strip()
            # 跳过表头行
            if re.match(r"^(类别|食材|用量|备注|主料|辅料|腌|酱|蛋液|💡)", line):
                continue
            # 跳过空行
            if not line or re.match(r"^[-–—]+$", line):
                continue

            # 尝试匹配: 食材名 用量 备注
            # 格式1: 食材名 用量 备注
            parts = re.split(r"\s{2,}|\t", line)
            if len(parts) >= 2:
                name = parts[0].strip()
                amount = parts[1].strip() if len(parts) > 1 else ""
                note = parts[2].strip() if len(parts) > 2 else ""
                if name and re.search(r"[\u4e00-\u9fff]", name):
                    ingredients.append({
                        "name": name,
                        "amount": amount,
                        "note": note
                    })
                    continue

            # 格式2: 食材名 用量
            m2 = re.match(r"^([\u4e00-\u9fff\w]+)\s+(.+)$", line)
            if m2:
                name = m2.group(1)
                amount = m2.group(2)
                if len(name) <= 10:
                    ingredients.append({
                        "name": name,
                        "amount": amount,
                        "note": ""
                    })
                    continue

    return ingredients


def parse_steps(text: str) -> list:
    """
    解析烹饪步骤
    按"第X部分"或"第X步"分段
    """
    steps = []
    # 尝试找到步骤段落
    step_section = None
    patterns = [
        r"二[、.]\s*详细步骤(.*?)(?=三[、.]|成功关键|营养|风味解析|$)",
        r"详细步骤[：:](.*?)(?=成功关键|技巧|营养|风味|$)",
        r"步骤[：:](.*?)(?=技巧|营养|$)",
    ]
    for pat in patterns:
        m = re.search(pat, text, re.DOTALL)
        if m:
            step_section = m.group(1)
            break

    if not step_section:
        return steps

    # 按"第X部分"分割
    phases = re.split(r"第[一二三四五六七八九十\d]+部分[：:]", step_section)
    phase_titles = re.findall(r"第[一二三四五六七八九十\d]+部分[：:]([^\n]*)", step_section)

    # 如果第一部分为空（split 导致），跳过
    if phases and not phases[0].strip():
        phases = phases[1:]

    for i, phase_text in enumerate(phases):
        title = phase_titles[i] if i < len(phase_titles) else f"步骤{i+1}"
        items = []
        lines = phase_text.strip().split("\n")
        for line in lines:
            line = re.sub(r"^\d+[\.\、\)）]\s*", "", line).strip()
            if line and len(line) > 5:
                items.append(line)
        if items:
            steps.append({"phase": title.strip(), "items": items})

    return steps


def parse_tips(text: str) -> list:
    """解析烹饪技巧"""
    tips = []
    patterns = [
        r"成功关键[与和]?[^\n]*[：:]\s*(.*?)(?=\n\n|\n(?:四|营养|风味|$))",
        r"技巧[：:]\s*(.*?)(?=\n\n|\n(?:营养|$))",
        r"三[、.]\s*成功关键[^\n]*\n(.*?)(?=\n(?:四[、.]|营养)|$)",
    ]
    for pat in patterns:
        m = re.search(pat, text, re.DOTALL)
        if m:
            tip_section = m.group(1)
            lines = tip_section.strip().split("\n")
            for line in lines:
                line = re.sub(r"^\d+[\.\、\)）]\s*", "", line).strip()
                if line and len(line) > 10:
                    tips.append(line)
            break
    return tips


def parse_nutrition(text: str) -> list:
    """解析营养信息"""
    nutrition = []
    patterns = [
        r"营养[价值分析]*[：:](.*?)(?=衍生|$)",
        r"四[、.]\s*营养[价值分析]*(.*?)(?=衍生|$)",
    ]
    for pat in patterns:
        m = re.search(pat, text, re.DOTALL)
        if m:
            nut_section = m.group(1)
            lines = nut_section.strip().split("\n")
            for line in lines:
                line = re.sub(r"^[•\-\*\s]+", "", line).strip()
                if line and len(line) > 5:
                    nutrition.append(line)
            break
    return nutrition


def get_next_id(recipes_file: str) -> int:
    """获取下一个可用ID"""
    if not os.path.exists(recipes_file):
        return 1
    with open(recipes_file, "r", encoding="utf-8") as f:
        data = json.load(f)
    if not data:
        return 1
    return max(r.get("id", 0) for r in data) + 1


def build_recipe(text: str, args) -> dict:
    """构建完整的菜谱 JSON 对象"""
    title = extract_title(text)
    subcategory = args.subcategory
    tags = args.tags.split(",") if args.tags else []
    if not tags:
        tags = extract_tags_from_text(text, subcategory)
    else:
        tags = [t.strip() for t in tags]

    ingredients = parse_ingredients(text)
    steps = parse_steps(text)
    tips = parse_tips(text)
    nutrition = parse_nutrition(text)

    recipe = {
        "title": title,
        "category": args.category,
        "subcategory": subcategory or "其他",
        "tags": tags,
        "difficulty": args.difficulty,
        "cookingTime": args.time,
        "servings": args.servings,
        "ingredients": ingredients,
        "steps": steps,
        "tips": tips,
        "nutrition": nutrition,
    }
    return recipe


def main():
    args = parse_args()
    text = read_text(args.file)

    recipe = build_recipe(text, args)

    # 确定JSON文件路径
    script_dir = os.path.dirname(os.path.abspath(__file__))
    recipes_file = os.path.join(script_dir, "recipes_full.json")

    if args.json_only:
        print(json.dumps(recipe, ensure_ascii=False, indent=2))
        return

    # 打印预览
    print("=" * 60)
    print(f"📖 菜名: {recipe['title']}")
    print(f"📂 分类: {recipe['category']} / {recipe['subcategory']}")
    print(f"🏷️  标签: {', '.join(recipe['tags'])}")
    print(f"📊 难度: {recipe['difficulty']} | ⏱ {recipe['cookingTime']}分钟 | 👥 {recipe['servings']}")
    print(f"🛒 食材: {len(recipe['ingredients'])} 种")
    print(f"📝 步骤: {len(recipe['steps'])} 个阶段")
    print(f"💡 技巧: {len(recipe['tips'])} 条")
    print(f"🔬 营养: {len(recipe['nutrition'])} 条")
    print("=" * 60)

    if not recipe["ingredients"]:
        print("⚠️  警告: 未能解析到食材，请在文本中确保食材列表格式正确")
    if not recipe["steps"]:
        print("⚠️  警告: 未能解析到步骤，请确保包含'详细步骤'段落")

    if args.dry_run:
        print("\n📋 JSON 预览 (dry-run 模式，未写入文件):")
        print(json.dumps(recipe, ensure_ascii=False, indent=2))
        return

    # 确认写入
    confirm = input(f"\n写入到 {recipes_file}? [Y/n]: ").strip().lower()
    if confirm and confirm != "y" and confirm != "yes":
        print("已取消")
        return

    # 读取现有数据
    if os.path.exists(recipes_file):
        with open(recipes_file, "r", encoding="utf-8") as f:
            data = json.load(f)
    else:
        data = []

    # 分配ID
    next_id = max((r.get("id", 0) for r in data), default=0) + 1
    recipe["id"] = next_id

    data.append(recipe)

    # 写入
    with open(recipes_file, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    print(f"✅ 已添加: ID={next_id} {recipe['title']} → {recipes_file}")


if __name__ == "__main__":
    main()