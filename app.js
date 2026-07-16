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
    // 为每道菜生成拼音搜索字段
    recipes.forEach(r => {
      try {
        if (typeof pinyinPro !== 'undefined') {
          r._pinyin = pinyinPro.pinyin(r.title, { toneType: 'none', type: 'array' }).join('');
        }
      } catch(e) { r._pinyin = ''; }
    });
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
  const options = {
    keys: [
      { name: 'title', weight: 0.4 },
      { name: '_pinyin', weight: 0.3 },
      { name: 'tags', weight: 0.2 },
      { name: 'ingredients.name', weight: 0.1 },
    ],
    threshold: 0.4,
    distance: 100,
    includeScore: true,
  };
  fuse = new Fuse(recipes, options);
}

// ==================== STATE ====================
let state = {
  searchKeyword: '',
  activeCategory: 'all',        // child category id or 'all'
  activeParentCategory: 'all',  // parent category id
  activeChildCategory: null,
  openCategories: new Set(categoryTree.map(c => c.id)), // all open by default
  showFavsOnly: false,          // 是否只显示收藏
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
  const options = {
    keys: [
      { name: 'title', weight: 0.4 },
      { name: '_pinyin', weight: 0.3 },
      { name: 'tags', weight: 0.2 },
      { name: 'ingredients.name', weight: 0.1 },
    ],
    threshold: 0.4,
    distance: 100,
    includeScore: true,
  };
  fuse = new Fuse(recipes, options);
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
        <div class="card-title-row">
          <span class="card-title">${highlightText(r.title, state.searchKeyword)}</span>
          <button class="fav-btn fav-btn-inline${isFaved(r.id) ? ' faved' : ''}" data-id="${r.id}" title="收藏">${isFaved(r.id) ? '❤️' : '🤍'}</button>
        </div>
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
    card.addEventListener('click', (e) => {
      // 不拦截收藏按钮点击
      if (e.target.closest('.fav-btn')) return;
      const id = parseInt(card.dataset.id);
      const recipe = recipes.find(r => r.id === id);
      if (recipe) showModal(recipe);
    });
  });

  // 收藏按钮点击事件
  container.querySelectorAll('.fav-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = parseInt(btn.dataset.id);
      toggleFav(id);
      updateFavUI();
      renderResults();
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
      <div class="modal-title-row">
        <h2 class="modal-title">${recipe.title}</h2>
        <button class="fav-btn${isFaved(recipe.id) ? ' faved' : ''}" id="modalFavBtn" data-id="${recipe.id}" title="收藏">${isFaved(recipe.id) ? '❤️' : '🤍'}</button>
      </div>
      <div class="modal-meta">
        <span>${diffEmoji} ${recipe.difficulty || '中等'}</span>
        <span>⏱ ${recipe.cookingTime || '?'} 分钟</span>
        <span>👥 ${recipe.servings || '2-3人份'}</span>
        <span>📂 ${recipe.category} / ${recipe.subcategory}</span>
        ${hasIng ? `<span>🛒 ${recipe.ingredients.length} 种食材</span>` : ''}
      </div>
      <div class="modal-actions">
        ${hasIng ? `<button class="add-shopping-btn" id="modalShoppingBtn" data-id="${recipe.id}">🛒 加入清单</button>` : ''}
        <button class="modal-timer-trigger" id="modalTimerBtn" data-id="${recipe.id}">⏱ 开始计时</button>
        <button class="modal-edit-btn" id="modalEditBtn" data-id="${recipe.id}">✏️ 编辑</button>
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

  // 弹窗内收藏按钮
  const modalFavBtn = document.getElementById('modalFavBtn');
  if (modalFavBtn) {
    modalFavBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = parseInt(modalFavBtn.dataset.id);
      toggleFav(id);
      updateFavUI();
      // 更新弹窗内按钮状态
      modalFavBtn.classList.toggle('faved', isFaved(id));
      modalFavBtn.innerHTML = isFaved(id) ? '❤️' : '🤍';
    });
  }

  // 弹窗内加入清单按钮
  const modalShoppingBtn = document.getElementById('modalShoppingBtn');
  if (modalShoppingBtn) {
    modalShoppingBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      addToShoppingList(recipe);
    });
  }

  // 弹窗内计时按钮
  const modalTimerBtn = document.getElementById('modalTimerBtn');
  if (modalTimerBtn) {
    modalTimerBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      document.getElementById('timerModalName').value = recipe.title;
      document.getElementById('timerModalMinutes').value = recipe.cookingTime || 30;
      openTimerModal();
    });
  }

  // 弹窗内编辑按钮
  const modalEditBtn = document.getElementById('modalEditBtn');
  if (modalEditBtn) {
    modalEditBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      openRecipeForm(recipe);
    });
  }
}

