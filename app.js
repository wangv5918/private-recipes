// ==================== DATA LOADING ====================
let recipes = [];
let fuse = null;

// Build category tree from data
let categoryTree = []; // [{ id, name, children: [{ id, name, count }], count }]
let categoryMap = {};  // subcategory -> { parent, name }

async function loadRecipes() {
  try {
    const res = await fetch('recipes_full.json');
    recipes = await res.json();
    buildCategoryTree();
    renderSidebar();
    renderFilterTags();
    renderResults();
  } catch (err) {
    console.error('加载失败:', err);
    document.getElementById('resultsArea').innerHTML = `
      <div class="no-results"><div class="no-icon">📖</div><h3>菜谱加载失败</h3><p>请确保 recipes_full.json 文件存在</p></div>`;
  }
}

function buildCategoryTree() {
  const tree = {};
  recipes.forEach(r => {
    const parent = r.category || '其他';
    const child = r.subcategory || '未分类';
    if (!tree[parent]) tree[parent] = {};
    if (!tree[parent][child]) tree[parent][child] = 0;
    tree[parent][child]++;
  });

  categoryTree = Object.entries(tree).map(([parent, children]) => ({
    id: parent,
    name: parent,
    children: Object.entries(children).map(([child, count]) => ({
      id: child,
      name: child,
      count,
    })),
    count: Object.values(children).reduce((a, b) => a + b, 0),
  }));

  categoryMap = {};
  categoryTree.forEach(cat => {
    cat.children.forEach(ch => {
      categoryMap[ch.id] = { parent: cat.id, name: ch.name };
    });
  });
}

function initFuse() {
  fuse = new Fuse(recipes, {
    keys: [
      { name: 'title', weight: 4 },
      { name: 'tags', weight: 2 },
      { name: 'ingredients.name', weight: 2 },
      { name: 'subcategory', weight: 1 },
      { name: 'category', weight: 1 },
    ],
    threshold: 0.35,
    distance: 100,
    includeScore: true,
    minMatchCharLength: 1,
  });
}

// ==================== STATE ====================
let state = {
  searchKeyword: '',
  activeCategory: 'all',        // child category id or 'all'
  activeParentCategory: 'all',  // parent category id
  activeChildCategory: null,
  openCategories: new Set(categoryTree.map(c => c.id)), // all open by default
};

// ==================== SIDEBAR ====================
function renderSidebar() {
  const nav = document.getElementById('sidebarNav');
  let html = `
    <div class="tree-group">
      <div class="tree-parent${state.activeParentCategory === 'all' && !state.activeChildCategory ? ' active' : ''}"
           data-category="all" data-type="parent">
        <span style="font-size:16px;width:18px;text-align:center;">📋</span>
        <span>全部菜谱</span>
        <span class="count">${recipes.length}</span>
      </div>
    </div>`;

  categoryTree.forEach(cat => {
    const isOpen = state.openCategories.has(cat.id);
    const isActive = state.activeParentCategory === cat.id;

    html += `
      <div class="tree-group">
        <div class="tree-parent${isOpen ? ' open' : ''}${isActive ? ' active' : ''}"
             data-category="${cat.id}" data-type="parent">
          <span class="arrow">▶</span>
          <span style="font-size:15px;">${cat.name === '家常菜' ? '🍲' : cat.name === '主食' ? '🍚' : '📖'}</span>
          <span>${cat.name}</span>
          <span class="count">${cat.count}</span>
        </div>
        <div class="tree-children${isOpen ? ' open' : ''}">
          ${cat.children.map(child => {
            const isChildActive = state.activeChildCategory === child.id;
            return `
              <div class="tree-child${isChildActive ? ' active' : ''}"
                   data-category="${child.id}" data-parent="${cat.id}" data-type="child">
                <span class="dot"></span>
                <span>${child.name}</span>
                <span class="count" style="margin-left:auto">${child.count}</span>
              </div>`;
          }).join('')}
        </div>
      </div>`;
  });

  nav.innerHTML = html;
  bindSidebarEvents();
}

