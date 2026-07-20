#!/usr/bin/env python3
"""
菜谱解析脚本 — 将菜谱文字自动解析为 JSON 并追加到 recipes_full.json

用法：
  1. 将菜谱文字保存为 .txt 文件
  2. 运行: python3 parse_recipe.py recipe.txt
  3. 可选参数:
     --category   指定分类，默认"家常菜"
     --subcategory 指定子分类
     --tags       逗号分隔标签
     --difficulty 难度：简单/中等/困难，默认"中等"
     --time       烹饪时间（分钟），默认30
     --servings   份量，默认"2-3人份"
     --dry-run    仅打印JSON，不写入文件
     --json-only  仅输出JSON到stdout

菜谱文本格式（脚本会自动识别，无需严格遵循）：
  支持格式：
    食材：
      - 食材名：用量（如：全脂牛奶：400ml）
      - 食材名：用量（备注）
      - • 食材名 用量
      - 表格格式（制表符/空格分隔）
    步骤：
      - 1. 步骤内容 / 1、步骤内容
      - 步骤一：步骤内容
      - 第X部分：步骤内容
      - 纯文本段落自动识别
    技巧：
      - 技巧/提示/注意/TIPS/小贴士 标记
      - 列表格式

示例：
  python3 parse_recipe.py 双皮奶.txt --category 饮品 --subcategory 饮品 --time 60 --difficulty 困难
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
    with open(filepath, "r", encoding="utf-8") as f:
        return f.read()


# ==================== 标题提取 ====================

def extract_title(text: str) -> str:
    """从文本中提取菜名"""
    lines = text.strip().split("\n")
    for line in lines:
        line = line.strip()
        if not line:
            continue
        # 跳过以数字、符号、markdown标记开头的行
        if re.match(r"^[#＃\-\*·•\d]", line):
            continue
        # 跳过食材/步骤/技巧等关键词开头的行
        if re.match(r"^(食材|步骤|做法|技巧|提示|注意|营养|材料|用料|配方|制作|准备|关键|总结|保存|装饰|搭配|份量)", line):
            continue
        # 移除常见前缀
        title = re.sub(r"^(Mr\.Wang[，,]\s*|h\d\s+|###\s+|##\s+|#\s+|\*\*|【[^】]*】)", "", line)
        # 去除 emoji 和特殊符号
        title = re.sub(r"[^\u4e00-\u9fff\w\s（）()]", "", title).strip()
        # 截取到第一个括号或标点前
        title = re.split(r"[（(\[【—\-]", title)[0].strip()
        if len(title) >= 2 and re.search(r"[\u4e00-\u9fff]", title):
            return title
    return "未命名菜谱"


# ==================== 食材解析 ====================

def parse_ingredients(text: str) -> list:
    """
    解析食材清单，支持多种格式：
    1. 名称：用量（备注）  — 如：全脂牛奶：400ml（2碗量）
    2. 名称：用量  — 如：低筋面粉：85克
    3. • 名称 用量 备注
    4. 表格格式（制表符/空格分隔）
    5. 类型标记：主料/辅料/调味
    """
    # 找食材段落
    section_markers = [
        # 食材/材料/用料 开头
        r'(?:食材清单|食材|材料|用料|配方|一[、.]\s*食材|一[、.]\s*材料|一[、.]\s*用料)[：:]*\s*\n(.*?)(?=\n(?:二[、.]|三[、.]|步骤|做法|制作|技巧|提示|注意|营养|成功|关键|总结|保存|装饰|搭配|风味)|$)',
        # 一、开头
        r'一[、.]\s*\n(.*?)(?=\n(?:二[、.]|三[、.]|步骤|做法|制作|技巧|提示|注意|营养|成功|关键|总结)|$)',
    ]
    
    ing_section = None
    for pat in section_markers:
        m = re.search(pat, text, re.DOTALL)
        if m:
            ing_section = m.group(1).strip()
            break
    
    if not ing_section:
        # 没有明确标记，尝试从文本开头到"步骤"之间的内容
        step_marker = re.search(r'\n(?:步骤|做法|制作|二[、.])', text)
        if step_marker:
            candidate = text[:step_marker.start()].strip()
            # 排除标题行
            lines = candidate.split('\n')
            if len(lines) > 3:
                ing_section = '\n'.join(lines[1:])
    
    if not ing_section:
        return []
    
    ingredients = []
    lines = ing_section.strip().split('\n')
    
    for line in lines:
        line = line.strip()
        if not line:
            continue
        
        # 跳过非食材行
        skip_patterns = [
            r'^(类别|食材|用量|备注|主料|辅料|腌|酱|蛋液|💡|✅|❌|⚠|🔥|📌|点击|image|电子表格)',
            r'^[-–—=]+$',
            r'^(食材清单|食材|材料|用料|配方)[：:]?$',
        ]
        should_skip = False
        for pat in skip_patterns:
            if re.match(pat, line):
                should_skip = True
                break
        if should_skip:
            continue
        
        # 处理类型标记：主料：xxx / 辅料：xxx
        type_match = re.match(r'^(主料|辅料|调味|腌料|酱料|装饰|蛋液|面糊|馅料|糖浆|奶盖|茶底|小料)[：:]?\s*(.*)', line)
        if type_match:
            line = type_match.group(2).strip()
            if not line:
                continue
        
        # 格式1: 名称：用量（备注）或 名称：用量
        colon_match = re.match(r'^(.+?)[：:]\s*(.+)$', line)
        if colon_match:
            name = colon_match.group(1).strip()
            amount = colon_match.group(2).strip()
            # 提取备注（括号内容）
            note = ''
            note_match = re.search(r'[（(]([^）)]*)[）)]', amount)
            if note_match:
                note = note_match.group(1)
                amount = re.sub(r'[（(][^）)]*[）)]', '', amount).strip()
            # 清理名称
            name = re.sub(r'^[•·\-–—\*\d+\.\s]+', '', name).strip()
            if len(name) >= 1 and len(name) <= 30:
                ingredients.append({"name": name, "amount": amount, "note": note})
                continue
        
        # 格式2: • 名称 用量 备注
        line_clean = re.sub(r'^[•·\-–—\*\d+\.\s]+', '', line).strip()
        parts = re.split(r'\s{2,}|\t', line_clean)
        if len(parts) >= 2 and len(parts[0]) <= 15:
            name = parts[0].strip()
            amount = parts[1].strip()
            note = parts[2].strip() if len(parts) > 2 else ''
            if re.search(r'[\u4e00-\u9fff]', name):
                ingredients.append({"name": name, "amount": amount, "note": note})
                continue
        
        # 格式3: 纯文本食材行（如：鸡蛋 2个）
        if len(line_clean) >= 3 and len(line_clean) <= 50 and re.search(r'[\u4e00-\u9fff]', line_clean):
            # 尝试拆分名称和用量
            m = re.match(r'^([\u4e00-\u9fff\w]+)\s+(.+)$', line_clean)
            if m and len(m.group(1)) <= 10:
                ingredients.append({"name": m.group(1), "amount": m.group(2), "note": ""})
    
    return ingredients


# ==================== 步骤解析 ====================

def parse_steps(text: str) -> list:
    """
    解析烹饪步骤，支持多种格式：
    1. 第X部分：...  — 分组步骤
    2. 1. 步骤内容 / 1、步骤内容  — 编号步骤
    3. 步骤一：...  — 中文编号步骤
    4. 纯文本段落 — 自动识别为步骤
    5. 步骤：标记后接内容
    """
    # 找步骤段落
    step_section = None
    section_markers = [
        r'(?:二[、.]\s*(?:详细)?步骤|二[、.]\s*(?:烹饪|制作|操作)?步骤|二[、.]\s*(?:制作|烹饪|操作)?)[：:]*\s*\n(.*?)(?=\n(?:三[、.]|四[、.]|技巧|提示|注意|营养|成功|关键|总结|保存|装饰|搭配|风味|衍生)|$)',
        r'(?:步骤|做法|制作)[：:]\s*\n(.*?)(?=\n(?:技巧|提示|注意|营养|成功|关键|总结|保存|装饰|搭配|风味|衍生)|$)',
        r'二[、.]\s*\n(.*?)(?=\n(?:三[、.]|四[、.]|技巧|提示|注意|营养|成功|关键|总结|保存)|$)',
    ]
    
    for pat in section_markers:
        m = re.search(pat, text, re.DOTALL)
        if m:
            step_section = m.group(1).strip()
            break
    
    if not step_section:
        # 尝试从"步骤"或"做法"之后的所有内容
        m = re.search(r'(?:步骤|做法|制作)[：:]\s*\n', text)
        if m:
            step_section = text[m.end():].strip()
            # 截断到技巧/营养
            end_m = re.search(r'\n(?:技巧|提示|注意|营养|成功|关键|总结|保存|装饰|搭配|风味|衍生)', step_section)
            if end_m:
                step_section = step_section[:end_m.start()]
    
    if not step_section:
        return []
    
    steps = []
    
    # 尝试按"第X部分"分组
    phases = re.split(r'第[一二三四五六七八九十\d]+部分[：:]?\s*', step_section)
    phase_titles = re.findall(r'第[一二三四五六七八九十\d]+部分[：:]?\s*([^\n]*)', step_section)
    
    if len(phases) > 1:
        # 有分组结构
        if not phases[0].strip():
            phases = phases[1:]
        for i, phase_text in enumerate(phases):
            title = phase_titles[i].strip() if i < len(phase_titles) else f"步骤{i+1}"
            items = _extract_step_items(phase_text)
            if items:
                steps.append({"phase": title or f"步骤{i+1}", "items": items})
        return steps
    
    # 无分组结构，提取独立步骤
    items = _extract_step_items(step_section)
    if items:
        # 如果步骤数 <= 8，不分阶段；否则分组
        if len(items) <= 8:
            steps.append({"phase": "制作步骤", "items": items})
        else:
            # 均分为2-3个阶段
            chunk_size = (len(items) + 2) // 3
            for i in range(0, len(items), chunk_size):
                chunk = items[i:i+chunk_size]
                phase_num = i // chunk_size + 1
                steps.append({"phase": f"步骤{phase_num}", "items": chunk})
    
    return steps


def _extract_step_items(text: str) -> list:
    """从文本中提取步骤条目"""
    items = []
    lines = text.strip().split('\n')
    
    for line in lines:
        line = line.strip()
        if not line:
            continue
        
        # 跳过非步骤行
        skip_patterns = [
            r'^(💡|✅|❌|⚠|🔥|📌|📊|点击|image|电子表格)',
            r'^[-–—=]{3,}$',
            r'^(详细步骤|制作步骤|烹饪步骤|操作步骤)[：:]?$',
        ]
        should_skip = False
        for pat in skip_patterns:
            if re.match(pat, line):
                should_skip = True
                break
        if should_skip:
            continue
        
        # 清理编号前缀
        line_clean = re.sub(r'^\d+[\.\、\)）\.]\s*', '', line)
        line_clean = re.sub(r'^步骤[一二三四五六七八九十\d]+[：:\.\、]\s*', '', line_clean)
        line_clean = re.sub(r'^[•·\-–—]\s*', '', line_clean)
        
        if len(line_clean) >= 8:
            items.append(line_clean.strip())
    
    return items


# ==================== 技巧解析 ====================

def parse_tips(text: str) -> list:
    """
    解析技巧/提示，支持多种标记：
    技巧、提示、注意、小贴士、TIPS、tips、TIPS、成功关键、关键
    """
    tips = []
    tip_markers = [
        r'(?:三[、.]\s*)?(?:成功关键|关键技巧|烹饪技巧|技巧|提示|注意|小贴士|TIPS?|Tips?|成功秘诀|避坑指南|常见问题)[：:]*\s*\n(.*?)(?=\n(?:四[、.]|五[、.]|营养|衍生|风味|总结|保存|装饰|搭配)|$)',
        r'三[、.]\s*\n(.*?)(?=\n(?:四[、.]|五[、.]|营养|衍生|风味|总结|保存)|$)',
    ]
    
    for pat in tip_markers:
        m = re.search(pat, text, re.DOTALL)
        if m:
            tip_section = m.group(1).strip()
            lines = tip_section.split('\n')
            for line in lines:
                line = line.strip()
                if not line:
                    continue
                # 清理前缀
                line = re.sub(r'^\d+[\.\、\)）]\s*', '', line)
                line = re.sub(r'^[•·\-–—\*]\s*', '', line)
                line = re.sub(r'^(💡|✅|❌|⚠|🔥|📌|📊)\s*', '', line)
                if len(line) >= 8:
                    tips.append(line.strip())
            break
    
    return tips


# ==================== 营养解析 ====================

def parse_nutrition(text: str) -> list:
    """解析营养信息"""
    nutrition = []
    patterns = [
        r'(?:四[、.]\s*)?营养[价值分析]*[：:]\s*\n(.*?)(?=\n(?:五[、.]|衍生|风味|总结|保存)|$)',
        r'四[、.]\s*\n(.*?)(?=\n(?:五[、.]|衍生)|$)',
    ]
    for pat in patterns:
        m = re.search(pat, text, re.DOTALL)
        if m:
            nut_section = m.group(1).strip()
            lines = nut_section.split('\n')
            for line in lines:
                line = re.sub(r'^[•\-\*\s\d+\.]+', '', line).strip()
                if line and len(line) > 5:
                    nutrition.append(line)
            break
    return nutrition


# ==================== 标签提取 ====================

def extract_tags_from_text(text: str, subcategory: str = None) -> list:
    """从文本中提取标签"""
    tags = []
    if subcategory:
        tags.append(subcategory)
    
    keyword_map = {
        "下饭": ["下饭", "拌饭", "盖饭"],
        "快手": ["快手", "简单", "快速", "懒人"],
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
        "甜品": ["甜品", "甜点", "布丁", "奶冻", "蛋糕", "饼干", "面包", "酥"],
        "饮料": ["饮料", "饮品", "奶茶", "咖啡", "茶", "气泡", "冰沙", "奶昔", "鸡尾酒"],
        "烘焙": ["烘焙", "烤箱", "烤", "面包", "蛋糕", "饼干", "披萨"],
        "蒸": ["蒸", "蒸制", "水浴"],
        "免烤": ["免烤", "免蒸", "免烤箱"],
        "冰镇": ["冰镇", "冰", "冷饮", "冷藏"],
        "热饮": ["热饮", "热", "暖身"],
        "低卡": ["低卡", "低脂", "减脂", "无糖", "代糖"],
        "高蛋白": ["高蛋白", "蛋白", "蛋清"],
        "经典": ["经典", "传统", "老式", "古法"],
        "创意": ["创意", "创新", "花样", "融合"],
        "养生": ["养生", "滋补", "红枣", "枸杞", "姜", "黑芝麻", "桂圆"],
    }
    
    for tag, keywords in keyword_map.items():
        for kw in keywords:
            if kw in text:
                tags.append(tag)
                break
    
    seen = set()
    result = []
    for t in tags:
        if t not in seen:
            seen.add(t)
            result.append(t)
    return result[:8]


# ==================== 构建菜谱 ====================

def get_next_id(recipes_file: str) -> int:
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


# ==================== 主流程 ====================

def main():
    args = parse_args()
    text = read_text(args.file)

    recipe = build_recipe(text, args)

    script_dir = os.path.dirname(os.path.abspath(__file__))
    recipes_file = os.path.join(script_dir, "recipes_full.json")

    if args.json_only:
        print(json.dumps(recipe, ensure_ascii=False, indent=2))
        return

    # 打印预览
    print("=" * 60)
    print(f"📖 菜名: {recipe['title']}")
    print(f"📂 分类: {recipe['category']} / {recipe['subcategory']}")
    print(f"🏷️  标签: {', '.join(recipe['tags']) if recipe['tags'] else '(无)'}")
    print(f"📊 难度: {recipe['difficulty']} | ⏱ {recipe['cookingTime']}分钟 | 👥 {recipe['servings']}")
    print(f"🛒 食材: {len(recipe['ingredients'])} 种")
    for ing in recipe['ingredients']:
        note_str = f"（{ing['note']}）" if ing.get('note') else ""
        print(f"    - {ing['name']}: {ing['amount']} {note_str}")
    print(f"📝 步骤: {len(recipe['steps'])} 个阶段")
    for phase in recipe['steps']:
        print(f"    [{phase['phase']}] {len(phase['items'])} 步")
        for item in phase['items']:
            print(f"      {item[:80]}{'...' if len(item) > 80 else ''}")
    print(f"💡 技巧: {len(recipe['tips'])} 条")
    for tip in recipe['tips']:
        print(f"    - {tip[:80]}{'...' if len(tip) > 80 else ''}")
    print(f"🔬 营养: {len(recipe['nutrition'])} 条")
    print("=" * 60)

    if not recipe["ingredients"]:
        print("⚠️  警告: 未能解析到食材，请检查文本格式")
        print("   支持: 名称：用量 / • 名称 用量 / 表格格式")
    if not recipe["steps"]:
        print("⚠️  警告: 未能解析到步骤，请检查文本格式")
        print("   支持: 1.步骤 / 步骤：/ 第X部分 / 编号列表")

    if args.dry_run:
        print("\n📋 JSON 预览 (dry-run 模式，未写入文件):")
        print(json.dumps(recipe, ensure_ascii=False, indent=2))
        return

    confirm = input(f"\n写入到 {recipes_file}? [Y/n]: ").strip().lower()
    if confirm and confirm != "y" and confirm != "yes":
        print("已取消")
        return

    if os.path.exists(recipes_file):
        with open(recipes_file, "r", encoding="utf-8") as f:
            data = json.load(f)
    else:
        data = []

    next_id = max((r.get("id", 0) for r in data), default=0) + 1
    recipe["id"] = next_id
    data.append(recipe)

    with open(recipes_file, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    print(f"✅ 已添加: ID={next_id} {recipe['title']} → {recipes_file}")
    #  生成一个 1.txt 文件，用于后续使用，内容为空 ；文件路径为当前脚本所在目录下的 recipes文件夹下
    recipes_dir = os.path.join(script_dir, "recipes")
    txt_path = os.path.join(recipes_dir, "1.txt")
    if not os.path.exists(txt_path):
        with open(txt_path, "w", encoding="utf-8") as f:
            f.write("")
        print(f"📄 已生成空白文件: {txt_path} (可用于后续菜谱输入)")


if __name__ == "__main__":
    main()