function closeModal() {
  document.getElementById('modalOverlay').classList.remove('show');
  document.body.style.overflow = '';
}

// ==================== EVENTS ====================
document.getElementById('modalOverlay').addEventListener('click', function(e) {
  if (e.target === this) closeModal();
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
  showSuggestions(this.value.trim());
});
searchClear.addEventListener('click', function() {
  searchInput.value = '';
  state.searchKeyword = '';
  searchClear.classList.remove('visible');
  searchInput.focus();
  renderResults();
});

// ==================== SEARCH SUGGESTIONS ====================
let suggestionIndex = -1;
const suggestionsEl = document.getElementById('searchSuggestions');

function showSuggestions(query) {
  if (!query || query.length < 1) {
    suggestionsEl.style.display = 'none';
    return;
  }
  // 使用 Fuse 搜索前 5 个结果
  let results;
  if (fuse) {
    results = fuse.search(query).slice(0, 5);
  } else {
    // fallback: 简单匹配
    const q = query.toLowerCase();
    results = recipes
      .filter(r => r.title.includes(q) || (r._pinyin && r._pinyin.includes(q)))
      .slice(0, 5)
      .map(r => ({ item: r }));
  }

  if (results.length === 0) {
    suggestionsEl.style.display = 'none';
    return;
  }

  suggestionIndex = -1;
  suggestionsEl.innerHTML = results.map((r, i) => {
    const recipe = r.item || r;
    return `
      <div class="search-suggestion-item" data-idx="${i}" data-id="${recipe.id}">
        <span class="sug-title">${recipe.title}</span>
        <span class="sug-meta">${recipe.subcategory} · ${recipe.difficulty}</span>
        ${recipe._pinyin ? `<span class="sug-pinyin">${recipe._pinyin}</span>` : ''}
      </div>`;
  }).join('');
  suggestionsEl.style.display = 'block';

  suggestionsEl.querySelectorAll('.search-suggestion-item').forEach(item => {
    item.addEventListener('click', function() {
      const id = parseInt(this.dataset.id);
      const recipe = recipes.find(r => r.id === id);
      if (recipe) {
        searchInput.value = recipe.title;
        state.searchKeyword = recipe.title;
        searchClear.classList.add('visible');
        suggestionsEl.style.display = 'none';
        showModal(recipe);
      }
    });
    item.addEventListener('mousedown', function(e) { e.preventDefault(); });
  });
}

// 修改 searchInput 事件，加入建议
searchInput.addEventListener('focus', function() {
  if (this.value.trim()) showSuggestions(this.value.trim());
});

searchInput.addEventListener('keydown', function(e) {
  const items = suggestionsEl.querySelectorAll('.search-suggestion-item');
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    suggestionIndex = Math.min(suggestionIndex + 1, items.length - 1);
    items.forEach((el, i) => el.classList.toggle('active', i === suggestionIndex));
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    suggestionIndex = Math.max(suggestionIndex - 1, -1);
    items.forEach((el, i) => el.classList.toggle('active', i === suggestionIndex));
  } else if (e.key === 'Enter' && suggestionIndex >= 0) {
    e.preventDefault();
    const active = items[suggestionIndex];
    if (active) active.click();
  } else if (e.key === 'Escape') {
    suggestionsEl.style.display = 'none';
  }
});

