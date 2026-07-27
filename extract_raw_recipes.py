#!/usr/bin/env python3
"""
从 私房菜谱.docx 提取每个菜谱的原始内容，生成 recipesorigin 目录下的 .md 文件
"""
import os, re
from pathlib import Path
import docx

SKIP = {
    '私房菜谱', '无肉不欢', '碳水の诱惑', '汤的诱惑', '菜菜子',
    '凉菜', '厨房小技巧', '火锅', '炸货', '附录',
    '📝 总结与通用建议', '24款万能酱汁', '厨房酱料完整汇总表',
    '六款万能蘸水详细步骤表', '万能水煮菜清单（适配以上所有蘸水）',
    '常用淀粉与面粉', '肉馅对比', '厨房常见酱料作用', '辣椒油制作',
    '食材处理技巧', '烹饪技巧', '调味技巧', '其他技巧', '刷蜂蜜', '裹糊',
    '料酒和黄酒的区别', '东北酸甜酱', '酸奶薄荷酱', '万能凉拌汁',
    '东北烤肉-酸甜水料', '日式酱油', '家庭版味淋', '酸辣汁',
    '泰式风味烤肉酱料汇总', '粤菜/港式风味烤肉酱料汇总', '卤牛肉蘸汁',
    '拌面酱料', '《6款无敌蘸水：点亮水煮菜的灵魂》',
    '解腻盐渍水果：万能公式+经典做法大全',
    '凉拌菜核心心法：万能公式与基础调味汁',
    '户外木炭烧烤全攻略', '家庭烤肉', '家庭电烤炉烤串', '吊炉烤肉',
    '【附】武大郎烧饼（山东阳谷·煎烙版）差异速记', '炸货卷饼',
    '菜花合集', '地三鲜', '地三鲜–省油版',
}


def clean_text(text):
    """去除飞书导出导致的重复文本（3次重复）"""
    t = text.strip()
    if not t:
        return ''
    for n in [3, 2]:
        part = len(t) // n
        if part > 4 and t[:part] == t[part:2*part]:
            if n == 2 or (n == 3 and t[:part] == t[2*part:3*part]):
                return t[:part].strip()
    return t


def extract_table_data(table):
    """提取表格为二维数组"""
    rows = []
    for row in table.rows:
        cells = [clean_text(c.text).replace('\u200b', '') for c in row.cells]
        if any(cells):
            rows.append(cells)
    return rows


def table_to_markdown(table_data):
    """将表格数据转为 Markdown 表格"""
    if not table_data or len(table_data) < 1:
        return ''
    # 计算每列最大宽度
    col_count = max(len(row) for row in table_data)
    # 补齐列
    padded = [row + [''] * (col_count - len(row)) for row in table_data]
    
    lines = []
    # 表头
    lines.append('| ' + ' | '.join(padded[0]) + ' |')
    # 分隔线
    lines.append('| ' + ' | '.join(['---'] * col_count) + ' |')
    # 数据行
    for row in padded[1:]:
        lines.append('| ' + ' | '.join(row) + ' |')
    
    return '\n'.join(lines)


def match_table_to_recipe(table_data, recipe_title):
    """判断表格是否属于指定菜谱"""
    all_text = ' '.join([' '.join(row) for row in table_data])
    title_keywords = recipe_title.replace('（', '').replace('）', '').replace('(', '').replace(')', '')
    for kw_len in [4, 3, 2]:
        kw = title_keywords[:kw_len]
        if kw in all_text:
            return True
    return False


def extract_raw_recipes(filepath, output_dir):
    doc = docx.Document(filepath)
    body = list(doc.element.body)

    # 收集所有表格
    all_tables = []
    for i, el in enumerate(body):
        tag = el.tag.split('}')[-1] if '}' in el.tag else el.tag
        if tag == 'tbl':
            tidx = len(all_tables)
            if tidx < len(doc.tables):
                td = extract_table_data(doc.tables[tidx])
                all_tables.append({'body_index': i, 'data': td})

    print(f"找到 {len(all_tables)} 个表格")

    # 收集菜谱：每个菜谱包含 [标题, 段落列表, 相关表格列表]
    recipes = []
    current_title = None
    current_paragraphs = []
    current_tables = []
    table_counter = 0
    para_idx = 0

    def save_current():
        nonlocal current_title, current_paragraphs, current_tables
        if current_title:
            recipes.append({
                'title': current_title,
                'paragraphs': current_paragraphs,
                'tables': current_tables,
            })
        current_title = None
        current_paragraphs = []
        current_tables = []

    for el in body:
        tag = el.tag.split('}')[-1] if '}' in el.tag else el.tag

        if tag == 'p':
            if para_idx >= len(doc.paragraphs):
                para_idx += 1
                continue
            para = doc.paragraphs[para_idx]
            para_idx += 1
            text = clean_text(para.text)
            if not text:
                current_paragraphs.append('')  # 保留空行
                continue

            # 获取字号
            sz = None
            for run in para.runs:
                if run.font.size:
                    sz = run.font.size
                    break

            # 菜谱标题（字号 >= 190000）
            if sz and sz >= 190000 and text not in SKIP and len(text) >= 2:
                if not re.match(r'^[0-9\s\.、，。！？]+$', text):
                    save_current()
                    current_title = text
                    current_paragraphs = [text]
                    current_tables = []
                    continue

            if current_title is None:
                continue

            current_paragraphs.append(text)

        elif tag == 'tbl':
            if current_title and table_counter < len(all_tables):
                td = all_tables[table_counter]['data']
                table_counter += 1
                if td and len(td) >= 2:
                    current_tables.append(td)
            elif table_counter < len(all_tables):
                table_counter += 1

    save_current()

    print(f"提取到 {len(recipes)} 个菜谱")

    # 为每个菜谱生成 .md 文件
    os.makedirs(output_dir, exist_ok=True)
    written = 0

    for recipe in recipes:
        title = recipe['title']
        # 清理文件名中的非法字符
        safe_title = title.replace('/', '／').replace('\\', '＼').replace(':', '：')
        safe_title = re.sub(r'[<>"|?*]', '', safe_title)
        filepath = os.path.join(output_dir, f"{safe_title}.md")

        lines = []
        # 标题
        lines.append(f"# {title}")
        lines.append('')

        # 段落内容
        for p in recipe['paragraphs'][1:]:  # 跳过标题（已写入）
            if p:
                lines.append(p)
            else:
                lines.append('')

        # 表格
        if recipe['tables']:
            lines.append('')
            for td in recipe['tables']:
                md_table = table_to_markdown(td)
                if md_table:
                    lines.append('')
                    lines.append(md_table)
                    lines.append('')

        content = '\n'.join(lines).strip() + '\n'
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        written += 1

    print(f"已生成 {written} 个 .md 文件到 {output_dir}/")
    return written


def main():
    base_dir = Path(__file__).parent
    docx_path = base_dir / '私房菜谱.docx'
    output_dir = base_dir / 'recipesorigin'

    if not docx_path.exists():
        print(f"❌ 文件不存在: {docx_path}")
        return

    print(f"📖 读取: {docx_path}")
    count = extract_raw_recipes(str(docx_path), str(output_dir))
    print(f"✅ 完成！共 {count} 个菜谱原始文件")


if __name__ == '__main__':
    main()