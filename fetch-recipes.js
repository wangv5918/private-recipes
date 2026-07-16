#!/usr/bin/env node
/**
 * 飞书菜谱文档提取脚本
 * ======================
 *
 * 功能：从飞书导出的 HTML 文件中提取菜谱数据，生成 recipes.json
 *
 * 使用方法：
 *   1. 在飞书文档中，每道菜谱标题使用 H3 格式
 *   2. 导出飞书文档为 HTML（飞书 → 导出 → HTML）
 *   3. 运行：node fetch-recipes.js 你的飞书导出文件.html
 *   4. 生成的 recipes.json 可直接用于前端页面
 *
 * 飞书文档结构要求（基于每个 H3 标题的菜谱）：
 *   ### 菜名
 *   一、食材清单
 *     - 食材1：用量（备注）
 *     - 食材2：用量
 *   二、详细步骤
 *    第一部分：xxx
 *      1. 步骤描述
 *      2. 步骤描述
 *    第二部分：xxx
 *      ...
 *   三、成功关键与风味解析（可选）
 *     - 技巧1
 *     - 技巧2
 */

const fs = require('fs');
const path = require('path');

// ==================== 主逻辑 ====================

function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    console.log(`
飞书菜谱提取工具

用法:
  node fetch-recipes.js <飞书导出的HTML文件> [--output <输出路径>] [--category <分类>] [--subcategory <子分类>]

参数:
  --output, -o      输出 JSON 文件路径（默认: ./recipes.json）
  --category, -c    默认一级分类（如: 家常菜），未从文档中解析到分类时使用
  --subcategory, -s 默认二级分类（如: 猪肉）
  --help, -h        显示帮助信息

示例:
  node fetch-recipes.js feishu-export.html
  node fetch-recipes.js feishu-export.html -o ./data/recipes.json -c 家常菜
  node fetch-recipes.js feishu-export.html -o recipes.json --category 主食 --subcategory 面食
`);
    process.exit(0);
  }

  const htmlFile = args[0];
  if (!fs.existsSync(htmlFile)) {
    console.error(`❌ 文件不存在: ${htmlFile}`);
    process.exit(1);
  }

  // 解析参数
  const outputIdx = args.indexOf('--output') !== -1 ? args.indexOf('--output') : args.indexOf('-o');
  const outputPath = outputIdx !== -1 ? args[outputIdx + 1] : path.join(path.dirname(htmlFile) || '.', 'recipes.json');

  const catIdx = args.indexOf('--category') !== -1 ? args.indexOf('--category') : args.indexOf('-c');
  const defaultCategory = catIdx !== -1 ? args[catIdx + 1] : '家常菜';

  const subcatIdx = args.indexOf('--subcategory') !== -1 ? args.indexOf('--subcategory') : args.indexOf('-s');
  const defaultSubcategory = subcatIdx !== -1 ? args[subcatIdx + 1] : '';

  console.log(`📖 读取文件: ${htmlFile}`);
  const html = fs.readFileSync(htmlFile, 'utf-8');

  console.log('🔍 解析菜谱...');
  const recipes = parseRecipesFromHTML(html, defaultCategory, defaultSubcategory);

  if (recipes.length === 0) {
    console.warn('⚠️  未从文档中解析到任何菜谱，请检查:');
    console.warn('   1. 文档中是否使用 H3 (###) 作为菜谱标题');
    console.warn('   2. 飞书导出格式是否为 HTML');
    console.warn('   3. 尝试使用 --help 查看帮助');
    process.exit(1);
  }

  // 分配 ID
  recipes.forEach((r, i) => {
    r.id = i + 1;
  });

  // 写入文件
  const jsonStr = JSON.stringify(recipes, null, 2);
  fs.writeFileSync(outputPath, jsonStr, 'utf-8');

  console.log(`✅ 成功提取 ${recipes.length} 道菜谱`);
  console.log(`📄 输出文件: ${outputPath}`);
  console.log(`📊 分类统计:`);

  const catStats = {};
  recipes.forEach(r => {
    const key = `${r.category} / ${r.subcategory}`;
    catStats[key] = (catStats[key] || 0) + 1;
  });
  Object.entries(catStats).forEach(([cat, count]) => {
    console.log(`   ${cat}: ${count} 道`);
  });
}

// ==================== HTML 解析 ====================