document.addEventListener('click', function(e) {
  if (!e.target.closest('.search-wrapper')) {
    suggestionsEl.style.display = 'none';
  }
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

// ================================================================
//  今日菜谱 · 轮盘抽奖模块
//  ──────────────────────────────────────────────────────────────
//  功能概述：
//  1. 标签抽奖：选择食材标签（如牛肉、猪肉），随机抽取10道菜生成转盘
//  2. 自定义抽奖：用户输入任意选项，生成自定义转盘
//  3. Canvas 绘制转盘，requestAnimationFrame 驱动旋转动画
//  4. cubic ease-out 缓动函数模拟物理减速，指针指向中奖扇区
//
//  核心算法：
//  - 指针固定在顶部（角度 = -π/2 = 3π/2）
//  - 随机选中一个扇区后，计算使该扇区中心对准指针所需的目标角度
//  - 加上5~9圈随机旋转 + 扇区内随机偏移，增强随机感
//  - 动画结束后，遍历所有扇区确定指针指向哪个
//
//  后续优化方向：
//  1. 历史记录 - 记录每次抽奖结果，避免短期内重复
//  2. 营养搭配 - 根据营养数据自动推荐均衡搭配
//  3. 季节推荐 - 根据季节推荐时令菜谱
//  4. 食材库存 - 结合冰箱食材，只从有食材的菜谱中抽取
//  5. 多人抽奖 - 支持多人同时抽奖，各自独立结果
//  6. 难度偏好 - 可设置偏好难度（简单/中等/困难）
//  7. 时间偏好 - 可设置烹饪时间范围
//  8. 语音播报 - 抽奖结果语音播报
//  9. 分享功能 - 分享抽奖结果到社交媒体
//  10. 数据统计 - 统计哪道菜被抽中最多次
// ================================================================

/**
 * 转盘状态管理对象
 * @property {string}  mode          - 抽奖模式：'tag'(标签) | 'custom'(自定义)
 * @property {string}  activeTag     - 当前选中的食材标签
 * @property {Array}   items         - 转盘选项列表 [{label: string, recipe: object|null}]
 * @property {boolean} isSpinning    - 是否正在旋转中
 * @property {number}  currentAngle  - 当前旋转角度（弧度），累计值可超过2π
 * @property {number}  spinVelocity  - 旋转速度（预留，当前使用缓动动画）
 * @property {number}  animationId   - requestAnimationFrame 返回的动画ID
 * @property {object}  resultItem    - 中奖结果 {label, recipe}
 */
const wheelState = {
  mode: 'tag',
  activeTag: null,
  items: [],
  isSpinning: false,
  currentAngle: 0,
  spinVelocity: 0,
  animationId: null,
  resultItem: null,
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

/**
 * 打开轮盘抽奖弹窗
 * 根据当前模式（标签/自定义）恢复上次的转盘状态
 */
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

/**
 * 标签模式：根据选中的食材标签生成转盘
 * 从该标签下随机抽取最多10道菜谱，洗牌后放入转盘
 * @param {string} tag - 食材标签（如"牛肉"、"猪肉"）
 */
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

/**
 * 初始化转盘 Canvas 元素
 * 创建 640x640 高清画布（CSS 缩放为 320px，适配 Retina 屏）
 * 同时创建指针三角形元素
 */
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

/**
 * 绘制转盘（核心渲染函数）
 *
 * 绘制流程：
 * 1. 清空画布
 * 2. 遍历所有选项，绘制每个扇区：
 *    - 使用 WHEEL_COLORS 循环取色
 *    - 从圆心画弧线到外圈，填充颜色
 *    - 绘制文字：上半部文字从外向内读，下半部翻转180°确保始终可读
 * 3. 绘制中心圆（渐变 + "GO" 文字）
 *
 * 文字方向处理：
 * - 扇区中点角度在 90°~270°（下半部）→ 翻转180°，文字从左侧外向内读
 * - 扇区中点角度在 0°~90° 或 270°~360°（上半部）→ 正常方向，文字从右侧外向内读
 */
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

/**
 * 执行转盘旋转动画
 *
 * 动画流程：
 * 1. 随机选中一个目标扇区 randomIndex
 * 2. 计算目标角度：使该扇区中心对准指针位置（顶部 -π/2）
 * 3. 加上扇区内随机偏移（±30%扇区宽度），避免总是停在扇区正中间
 * 4. 加上 5~9 圈随机旋转，增强视觉随机感
 * 5. 使用 cubic ease-out 缓动函数（t=1-(1-t)³），模拟物理减速：
 *    - 刚开始快速旋转，越接近目标越慢
 * 6. 动画时长 4~5 秒随机，增强不确定性
 * 7. 动画结束后调用 getWheelResult 确定中奖项
 *
 * @requires wheelState.items - 转盘选项列表
 * @modifies wheelState.currentAngle, wheelState.isSpinning
 */
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

/**
 * 确定中奖结果
 *
 * 算法：指针固定在顶部（角度 = 3π/2），遍历所有扇区，
 * 判断当前旋转角度下指针落在哪个扇区范围内。
 * 需要处理扇区跨越 0 弧度边界的情况。
 *
 * @modifies wheelState.resultItem
 */
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
  if (e.key === 'Escape') {
    if (wheelOverlay.classList.contains('show')) {
      closeWheel();
    } else if (document.getElementById('shoppingPanel').classList.contains('open')) {
      closeShoppingPanel();
    } else if (document.getElementById('recipeFormOverlay').classList.contains('show')) {
      closeRecipeForm();
    } else {
      closeModal();
    }
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

// ==================== DARK MODE ====================
/**
 * 深色模式管理
 * - 自动检测系统偏好
 * - 手动切换并持久化到 localStorage
 * - 切换时更新图标
 */
function initTheme() {
  const saved = localStorage.getItem('theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const theme = saved || (prefersDark ? 'dark' : 'light');
  applyTheme(theme);
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  const toggle = document.getElementById('themeToggle');
  if (toggle) {
    toggle.textContent = theme === 'dark' ? '☀️' : '🌓';
  }
  localStorage.setItem('theme', theme);
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme');
  applyTheme(current === 'dark' ? 'light' : 'dark');
}

document.getElementById('themeToggle').addEventListener('click', toggleTheme);

// 监听系统主题变化
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
  if (!localStorage.getItem('theme')) {
    applyTheme(e.matches ? 'dark' : 'light');
  }
});

// ==================== FAVORITES ====================
/**
 * 收藏夹管理
 * - 存储在 localStorage 的 favs 数组中
 * - 支持切换收藏、筛选收藏、更新UI
 */
let favs = JSON.parse(localStorage.getItem('favs') || '[]');

function isFaved(id) { return favs.includes(id); }

function toggleFav(id) {
  const idx = favs.indexOf(id);
  if (idx > -1) favs.splice(idx, 1);
  else favs.push(id);
  localStorage.setItem('favs', JSON.stringify(favs));
}

function updateFavUI() {
  const count = favs.length;
  const badge = document.getElementById('favFilterBadge');
  const countEl = document.getElementById('favFilterCount');
  if (count > 0) {
    badge.style.display = 'flex';
    countEl.textContent = count;
    badge.classList.toggle('active', state.showFavsOnly);
  } else {
    badge.style.display = 'none';
  }
}

// 收藏筛选
document.getElementById('favFilterBadge').addEventListener('click', function() {
  state.showFavsOnly = !state.showFavsOnly;
  this.classList.toggle('active', state.showFavsOnly);
  renderResults();
});

// 在 getFilteredRecipes 中增加收藏筛选
const origGetFilteredRecipes = getFilteredRecipes;
getFilteredRecipes = function() {
  let filtered = origGetFilteredRecipes();
  if (state.showFavsOnly) {
    filtered = filtered.filter(r => favs.includes(r.id));
  }
  return filtered;
};

// ==================== TIMER ====================
/**
 * 烹饪计时器
 * - 支持多个并发计时器
 * - 每个计时器独立倒计时
 * - 完成后播放提示音 + 视觉闪烁
 * - 折叠/展开小部件
 */
const timers = [];
let timerInterval = null;

function renderTimers() {
  const body = document.getElementById('timerWidgetBody');
  const countEl = document.getElementById('timerCount');
  const activeTimers = timers.filter(t => !t.done);
  countEl.textContent = activeTimers.length;

  if (timers.length === 0) {
    body.innerHTML = '<button class="timer-add-btn" id="timerAddBtn">+ 添加计时</button>';
    document.getElementById('timerAddBtn').addEventListener('click', openTimerModal);
    return;
  }

  let html = timers.map((t, i) => {
    const mins = Math.floor(t.remaining / 60);
    const secs = t.remaining % 60;
    const display = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    const statusClass = t.done ? ' done' : (t.running ? ' running' : '');
    const playPauseIcon = t.done ? '✅' : (t.running ? '⏸' : '▶');
    const playPauseClass = t.done ? 'del' : (t.running ? 'pause' : 'play');
    return `
      <div class="timer-item${statusClass}" data-idx="${i}">
        <span class="timer-name">${t.name}</span>
        <span class="timer-display">${t.done ? '完成!' : display}</span>
        <div class="timer-actions">
          ${!t.done ? `<button class="timer-btn ${playPauseClass}" data-action="toggle" data-idx="${i}">${playPauseIcon}</button>` : ''}
          <button class="timer-btn del" data-action="delete" data-idx="${i}">✕</button>
        </div>
      </div>`;
  }).join('');

  html += '<button class="timer-add-btn" id="timerAddBtn">+ 添加计时</button>';
  body.innerHTML = html;

  document.getElementById('timerAddBtn').addEventListener('click', openTimerModal);
  body.querySelectorAll('.timer-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const action = btn.dataset.action;
      const idx = parseInt(btn.dataset.idx);
      if (action === 'toggle') toggleTimer(idx);
      else if (action === 'delete') deleteTimer(idx);
    });
  });
}