function bindSidebarEvents() {
  document.querySelectorAll('.tree-parent').forEach(el => {
    el.addEventListener('click', function() {
      const catId = this.dataset.category;
      if (catId === 'all') {
        state.openCategories = new Set(state.openCategories);
      } else if (state.openCategories.has(catId)) {
        state.openCategories.delete(catId);
      } else {
        state.openCategories.add(catId);
      }
      state.activeParentCategory = catId === 'all' ? 'all' : catId;
      state.activeChildCategory = null;
      state.activeCategory = 'all';
      updateFilterTags();
      renderSidebar();
      renderResults();
    });
  });

  document.querySelectorAll('.tree-child').forEach(el => {
    el.addEventListener('click', function(e) {
      e.stopPropagation();
      state.activeChildCategory = this.dataset.category;
      state.activeParentCategory = this.dataset.parent;
      state.activeCategory = this.dataset.category;
      updateFilterTags();
      renderSidebar();
      renderResults();
    });
  });
}

// ==================== FILTER TAGS ====================
function renderFilterTags() {
  const container = document.getElementById('filterTags');
  let html = `<button class="filter-tag${state.activeCategory === 'all' ? ' active' : ''}" data-category="all">全部</button>`;

  categoryTree.forEach(cat => {
    cat.children.forEach(child => {
      html += `<button class="filter-tag${state.activeCategory === child.id ? ' active' : ''}" data-category="${child.id}">${child.name} (${child.count})</button>`;
    });
  });

  container.innerHTML = html;
  bindFilterTagEvents();
}

function updateFilterTags() {
  document.querySelectorAll('.filter-tag').forEach(tag => {
    tag.classList.toggle('active', tag.dataset.category === state.activeCategory);
  });
}

function bindFilterTagEvents() {
  document.querySelectorAll('.filter-tag').forEach(tag => {
    tag.addEventListener('click', function() {
      const catId = this.dataset.category;
      state.activeCategory = catId;
      if (catId === 'all') {
        state.activeParentCategory = 'all';
        state.activeChildCategory = null;
      } else {
        state.activeParentCategory = categoryMap[catId]?.parent || 'all';
        state.activeChildCategory = catId;
      }
      updateFilterTags();
      renderSidebar();
      renderResults();
    });
  });
}

// ==================== FILTER ====================
async function ensureFuseLoaded() {
  if (typeof Fuse === 'undefined') {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/fuse.js@7.0.0';
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Fuse.js 加载失败'));
      document.head.appendChild(script);
    });
  }
  return Promise.resolve();
}

function initFuse() {
  fuse = new Fuse(recipes, {
    keys: [
      { name: 'title', weight: 4 },
      { name: 'tags', weight: 2 },
      { name: 'ingredients.name', weight: 2 },
      { name: 'subcategory', weight: 1 },
      { name: 'category', weight: 1 },
    ],
    threshold: 0.35,
    distance: 100,
    includeScore: true,
    minMatchCharLength: 1,
  });
}

function getFilteredRecipes() {
  let filtered = recipes;

  if (state.searchKeyword.trim() && fuse) {
    const results = fuse.search(state.searchKeyword.trim());
    filtered = results.map(r => r.item);
  }

  if (state.activeCategory !== 'all') {
    filtered = filtered.filter(r => r.subcategory === state.activeCategory);
  }

  return filtered;
}

// ==================== HIGHLIGHT ====================
function highlightText(text, keyword) {
  if (!keyword.trim()) return text;
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return text.replace(new RegExp(`(${escaped})`, 'gi'), '<span class="highlight">$1</span>');
}