function parseRecipesFromHTML(html, defaultCategory, defaultSubcategory) {
  const recipes = [];

  // 方法1: 按 H3 标签切分
  // 飞书导出的 HTML 中，H3 一般格式为 <h3>菜名</h3>
  const h3Regex = /<h3[^>]*>(.*?)<\/h3>/gi;
  const h3Matches = [];
  let match;

  while ((match = h3Regex.exec(html)) !== null) {
    h3Matches.push({
      title: cleanHTML(match[1]).trim(),
      index: match.index,
      endIndex: match.index + match[0].length,
    });
  }

  if (h3Matches.length === 0) {
    console.warn('⚠️  未找到 H3 标签，尝试查找其他标题格式...');
    return recipes;
  }

  console.log(`   找到 ${h3Matches.length} 个 H3 标题`);

  for (let i = 0; i < h3Matches.length; i++) {
    const current = h3Matches[i];
    const title = current.title;

    // 跳过非菜谱标题（如目录、前言等）
    if (isNonRecipeTitle(title)) {
      console.log(`   ⏭️  跳过非菜谱标题: ${title}`);
      continue;
    }

    // 获取当前 H3 到下一个 H3 之间的内容
    const startPos = current.endIndex;
    const endPos = i < h3Matches.length - 1 ? h3Matches[i + 1].index : html.length;
    const sectionHTML = html.slice(startPos, endPos);

    const recipe = parseRecipeSection(title, sectionHTML, defaultCategory, defaultSubcategory);
    if (recipe) {
      console.log(`   🍳 解析: ${recipe.title}`);
      recipes.push(recipe);
    }
  }

  return recipes;
}

function isNonRecipeTitle(title) {
  const skipPatterns = [
    /^目录$/,
    /^前言$/,
    /^说明$/,
    /^索引$/,
    /^附录$/,
    /^参考$/,
    /^关于$/,
    /^菜谱大全$/,
    /^合集$/,
    /^目录/i,
    /^前言/i,
  ];
  return skipPatterns.some(p => p.test(title));
}

function parseRecipeSection(title, html, defaultCategory, defaultSubcategory) {
  const text = cleanHTML(html).trim();
  if (!text || text.length < 20) return null;

  const recipe = {
    title: title,
    category: defaultCategory,
    subcategory: defaultSubcategory,
    tags: [],
    difficulty: '中等',
    cookingTime: 30,
    servings: '2-3人份',
    ingredients: [],
    steps: [],
    tips: [],
  };

  // 尝试从内容中提取分类信息
  extractCategoryFromText(recipe, text);

  // 解析食材清单
  const ingredientsSection = extractSection(text, ['一、食材', '食材清单', '一、 食材', '食材']);
  if (ingredientsSection) {
    recipe.ingredients = parseIngredients(ingredientsSection);
    if (recipe.ingredients.length > 0) {
      recipe.servings = extractServings(ingredientsSection) || recipe.servings;
    }
  }

  // 解析步骤
  const stepsSection = extractSection(text, ['二、详细步骤', '详细步骤', '二、 步骤', '制作步骤', '步骤']);
  if (stepsSection) {
    recipe.steps = parseSteps(stepsSection);
    // 从步骤中估算烹饪时间
    recipe.cookingTime = estimateCookingTime(stepsSection) || recipe.cookingTime;
  }

  // 解析技巧/关键点
  const tipsSection = extractSection(text, [
    '三、成功关键', '成功关键', '关键', '技巧', 'Tips', 'tips',
    '三、 关键', '三、风味', '风味解析', '烹饪技巧', '小贴士', '温馨提示',
  ]);
  if (tipsSection) {
    recipe.tips = parseTips(tipsSection);
  }

  // 提取标签
  recipe.tags = extractTags(recipe);

  // 估算难度
  recipe.difficulty = estimateDifficulty(recipe);

  return recipe;
}

// ==================== 文本解析工具 ====================