function startTimerLoop() {
  if (timerInterval) return;
  timerInterval = setInterval(() => {
    let hasRunning = false;
    timers.forEach((t) => {
      if (t.running && t.remaining > 0) {
        t.remaining--;
        if (t.remaining <= 0) {
          t.running = false;
          t.done = true;
          playTimerAlert();
        }
        hasRunning = true;
      }
    });
    renderTimers();
    if (!hasRunning && timers.every(t => t.done)) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
  }, 1000);
}

function playTimerAlert() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    [800, 1000, 1200].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.frequency.value = freq; osc.type = 'sine';
      gain.gain.value = 0.3;
      osc.start(ctx.currentTime + i * 0.2);
      osc.stop(ctx.currentTime + i * 0.2 + 0.15);
    });
  } catch (e) { /* 忽略音频错误 */ }
}

function toggleTimer(idx) {
  const t = timers[idx];
  if (!t || t.done) return;
  t.running = !t.running;
  if (t.running) startTimerLoop();
  renderTimers();
}

function deleteTimer(idx) {
  timers.splice(idx, 1);
  renderTimers();
}

function openTimerModal() {
  document.getElementById('timerModal').style.display = 'flex';
  document.getElementById('timerModalMinutes').focus();
}

function closeTimerModal() {
  document.getElementById('timerModal').style.display = 'none';
}