// ==================== RENDER RESULTS ====================
function renderResults() {
  const container = document.getElementById('resultsArea');
  const filtered = getFilteredRecipes();

  document.getElementById('totalCount').textContent = recipes.length;
  document.getElementById('filteredCount').textContent = filtered.length;

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="no-results">
        <div class="no-icon">🍽️</div>
        <h3>没找到相关菜谱</h3>
        <p>试试换个关键词或调整筛选条件</p>
      </div>`;
    return;
  }

  let html = `
    <div class="results-header">
      <h2>${state.searchKeyword ? `搜索「${state.searchKeyword}」的结果` : '全部菜谱'}</h2>
    </div>
    <div class="cards-grid">`;

  filtered.forEach((r, i) => {
    const diffClass = r.difficulty === '简单' ? 'diff-easy' : r.difficulty === '中等' ? 'diff-medium' : 'diff-hard';
    const diffEmoji = r.difficulty === '简单' ? '🟢' : r.difficulty === '中等' ? '🟠' : '🔴';
    const hasIng = r.ingredients && r.ingredients.length > 0;

    html += `
      <div class="recipe-card" data-id="${r.id}" style="animation-delay:${i * 0.02}s">
        <div class="card-title">${highlightText(r.title, state.searchKeyword)}</div>
        <div class="card-meta-row">
          <span class="card-meta ${diffClass}">${diffEmoji} ${r.difficulty || '中等'}</span>
          <span class="card-meta">⏱ ${r.cookingTime || '?'}分钟</span>
          <span class="card-meta">👥 ${r.servings || '2-3人份'}</span>
          ${hasIng ? `<span class="card-meta"><span class="ing-count">${r.ingredients.length}</span> 种食材</span>` : ''}
        </div>
        <div class="card-tags">
          ${(r.tags || []).slice(0, 6).map(t => `<span class="card-tag">${highlightText(t, state.searchKeyword)}</span>`).join('')}
        </div>
        ${!hasIng ? '<div class="card-no-ing">⚠ 食材表为图片，暂无文本数据</div>' : ''}
      </div>`;
  });

  html += '</div>';
  container.innerHTML = html;

  container.querySelectorAll('.recipe-card').forEach(card => {
    card.addEventListener('click', () => {
      const id = parseInt(card.dataset.id);
      const recipe = recipes.find(r => r.id === id);
      if (recipe) showModal(recipe);
    });
  });
}

// ==================== MODAL ====================
function showModal(recipe) {
  const hasIng = recipe.ingredients && recipe.ingredients.length > 0;
  const hasNutrition = recipe.nutrition && recipe.nutrition.length > 0;
  const hasExtra = recipe.extra && recipe.extra.length > 0;
  const diffEmoji = recipe.difficulty === '简单' ? '🟢' : recipe.difficulty === '中等' ? '🟠' : '🔴';

  let html = `
    <button class="modal-close" id="modalClose">✕</button>
    <div class="modal-inner">
      <h2 class="modal-title">${recipe.title}</h2>
      <div class="modal-meta">
        <span>${diffEmoji} ${recipe.difficulty || '中等'}</span>
        <span>⏱ ${recipe.cookingTime || '?'} 分钟</span>
        <span>👥 ${recipe.servings || '2-3人份'}</span>
        <span>📂 ${recipe.category} / ${recipe.subcategory}</span>
        ${hasIng ? `<span>🛒 ${recipe.ingredients.length} 种食材</span>` : ''}
      </div>`;

  // 食材清单
  if (hasIng) {
    html += `
      <div class="modal-section">
        <h3><span class="section-icon">🛒</span> 食材清单</h3>
        <div class="ingredients-grid">
          ${recipe.ingredients.map(ing => `
            <div class="ingredient-item">
              <span class="ing-name">${ing.name}</span>
              <span class="ing-amount">${ing.amount}</span>
              ${ing.note ? `<span class="ing-note">${ing.note}</span>` : ''}
            </div>
          `).join('')}
        </div>
      </div>`;
  } else {
    html += `
      <div class="modal-section">
        <h3><span class="section-icon">🛒</span> 食材清单</h3>
        <p style="color:var(--text-muted);font-style:italic;">⚠ 食材表在飞书文档中为图片格式，无法自动提取文本。请参考原始文档。</p>
      </div>`;
  }

  // 详细步骤
  if (recipe.steps && recipe.steps.length > 0) {
    html += `
      <div class="modal-section">
        <h3><span class="section-icon">📝</span> 详细步骤</h3>
        ${recipe.steps.map(step => `
          <div class="step-phase">
            <h4>${step.phase}</h4>
            <ol class="step-list">
              ${step.items.map(item => `<li>${item}</li>`).join('')}
            </ol>
          </div>
        `).join('')}
      </div>`;
  }

  // 烹饪技巧
  if (recipe.tips && recipe.tips.length > 0) {
    html += `
      <div class="modal-section">
        <h3><span class="section-icon">💡</span> 烹饪技巧</h3>
        <ul class="tips-list">
          ${recipe.tips.map(tip => `<li>${tip}</li>`).join('')}
        </ul>
      </div>`;
  }

  // 营养分析
  if (hasNutrition) {
    html += `
      <div class="modal-section">
        <h3><span class="section-icon">🔬</span> 营养分析</h3>
        <ul class="nutrition-list">
          ${recipe.nutrition.map(n => `<li>${n}</li>`).join('')}
        </ul>
      </div>`;
  }

  // 额外表格
  if (hasExtra) {
    html += `
      <div class="modal-section">
        <h3><span class="section-icon">📊</span> 补充信息</h3>
        ${recipe.extra.map(ext => {
          if (ext.type === 'table') {
            return `
              <div class="extra-table-wrap">
                <table>
                  ${ext.rows.map((row, ri) => `
                    <tr>${row.map(cell => ri === 0 ? `<th>${cell}</th>` : `<td>${cell}</td>`).join('')}</tr>
                  `).join('')}
                </table>
              </div>`;
          }
          return '';
        }).join('')}
      </div>`;
  }

  // 标签
  if (recipe.tags && recipe.tags.length > 0) {
    html += `
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:16px;">
        ${recipe.tags.map(t => `<span class="card-tag">${t}</span>`).join('')}
      </div>`;
  }

  html += '</div>';

  const modal = document.getElementById('modalContent');
  modal.innerHTML = html;
  document.getElementById('modalOverlay').classList.add('show');
  document.body.style.overflow = 'hidden';
  modal.scrollTop = 0;

  document.getElementById('modalClose').addEventListener('click', closeModal);
}

function closeModal() {
  document.getElementById('modalOverlay').classList.remove('show');
  document.body.style.overflow = '';
}

// ==================== EVENTS ====================
document.getElementById('modalOverlay').addEventListener('click', function(e) {
  if (e.target === this) closeModal();
});
document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') closeModal();
});

const searchInput = document.getElementById('searchInput');
const searchClear = document.getElementById('searchClear');

searchInput.addEventListener('input', async function() {
  state.searchKeyword = this.value;
  searchClear.classList.toggle('visible', this.value.length > 0);
  if (state.searchKeyword.trim() && !fuse) {
    try {
      await ensureFuseLoaded();
      initFuse();
    } catch (err) {
      console.error('Fuse.js 加载失败:', err);
    }
  }
  renderResults();
});
searchClear.addEventListener('click', function() {
  searchInput.value = '';
  state.searchKeyword = '';
  searchClear.classList.remove('visible');
  searchInput.focus();
  renderResults();
});

document.getElementById('menuToggle').addEventListener('click', function() {
  document.getElementById('sidebar').classList.toggle('open');
});
document.addEventListener('click', function(e) {
  const sidebar = document.getElementById('sidebar');
  const toggle = document.getElementById('menuToggle');
  if (window.innerWidth <= 768 && !sidebar.contains(e.target) && !toggle.contains(e.target)) {
    sidebar.classList.remove('open');
  }
});

// ==================== WHEEL (今日菜谱轮盘抽奖) ====================
// 后续优化方向:
// 1. 历史记录 - 记录每次抽奖结果，避免短期内重复
// 2. 营养搭配 - 根据营养数据自动推荐均衡搭配
// 3. 季节推荐 - 根据季节推荐时令菜谱
// 4. 食材库存 - 结合冰箱食材，只从有食材的菜谱中抽取
// 5. 多人抽奖 - 支持多人同时抽奖，各自独立结果
// 6. 难度偏好 - 可设置偏好难度（简单/中等/困难）
// 7. 时间偏好 - 可设置烹饪时间范围
// 8. 语音播报 - 抽奖结果语音播报
// 9. 分享功能 - 分享抽奖结果到社交媒体
// 10. 数据统计 - 统计哪道菜被抽中最多次

const wheelState = {
  mode: 'tag',           // 'tag' | 'custom'
  activeTag: null,       // current selected tag
  items: [],             // wheel items: [{label, recipe}]
  isSpinning: false,
  currentAngle: 0,
  spinVelocity: 0,
  animationId: null,
  resultItem: null,      // the winning item
};

// Color palette for wheel segments
const WHEEL_COLORS = [
  '#e07b39', '#5a9e6f', '#d44a4a', '#4a90d9', '#f0a050',
  '#7b68ee', '#3cb371', '#ff6347', '#4682b4', '#daa520',
  '#e85d75', '#20b2aa', '#9370db', '#cd853f', '#6495ed',
  '#dc143c', '#2e8b57', '#8b4513', '#4169e1', '#b8860b',
];

// DOM refs
const wheelOverlay = document.getElementById('wheelOverlay');
const wheelCanvasArea = document.getElementById('wheelCanvasArea');
const wheelEmpty = document.getElementById('wheelEmpty');
const wheelResult = document.getElementById('wheelResult');
const wheelResultName = document.getElementById('wheelResultName');
const wheelSpinBtn = document.getElementById('wheelSpinBtn');
const wheelTagArea = document.getElementById('wheelTagArea');
const wheelCustomArea = document.getElementById('wheelCustomArea');
const wheelCustomInput = document.getElementById('wheelCustomInput');
let wheelCanvas = null;
let wheelCtx = null;

// ==================== WHEEL MODAL ====================
function openWheel() {
  wheelOverlay.classList.add('show');
  document.body.style.overflow = 'hidden';
  renderWheelTags();
  if (wheelState.mode === 'tag') {
    wheelTagArea.style.display = 'flex';
    wheelCustomArea.classList.remove('show');
    if (wheelState.activeTag && wheelState.items.length > 0) {
      initWheelCanvas();
      drawWheel();
    }
  } else {
    wheelTagArea.style.display = 'none';
    wheelCustomArea.classList.add('show');
    if (wheelState.items.length > 0) {
      initWheelCanvas();
      drawWheel();
    }
  }
}

function closeWheel() {
  wheelOverlay.classList.remove('show');
  document.body.style.overflow = '';
  if (wheelState.animationId) {
    cancelAnimationFrame(wheelState.animationId);
    wheelState.animationId = null;
    wheelState.isSpinning = false;
  }
}

// ==================== TAG RENDERING ====================
function renderWheelTags() {
  // Collect subcategories from recipes
  const tagCounts = {};
  recipes.forEach(r => {
    const sc = r.subcategory || '其他';
    tagCounts[sc] = (tagCounts[sc] || 0) + 1;
  });

  let html = '';
  Object.entries(tagCounts).sort((a, b) => b[1] - a[1]).forEach(([tag, count]) => {
    const active = wheelState.activeTag === tag ? ' active' : '';
    html += `<button class="wheel-tag-chip${active}" data-tag="${tag}">${tag}<span class="tag-cnt">${count}</span></button>`;
  });

  wheelTagArea.innerHTML = html;

  wheelTagArea.querySelectorAll('.wheel-tag-chip').forEach(chip => {
    chip.addEventListener('click', function() {
      const tag = this.dataset.tag;
      wheelState.activeTag = tag;
      renderWheelTags();
      generateTagWheel(tag);
    });
  });
}

// ==================== GENERATE WHEEL ITEMS ====================
function generateTagWheel(tag) {
  // Filter recipes by tag (subcategory)
  let filtered = recipes.filter(r => r.subcategory === tag);
  if (filtered.length === 0) {
    wheelState.items = [];
    showWheelEmpty('该标签下暂无菜谱');
    return;
  }

  // Shuffle and pick up to 10
  const shuffled = [...filtered].sort(() => Math.random() - 0.5);
  const picked = shuffled.slice(0, Math.min(10, shuffled.length));

  wheelState.items = picked.map(r => ({
    label: r.title,
    recipe: r,
  }));

  wheelState.resultItem = null;
  wheelResult.classList.remove('show');
  wheelSpinBtn.disabled = false;
  wheelSpinBtn.textContent = '🎲 开始抽奖';

  initWheelCanvas();
  drawWheel();
}

function generateCustomWheel() {
  const text = wheelCustomInput.value.trim();
  if (!text) {
    alert('请输入自定义选项');
    return;
  }

  const lines = text.split(/[\n,，、]+/).map(s => s.trim()).filter(Boolean);
  if (lines.length < 2) {
    alert('至少需要 2 个选项');
    return;
  }
  if (lines.length > 20) {
    alert('最多支持 20 个选项');
    return;
  }

  wheelState.items = lines.map(label => ({
    label,
    recipe: null,
  }));

  wheelState.resultItem = null;
  wheelResult.classList.remove('show');
  wheelSpinBtn.disabled = false;
  wheelSpinBtn.textContent = '🎲 开始抽奖';

  initWheelCanvas();
  drawWheel();
}

// ==================== CANVAS ====================
function initWheelCanvas() {
  // Remove existing canvas
  const existing = wheelCanvasArea.querySelector('.wheel-canvas-wrap');
  if (existing) existing.remove();
  wheelEmpty.style.display = 'none';

  const wrap = document.createElement('div');
  wrap.className = 'wheel-canvas-wrap';

  const pointer = document.createElement('div');
  pointer.className = 'wheel-pointer';
  wrap.appendChild(pointer);

  const canvas = document.createElement('canvas');
  canvas.className = 'wheel-canvas';
  canvas.width = 640;
  canvas.height = 640;
  wrap.appendChild(canvas);

  wheelCanvasArea.appendChild(wrap);
  wheelCanvas = canvas;
  wheelCtx = canvas.getContext('2d');
}

function showWheelEmpty(msg) {
  const existing = wheelCanvasArea.querySelector('.wheel-canvas-wrap');
  if (existing) existing.remove();
  wheelEmpty.style.display = 'block';
  wheelEmpty.querySelector('p').textContent = msg || '请先选择一个标签来生成转盘';
  wheelSpinBtn.disabled = true;
  wheelResult.classList.remove('show');
}

function drawWheel() {
  if (!wheelCtx || wheelState.items.length === 0) return;

  const ctx = wheelCtx;
  const size = 640;
  const cx = size / 2;
  const cy = size / 2;
  const radius = 290;
  const n = wheelState.items.length;
  const arcSize = (2 * Math.PI) / n;

  ctx.clearRect(0, 0, size, size);

  // Draw segments
  wheelState.items.forEach((item, i) => {
    const startAngle = wheelState.currentAngle + i * arcSize;
    const endAngle = startAngle + arcSize;

    // Segment fill
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, radius, startAngle, endAngle);
    ctx.closePath();
    ctx.fillStyle = WHEEL_COLORS[i % WHEEL_COLORS.length];
    ctx.fill();

    // Segment border
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Text — 确保文字始终可读：下半部分翻转180度
    ctx.save();
    ctx.translate(cx, cy);
    const midAngle = startAngle + arcSize / 2;
    // 判断文字是否在转盘下半部（角度在90°~270°之间），是则翻转
    const normalizedMid = ((midAngle % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
    const isUpsideDown = normalizedMid > Math.PI / 2 && normalizedMid < 3 * Math.PI / 2;

    if (isUpsideDown) {
      ctx.rotate(midAngle + Math.PI);
      ctx.textAlign = 'left';
    } else {
      ctx.rotate(midAngle);
      ctx.textAlign = 'right';
    }
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 22px "Noto Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif';
    ctx.shadowColor = 'rgba(0,0,0,0.3)';
    ctx.shadowBlur = 4;

    // Truncate long labels
    let label = item.label;
    if (label.length > 8) label = label.substring(0, 7) + '…';

    const textX = isUpsideDown ? -(radius - 20) : radius - 20;
    ctx.fillText(label, textX, 8);
    ctx.restore();
  });

  // Center circle
  const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, 60);
  gradient.addColorStop(0, '#fff');
  gradient.addColorStop(1, '#f5f0e8');
  ctx.beginPath();
  ctx.arc(cx, cy, 55, 0, 2 * Math.PI);
  ctx.fillStyle = gradient;
  ctx.fill();
  ctx.strokeStyle = '#e8ddd0';
  ctx.lineWidth = 3;
  ctx.stroke();

  // Center text
  ctx.fillStyle = '#e07b39';
  ctx.font = 'bold 20px "Noto Sans SC", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('GO', cx, cy);
}

// ==================== SPINNING ====================
function spinWheel() {
  if (wheelState.isSpinning || wheelState.items.length === 0) return;

  wheelState.isSpinning = true;
  wheelSpinBtn.disabled = true;
  wheelSpinBtn.textContent = '🎰 抽奖中...';
  wheelResult.classList.remove('show');
  wheelState.resultItem = null;

  // Calculate random target
  const n = wheelState.items.length;
  const arcSize = (2 * Math.PI) / n;
  const randomIndex = Math.floor(Math.random() * n);

  // Target angle: so that the pointer (at top, angle = -PI/2) points to the winning segment
  // The pointer is at the top (angle = -PI/2 = 3*PI/2)
  // We want segment[randomIndex] to be at the pointer position
  // Segment center angle = currentAngle + randomIndex * arcSize + arcSize / 2
  // We need: currentAngle + randomIndex * arcSize + arcSize / 2 ≡ -PI/2 (mod 2*PI)
  // Target currentAngle = -PI/2 - randomIndex * arcSize - arcSize / 2
  const targetSegmentCenter = -Math.PI / 2;
  let targetAngle = targetSegmentCenter - randomIndex * arcSize - arcSize / 2;

  // Add random offset within the segment for variety
  const offsetRange = arcSize * 0.6;
  targetAngle += (Math.random() - 0.5) * offsetRange;

  // Add multiple full rotations for dramatic effect
  const extraSpins = (5 + Math.floor(Math.random() * 5)) * 2 * Math.PI;
  const finalTargetAngle = wheelState.currentAngle + extraSpins + targetAngle - (wheelState.currentAngle % (2 * Math.PI));

  // Calculate the actual target (normalized)
  const normalizedTarget = ((finalTargetAngle % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);

  const startAngle = wheelState.currentAngle;
  const totalRotation = finalTargetAngle - startAngle;
  const duration = 4000 + Math.random() * 1000; // 4-5 seconds
  const startTime = performance.now();

  // Easing function: cubic ease-out
  function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  function animate(now) {
    const elapsed = now - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const easedProgress = easeOutCubic(progress);

    wheelState.currentAngle = startAngle + totalRotation * easedProgress;
    drawWheel();

    if (progress < 1) {
      wheelState.animationId = requestAnimationFrame(animate);
    } else {
      // Animation complete
      wheelState.currentAngle = finalTargetAngle;
      wheelState.isSpinning = false;
      wheelState.animationId = null;
      wheelSpinBtn.disabled = false;
      wheelSpinBtn.textContent = '🔄 再来一次';

      // Determine winner
      getWheelResult();
      showWheelResult();
    }
  }

  wheelState.animationId = requestAnimationFrame(animate);
}

function getWheelResult() {
  const n = wheelState.items.length;
  if (n === 0) return;

  const arcSize = (2 * Math.PI) / n;
  // Pointer is at top (angle = -PI/2 = 3*PI/2)
  const pointerAngle = ((3 * Math.PI / 2) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);

  // Normalize current angle
  const normalizedAngle = ((wheelState.currentAngle % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);

  for (let i = 0; i < n; i++) {
    const segStart = ((normalizedAngle + i * arcSize) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);
    const segEnd = ((segStart + arcSize) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);

    if (segStart <= segEnd) {
      if (pointerAngle >= segStart && pointerAngle < segEnd) {
        wheelState.resultItem = wheelState.items[i];
        return;
      }
    } else {
      // Segment wraps around 0
      if (pointerAngle >= segStart || pointerAngle < segEnd) {
        wheelState.resultItem = wheelState.items[i];
        return;
      }
    }
  }
}

function showWheelResult() {
  if (!wheelState.resultItem) return;
  wheelResultName.textContent = wheelState.resultItem.label;
  wheelResult.classList.add('show');

  // Show/hide "查看菜谱" button based on mode
  const viewBtn = document.getElementById('wheelResultView');
  if (wheelState.resultItem.recipe) {
    viewBtn.style.display = '';
  } else {
    viewBtn.style.display = 'none';
  }
}

// ==================== MODE SWITCHING ====================
function switchWheelMode(mode) {
  wheelState.mode = mode;
  wheelState.items = [];
  wheelState.activeTag = null;
  wheelState.resultItem = null;
  wheelState.currentAngle = 0;
  wheelResult.classList.remove('show');
  wheelSpinBtn.disabled = true;
  wheelSpinBtn.textContent = '🎲 开始抽奖';

  if (mode === 'tag') {
    wheelTagArea.style.display = 'flex';
    wheelCustomArea.classList.remove('show');
    renderWheelTags();
    showWheelEmpty('请先选择一个标签来生成转盘');
  } else {
    wheelTagArea.style.display = 'none';
    wheelCustomArea.classList.add('show');
    wheelCustomInput.value = '';
    showWheelEmpty('请输入自定义选项并点击"生成转盘"');
  }

  // Update tab active states
  document.querySelectorAll('.wheel-mode-tab').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.mode === mode);
  });
}

// ==================== WHEEL EVENTS ====================
document.getElementById('wheelEntryBtn').addEventListener('click', openWheel);
document.getElementById('wheelClose').addEventListener('click', closeWheel);
wheelOverlay.addEventListener('click', function(e) {
  if (e.target === wheelOverlay) closeWheel();
});
document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape' && wheelOverlay.classList.contains('show')) {
    closeWheel();
  }
});

// Mode tabs
document.querySelectorAll('.wheel-mode-tab').forEach(tab => {
  tab.addEventListener('click', function() {
    if (wheelState.isSpinning) return;
    switchWheelMode(this.dataset.mode);
  });
});

// Spin button
wheelSpinBtn.addEventListener('click', function() {
  if (!wheelState.isSpinning) spinWheel();
});

// Retry button
document.getElementById('wheelResultRetry').addEventListener('click', function() {
  if (wheelState.mode === 'tag' && wheelState.activeTag) {
    generateTagWheel(wheelState.activeTag);
  } else if (wheelState.mode === 'custom') {
    // Keep custom items but reshuffle
    wheelState.resultItem = null;
    wheelResult.classList.remove('show');
    wheelSpinBtn.disabled = false;
    wheelSpinBtn.textContent = '🎲 开始抽奖';
    wheelState.currentAngle = 0;
    drawWheel();
  }
});

// View recipe button
document.getElementById('wheelResultView').addEventListener('click', function() {
  if (wheelState.resultItem && wheelState.resultItem.recipe) {
    closeWheel();
    // Small delay to let wheel modal close first
    setTimeout(() => showModal(wheelState.resultItem.recipe), 300);
  }
});

// Custom generate button
document.getElementById('wheelCustomGenBtn').addEventListener('click', generateCustomWheel);

// Custom input: Ctrl+Enter to generate
wheelCustomInput.addEventListener('keydown', function(e) {
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    e.preventDefault();
    generateCustomWheel();
  }
});

// ==================== INIT ====================
loadRecipes();