function cleanHTML(html) {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function extractSection(text, keywords) {
  for (const kw of keywords) {
    const idx = text.indexOf(kw);
    if (idx !== -1) {
      return text.slice(idx);
    }
  }
  return null;
}

function parseIngredients(text) {
  const ingredients = [];
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

  // 跳过第一行（标题行）
  const startIdx = lines.findIndex(l =>
    /一[、.]/.test(l) || /食材清单/.test(l) || /食材/.test(l)
  );

  for (let i = startIdx + 1; i < lines.length; i++) {
    const line = lines[i];

    // 遇到下一个大标题就停止
    if (/^二[、.]|^[一二三四五六七八九十]/.test(line) && !/^[-\d]/.test(line)) break;

    // 尝试多种格式匹配
    // 格式1: - 食材名：用量（备注）
    // 格式2: 食材名 用量
    // 格式3: 食材名：用量

    let ing = parseIngredientLine(line);
    if (ing) {
      ingredients.push(ing);
    }
  }

  return ingredients;
}

function parseIngredientLine(line) {
  // 清理前缀符号
  const cleaned = line.replace(/^[-\s•◦▪▸►●○◆◇]*\s*/, '').trim();
  if (!cleaned || cleaned.length < 2) return null;

  // 跳过非食材行
  if (/^[（(]?\d+[）).]/.test(cleaned) && cleaned.length < 6) return null;
  if (/^人份/.test(cleaned)) return null;

  // 格式: 食材名：用量（备注）
  const colonMatch = cleaned.match(/^(.+?)[：:]\s*(.+)$/);
  if (colonMatch) {
    const name = colonMatch[1].trim();
    let amount = colonMatch[2].trim();
    let note = '';

    // 提取括号中的备注
    const noteMatch = amount.match(/^(.+?)[（(](.+?)[）)]$/);
    if (noteMatch) {
      amount = noteMatch[1].trim();
      note = noteMatch[2].trim();
    }

    return { name, amount, note };
  }

  // 格式: 食材名 用量
  const parts = cleaned.split(/\s+/);
  if (parts.length >= 2) {
    const name = parts[0];
    const amount = parts.slice(1).join(' ');
    if (name.length <= 10 && !/^\d/.test(name)) {
      return { name, amount, note: '' };
    }
  }

  return null;
}

function extractServings(text) {
  const match = text.match(/(\d+[-~]\d+)\s*人份/);
  return match ? match[0] : null;
}

function parseSteps(text) {
  const steps = [];
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

  let currentPhase = null;
  let currentItems = [];
  let inSteps = false;

  for (const line of lines) {
    // 检测步骤开始
    if (/二[、.]/.test(line) || /详细步骤/.test(line) || /步骤/.test(line)) {
      inSteps = true;
      // 如果当前有未保存的阶段，先保存
      if (currentPhase && currentItems.length > 0) {
        steps.push({ phase: currentPhase, items: [...currentItems] });
      }
      currentPhase = null;
      currentItems = [];
      continue;
    }

    if (!inSteps) continue;

    // 遇到下一个大标题就停止
    if (/^三[、.]|^四[、.]|^[三四五六七八九十]/.test(line) && !/^[-\d]/.test(line)) {
      break;
    }

    // 检测阶段标题
    const phaseMatch = line.match(/^第[一二三四五六七八九十\d]+部分[：:]\s*(.+)/);
    const phaseMatch2 = line.match(/^第[一二三四五六七八九十\d]+[步阶段]?[：:]\s*(.+)/);
    if (phaseMatch || phaseMatch2) {
      if (currentPhase && currentItems.length > 0) {
        steps.push({ phase: currentPhase, items: [...currentItems] });
      }
      currentPhase = (phaseMatch || phaseMatch2)[1].trim();
      currentItems = [];
      continue;
    }

    // 检测是否是步骤行
    const stepContent = cleanStepLine(line);
    if (stepContent && stepContent.length > 5) {
      if (!currentPhase) {
        currentPhase = '制作步骤';
      }
      currentItems.push(stepContent);
    }
  }

  // 保存最后一组
  if (currentPhase && currentItems.length > 0) {
    steps.push({ phase: currentPhase, items: currentItems });
  }

  return steps;
}

function cleanStepLine(line) {
  // 去掉编号前缀
  let cleaned = line.replace(/^[\d]+[.、）)\s]+/, '').trim();
  cleaned = cleaned.replace(/^[-\s•◦▪▸►●○◆◇]*\s*/, '').trim();
  return cleaned;
}

function parseTips(text) {
  const tips = [];
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

  // 跳过标题行
  let start = false;
  for (const line of lines) {
    if (!start) {
      if (/三[、.]/.test(line) || /成功关键/.test(line) || /关键/.test(line) ||
          /风味解析/.test(line) || /技巧/.test(line) || /Tips/i.test(line)) {
        start = true;
      }
      continue;
    }

    // 遇到下一个大标题就停止
    if (/^四[、.]/.test(line)) break;

    // 清理行内容
    const cleaned = line.replace(/^[-\s•◦▪▸►●○◆◇]*\s*/, '').trim();
    if (cleaned.length > 5 && !/^[（(]?\d+[）).]/.test(cleaned)) {
      tips.push(cleaned);
    }
  }

  return tips;
}