function addTimer() {
  const name = document.getElementById('timerModalName').value.trim() || '计时';
  const minutes = parseInt(document.getElementById('timerModalMinutes').value) || 5;
  timers.push({ name, remaining: minutes * 60, running: true, done: false });
  closeTimerModal();
  startTimerLoop();
  renderTimers();
  // 展开计时器面板
  document.getElementById('timerWidget').classList.remove('collapsed');
}

// Timer widget toggle
document.getElementById('timerWidgetHeader').addEventListener('click', () => {
  document.getElementById('timerWidget').classList.toggle('collapsed');
});

// Timer modal events
document.getElementById('timerModalCancel').addEventListener('click', closeTimerModal);
document.getElementById('timerModalConfirm').addEventListener('click', addTimer);
document.getElementById('timerModal').addEventListener('click', function(e) {
  if (e.target === this) closeTimerModal();
});
document.getElementById('timerModalMinutes').addEventListener('keydown', function(e) {
  if (e.key === 'Enter') addTimer();
});

// ==================== SHOPPING LIST ====================
/**
 * 购物清单
 * - 从菜谱详情添加食材到清单
 * - 相同食材自动合并，用量用逗号连接
 * - 记录来源菜谱，支持勾选已购
 * - 一键复制清单到剪贴板
 */
