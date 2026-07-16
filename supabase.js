/**
 * Supabase REST API 模块
 * 用于菜谱的增删改查操作
 *
 * 配置：在下方填入你的 Supabase 项目信息
 * - URL: 你的 Supabase REST API 地址
 * - ANON_KEY: 你的 Supabase 匿名密钥（在 Supabase Dashboard → Settings → API 中获取）
 * - TABLE: 数据库表名
 */

const SUPABASE_CONFIG = {
  // 🔑 请在 Supabase Dashboard → Settings → API 中获取 anon key
  url: 'https://ixxpckteitrpcfhwixtx.supabase.co/rest/v1',
  anonKey: 'sb_publishable_4zIquqgEV_U0S23oSqkIDQ_iPaTwVdV', // ← 替换为你的真实 anon key
  table: 'recipes',
};

/**
 * 通用 Supabase 请求函数
 * @param {string} method - GET/POST/PATCH/DELETE
 * @param {string} path - API 路径
 * @param {object} body - 请求体（POST/PATCH 时使用）
 * @returns {Promise<object>}
 */
async function supabaseRequest(method, path, body = null) {
  const headers = {
    'apikey': SUPABASE_CONFIG.anonKey,
    'Authorization': `Bearer ${SUPABASE_CONFIG.anonKey}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation',
  };

  const options = { method, headers };
  if (body && (method === 'POST' || method === 'PATCH')) {
    options.body = JSON.stringify(body);
  }
  if (method === 'DELETE') {
    headers['Prefer'] = 'return=minimal';
  }

  const url = `${SUPABASE_CONFIG.url}/${path}`;
  const res = await fetch(url, options);

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Supabase ${method} ${path} failed (${res.status}): ${err}`);
  }

  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

/**
 * 检查 Supabase 是否已配置
 */
function isSupabaseConfigured() {
  return SUPABASE_CONFIG.anonKey && SUPABASE_CONFIG.anonKey !== 'YOUR_SUPABASE_ANON_KEY';
}

/**
 * 从 Supabase 获取所有菜谱
 */
async function fetchRecipesFromSupabase() {
  return await supabaseRequest('GET', `${SUPABASE_CONFIG.table}?select=*&order=id.asc`);
}

/**
 * 创建新菜谱
 * @param {object} recipe - 菜谱对象（不含 id，由 Supabase 自动生成）
 */
async function createRecipeInSupabase(recipe) {
  return await supabaseRequest('POST', SUPABASE_CONFIG.table, recipe);
}

/**
 * 更新菜谱
 * @param {number} id - 菜谱 ID
 * @param {object} recipe - 要更新的字段
 */
async function updateRecipeInSupabase(id, recipe) {
  return await supabaseRequest('PATCH', `${SUPABASE_CONFIG.table}?id=eq.${id}`, recipe);
}

/**
 * 删除菜谱
 * @param {number} id - 菜谱 ID
 */
async function deleteRecipeFromSupabase(id) {
  return await supabaseRequest('DELETE', `${SUPABASE_CONFIG.table}?id=eq.${id}`);
}

/**
 * 显示加载遮罩
 */
function showLoading(msg = '保存中...') {
  const overlay = document.createElement('div');
  overlay.className = 'loading-overlay';
  overlay.id = 'loadingOverlay';
  overlay.innerHTML = `<div class="loading-spinner"></div>`;
  document.body.appendChild(overlay);
}

/**
 * 隐藏加载遮罩
 */
function hideLoading() {
  const overlay = document.getElementById('loadingOverlay');
  if (overlay) overlay.remove();
}