function extractTags(recipe) {
  const tags = new Set();

  // 分类标签
  if (recipe.category) tags.add(recipe.category);
  if (recipe.subcategory) tags.add(recipe.subcategory);

  // 食材关键词
  const ingredientKeywords = {
    '猪肉': ['猪肉', '五花肉', '排骨', '肉末', '猪'],
    '鸡肉': ['鸡肉', '鸡胸', '鸡腿', '鸡'],
    '牛肉': ['牛肉', '牛腱', '牛腩', '牛'],
    '鱼': ['鱼', '鲈鱼', '草鱼', '鲤鱼', '带鱼'],
    '虾': ['虾', '虾仁'],
    '鸡蛋': ['鸡蛋', '蛋'],
    '豆腐': ['豆腐', '豆花'],
    '土豆': ['土豆', '马铃薯'],
    '番茄': ['番茄', '西红柿'],
    '面': ['面', '面条', '面食'],
    '米饭': ['米饭', '米', '饭'],
  };

  const allIngredientText = recipe.ingredients.map(i => i.name).join(' ');
  Object.entries(ingredientKeywords).forEach(([tag, keywords]) => {
    if (keywords.some(kw => allIngredientText.includes(kw))) {
      tags.add(tag);
    }
  });

  // 烹饪方式标签
  const methodKeywords = {
    '红烧': ['红烧', '卤'],
    '清蒸': ['清蒸', '蒸'],
    '爆炒': ['爆炒', '快炒', '炒'],
    '炖煮': ['炖', '煮', '慢炖'],
    '油炸': ['炸', '煎炸'],
    '凉拌': ['凉拌', '拌'],
  };

  const allText = JSON.stringify(recipe).toLowerCase();
  Object.entries(methodKeywords).forEach(([tag, keywords]) => {
    if (keywords.some(kw => allText.includes(kw.toLowerCase()))) {
      tags.add(tag);
    }
  });

  // 口味标签
  const tasteKeywords = {
    '麻辣': ['麻辣', '花椒', '辣椒'],
    '酸甜': ['酸甜', '糖醋', '番茄'],
    '咸鲜': ['酱', '豉油', '生抽'],
    '清淡': ['清淡', '清蒸', '白灼'],
  };

  Object.entries(tasteKeywords).forEach(([tag, keywords]) => {
    if (keywords.some(kw => allText.includes(kw.toLowerCase()))) {
      tags.add(tag);
    }
  });

  return Array.from(tags).slice(0, 8);
}

function estimateCookingTime(text) {
  // 从文本中提取时间
  const match = text.match(/(\d+)[-~](\d+)\s*(分钟|小时|min)/);
  if (match) {
    const unit = match[3];
    const max = parseInt(match[2]);
    return unit === '小时' ? max * 60 : max;
  }

  const match2 = text.match(/(\d+)\s*(分钟|小时|min)/);
  if (match2) {
    const unit = match2[2];
    const val = parseInt(match2[1]);
    return unit === '小时' ? val * 60 : val;
  }

  return 30;
}

function estimateDifficulty(recipe) {
  const ingredientCount = recipe.ingredients.length;
  const stepCount = recipe.steps.reduce((sum, s) => sum + s.items.length, 0);

  if (ingredientCount <= 5 && stepCount <= 4) return '简单';
  if (ingredientCount <= 10 && stepCount <= 8) return '中等';
  return '中等';
}

function extractCategoryFromText(recipe, text) {
  // 仅根据标题中的关键词来推断，避免全文匹配误判
  const title = recipe.title;

  const subcatMap = {
    '猪肉': ['猪肉', '排骨', '五花肉', '肉末', '红烧肉', '卤肉', '回锅肉', '肘子'],
    '鸡肉': ['鸡', '宫保', '鸡丁', '鸡腿', '鸡翅', '鸡胸'],
    '海鲜': ['鱼', '虾', '蟹', '贝', '海鲜', '鲈鱼', '草鱼', '带鱼', '鱿鱼'],
    '牛肉': ['牛肉', '牛排', '牛腩', '牛腱'],
    '豆腐': ['豆腐', '豆花', '豆制品', '麻婆'],
    '蛋类': ['蛋', '鸡蛋', '炒蛋', '蒸蛋'],
    '素菜': ['素', '土豆丝', '青菜', '白菜', '茄子', '豆角', '西兰花'],
    '面食': ['面', '面条', '饺子', '饼', '包子', '馒头', '馄饨'],
    '米饭': ['米饭', '炒饭', '盖饭', '粥', '卤肉饭'],
  };

  // 根据标题推断子分类
  for (const [subcat, keywords] of Object.entries(subcatMap)) {
    if (keywords.some(kw => title.includes(kw))) {
      recipe.subcategory = subcat;
      // 根据子分类推导父分类
      if (['面食', '米饭'].includes(subcat)) {
        recipe.category = '主食';
      } else {
        recipe.category = '家常菜';
      }
      return;
    }
  }
}

// ==================== 运行 ====================
main();