let shoppingList = JSON.parse(localStorage.getItem('shoppingList') || '[]');

function addToShoppingList(recipe) {
  if (!recipe.ingredients || recipe.ingredients.length === 0) return;

  recipe.ingredients.forEach(ing => {
    const existing = shoppingList.find(item =>
      item.name === ing.name && !item.checked
    );
    if (existing) {
      // 合并用量
      const amounts = new Set(existing.amount.split('、'));
      if (ing.amount) amounts.add(ing.amount);
      existing.amount = [...amounts].join('、');
      // 合并来源
      const froms = new Set(existing.from.split('、'));
      froms.add(recipe.title);
      existing.from = [...froms].join('、');
    } else {
      shoppingList.push({
        name: ing.name,
        amount: ing.amount || '',
        from: recipe.title,
        checked: false,
      });
    }
  });

  saveShoppingList();
  renderShoppingList();
  openShoppingPanel();
}

function saveShoppingList() {
  localStorage.setItem('shoppingList', JSON.stringify(shoppingList));
  updateShoppingBadge();
}

function updateShoppingBadge() {
  const unchecked = shoppingList.filter(i => !i.checked).length;
  document.getElementById('shoppingCount').textContent = unchecked;
}

function toggleShoppingItem(idx) {
  shoppingList[idx].checked = !shoppingList[idx].checked;
  saveShoppingList();
  renderShoppingList();
}

function clearShoppingList() {
  if (confirm('确定清空购物清单？')) {
    shoppingList = [];
    saveShoppingList();
    renderShoppingList();
  }
}

function copyShoppingList() {
  const unchecked = shoppingList.filter(i => !i.checked);
  if (unchecked.length === 0) {
    alert('清单已空');
    return;
  }
  const text = unchecked.map((item, i) =>
    `${i + 1}. ${item.name}${item.amount ? ' — ' + item.amount : ''}`
  ).join('\n');
  navigator.clipboard.writeText(text).then(() => {
    alert('已复制到剪贴板');
  }).catch(() => {
    // 降级方案
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    alert('已复制到剪贴板');
  });
}

function renderShoppingList() {
  const body = document.getElementById('shoppingPanelBody');
  if (shoppingList.length === 0) {
    body.innerHTML = `
      <div class="shopping-empty">
        <div class="empty-icon">🛒</div>
        <p>清单还是空的<br>在菜谱详情中点击「加入清单」</p>
      </div>`;
    return;
  }
  body.innerHTML = shoppingList.map((item, i) => `
    <div class="shopping-item${item.checked ? ' checked' : ''}">
      <input type="checkbox" ${item.checked ? 'checked' : ''} data-idx="${i}">
      <div class="shop-info">
        <div class="shop-name">${item.name}</div>
        ${item.amount ? `<div class="shop-amount">${item.amount}</div>` : ''}
        <div class="shop-from">来自：${item.from}</div>
      </div>
    </div>
  `).join('');

  body.querySelectorAll('input[type="checkbox"]').forEach(cb => {
    cb.addEventListener('change', function() {
      toggleShoppingItem(parseInt(this.dataset.idx));
    });
  });
  updateShoppingBadge();
}

function openShoppingPanel() {
  document.getElementById('shoppingPanel').classList.add('open');
  document.getElementById('shoppingBackdrop').classList.add('show');
  document.body.style.overflow = 'hidden';
}

function closeShoppingPanel() {
  document.getElementById('shoppingPanel').classList.remove('open');
  document.getElementById('shoppingBackdrop').classList.remove('show');
  document.body.style.overflow = '';
}

// Shopping events
document.getElementById('shoppingBadge').addEventListener('click', openShoppingPanel);
document.getElementById('shoppingPanelClose').addEventListener('click', closeShoppingPanel);
document.getElementById('shoppingBackdrop').addEventListener('click', closeShoppingPanel);
document.getElementById('shoppingClearAll').addEventListener('click', clearShoppingList);
document.getElementById('shoppingCopy').addEventListener('click', copyShoppingList);

// 初始化购物清单UI
renderShoppingList();

// ==================== PWA ====================
/**
 * PWA 离线支持
 * - 注册 Service Worker 缓存静态资源
 * - 支持离线访问和添加到主屏幕
 */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then(reg => {
      console.log('SW registered:', reg.scope);
    }).catch(err => {
      console.log('SW registration failed:', err);
    });
  });
}

// ==================== RECIPE FORM (CRUD) ====================
let editingRecipeId = null; // null = 新增模式, number = 编辑模式

function openRecipeForm(recipe = null) {
  editingRecipeId = recipe ? recipe.id : null;
  const form = document.getElementById('recipeForm');
  const titleEl = document.getElementById('recipeFormTitle');
  const submitBtn = document.getElementById('recipeFormSubmit');

  if (recipe) {
    titleEl.textContent = '编辑菜谱';
    submitBtn.textContent = '更新菜谱';
    form.title.value = recipe.title || '';
    form.category.value = recipe.category || '家常菜';
    form.subcategory.value = recipe.subcategory || '';
    form.difficulty.value = recipe.difficulty || '中等';
    form.cookingTime.value = recipe.cookingTime || 30;
    form.servings.value = recipe.servings || '2-3人份';
    form.tags.value = (recipe.tags || []).join(', ');
    // 食材转文本
    form.ingredients.value = (recipe.ingredients || []).map(ing =>
      [ing.name, ing.amount, ing.note].filter(Boolean).join(' ')
    ).join('\n');
    // 步骤转文本
    form.steps.value = (recipe.steps || []).map(step =>
      `## ${step.phase}\n${step.items.join('\n')}`
    ).join('\n\n');
    form.tips.value = (recipe.tips || []).join('\n');
    form.nutrition.value = (recipe.nutrition || []).join('\n');
  } else {
    titleEl.textContent = '新增菜谱';
    submitBtn.textContent = '保存菜谱';
    form.reset();
    form.category.value = '家常菜';
    form.difficulty.value = '中等';
    form.cookingTime.value = 30;
    form.servings.value = '2-3人份';
  }

  document.getElementById('recipeFormOverlay').classList.add('show');
  document.body.style.overflow = 'hidden';
  document.getElementById('recipeFormContent').scrollTop = 0;
}

function closeRecipeForm() {
  document.getElementById('recipeFormOverlay').classList.remove('show');
  document.body.style.overflow = '';
}

function parseFormData(form) {
  const data = {
    title: form.title.value.trim(),
    category: form.category.value,
    subcategory: form.subcategory.value || '其他',
    difficulty: form.difficulty.value,
    cookingTime: parseInt(form.cookingTime.value) || 30,
    servings: form.servings.value || '2-3人份',
    tags: form.tags.value.split(/[,，]/).map(t => t.trim()).filter(Boolean),
  };

  // 解析食材
  data.ingredients = form.ingredients.value.split('\n').filter(Boolean).map(line => {
    const parts = line.split(/\s+/);
    return {
      name: parts[0] || '',
      amount: parts.slice(1, 2).join(' ') || '',
      note: parts.slice(2).join(' ') || '',
    };
  });

  // 解析步骤
  data.steps = [];
  const stepBlocks = form.steps.value.split(/##\s*/).filter(Boolean);
  stepBlocks.forEach(block => {
    const lines = block.split('\n').filter(Boolean);
    data.steps.push({
      phase: lines[0].trim(),
      items: lines.slice(1).map(l => l.replace(/^\d+[\.\、\)）]\s*/, '').trim()).filter(Boolean),
    });
  });

  data.tips = form.tips.value.split('\n').filter(Boolean).map(t => t.trim());
  data.nutrition = form.nutrition.value.split('\n').filter(Boolean).map(n => n.trim());

  return data;
}

async function handleRecipeSubmit(e) {
  e.preventDefault();
  const form = e.target;
  const submitBtn = document.getElementById('recipeFormSubmit');
  submitBtn.disabled = true;
  submitBtn.textContent = '保存中...';

  try {
    const data = parseFormData(form);

    if (editingRecipeId) {
      // 更新模式
      if (isSupabaseConfigured()) {
        showLoading('更新中...');
        await updateRecipeInSupabase(editingRecipeId, data);
        hideLoading();
      }
      // 更新本地数据
      const idx = recipes.findIndex(r => r.id === editingRecipeId);
      if (idx > -1) {
        recipes[idx] = { ...recipes[idx], ...data };
      }
    } else {
      // 新增模式
      const newId = recipes.length > 0 ? Math.max(...recipes.map(r => r.id)) + 1 : 1;
      data.id = newId;

      if (isSupabaseConfigured()) {
        showLoading('创建中...');
        await createRecipeInSupabase(data);
        hideLoading();
      }

      recipes.push(data);
      // 生成拼音
      try {
        if (typeof pinyinPro !== 'undefined') {
          data._pinyin = pinyinPro.pinyin(data.title, { toneType: 'none', type: 'array' }).join('');
        }
      } catch(e) {}
    }

    closeRecipeForm();
    buildCategoryTree();
    renderSidebar();
    renderResults();
    if (fuse) initFuse();

    if (isSupabaseConfigured()) {
      alert(editingRecipeId ? '菜谱已更新到 Supabase' : '菜谱已保存到 Supabase');
    } else {
      alert(editingRecipeId ? '菜谱已更新（本地）\n⚠️ 请配置 SUPABASE_ANON_KEY 以同步到云端' : '菜谱已保存（本地）\n⚠️ 请配置 SUPABASE_ANON_KEY 以同步到云端');
    }
  } catch (err) {
    console.error('保存失败:', err);
    alert('保存失败: ' + err.message);
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = editingRecipeId ? '更新菜谱' : '保存菜谱';
  }
}

// Form events
document.getElementById('addRecipeBtn').addEventListener('click', () => openRecipeForm());
document.getElementById('recipeFormClose').addEventListener('click', closeRecipeForm);
document.getElementById('recipeFormCancel').addEventListener('click', closeRecipeForm);
document.getElementById('recipeFormOverlay').addEventListener('click', function(e) {
  if (e.target === this) closeRecipeForm();
});
document.getElementById('recipeForm').addEventListener('submit', handleRecipeSubmit);

// ==================== INIT ====================
initTheme();
updateFavUI();
loadRecipes();
