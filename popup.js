/**
 * CAPYLULU 桌宠 - Popup 脚本
 */

document.addEventListener('DOMContentLoaded', () => {
  // ============ DOM 元素引用 ============
  const elWalkOnType = document.getElementById('optWalkOnType');
  const elSpeed = document.getElementById('optSpeed');
  const elSpeedValue = document.getElementById('speedValue');
  const elDelay = document.getElementById('optDelay');
  const elDelayValue = document.getElementById('delayValue');
  const elSize = document.getElementById('optSize');
  const btnSave = document.getElementById('btnSave');
  const btnReset = document.getElementById('btnReset');
  const statusText = document.getElementById('statusText');
  const petPreview = document.getElementById('petPreview');

  // ============ 默认设置 ============
  const DEFAULTS = {
    walkOnType: true,
    speed: 3,
    delay: 800,
    size: 80,
  };

  // ============ 在弹窗中渲染迷你桌宠预览 ============
  function renderPetPreview() {
    if (!petPreview) return;
    petPreview.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="80" height="80">
        <defs>
          <radialGradient id="pgBody" cx="40%" cy="35%" r="65%">
            <stop offset="0%" stop-color="#FFE566"/>
            <stop offset="70%" stop-color="#FFD93D"/>
            <stop offset="100%" stop-color="#F4C430"/>
          </radialGradient>
          <radialGradient id="pgCheek" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stop-color="#FF8FA080"/>
            <stop offset="100%" stop-color="#FF8FA000"/>
          </radialGradient>
        </defs>
        <ellipse cx="50" cy="52" rx="38" ry="36" fill="url(#pgBody)" filter="drop-shadow(0 2px 4px rgba(0,0,0,0.15))"/>
        <ellipse cx="18" cy="24" rx="10" ry="14" fill="#FFD93D" transform="rotate(-15 18 24)"/>
        <ellipse cx="82" cy="24" rx="10" ry="14" fill="#FFD93D" transform="rotate(15 82 24)"/>
        <ellipse cx="19" cy="25" rx="5" ry="8" fill="#FFB8C0" transform="rotate(-15 19 25)"/>
        <ellipse cx="81" cy="25" rx="5" ry="8" fill="#FFB8C0" transform="rotate(15 81 25)"/>
        <circle cx="50" cy="14" r="7" fill="#FF9A3C"/>
        <circle cx="48" cy="11" r="2.5" fill="#FFF5"/>
        <circle cx="53" cy="13" r="1.5" fill="#FFF5"/>
        <ellipse cx="37" cy="48" rx="7" ry="8" fill="#3A2A1A"/>
        <ellipse cx="63" cy="48" rx="7" ry="8" fill="#3A2A1A"/>
        <circle cx="39" cy="45" r="3" fill="#FFF"/>
        <circle cx="65" cy="45" r="3" fill="#FFF"/>
        <ellipse cx="26" cy="58" rx="7" ry="4" fill="url(#pgCheek)"/>
        <ellipse cx="74" cy="58" rx="7" ry="4" fill="url(#pgCheek)"/>
        <path d="M 43 60 Q 50 68 57 60" stroke="#C47A2A" stroke-width="2.5" fill="none" stroke-linecap="round"/>
        <ellipse cx="12" cy="55" rx="6" ry="9" fill="#FFD93D" transform="rotate(-20 12 55)"/>
        <ellipse cx="88" cy="55" rx="6" ry="9" fill="#FFD93D" transform="rotate(20 88 55)"/>
        <ellipse cx="35" cy="85" rx="9" ry="6" fill="#F4C430"/>
        <ellipse cx="65" cy="85" rx="9" ry="6" fill="#F4C430"/>
        <text x="50" y="76" text-anchor="middle" font-size="7" font-weight="bold" fill="#E5A800" font-family="Arial,sans-serif" opacity="0.6">cute</text>
      </svg>
    `;
  }

  // ============ 加载已保存的设置 ============
  async function loadSettings() {
    try {
      const data = await chrome.storage.local.get({
        walkOnType: DEFAULTS.walkOnType,
        speed: DEFAULTS.speed,
        delay: DEFAULTS.delay,
        size: DEFAULTS.size,
      });

      elWalkOnType.checked = data.walkOnType;
      elSpeed.value = data.speed;
      elSpeedValue.textContent = data.speed;
      elDelay.value = data.delay;
      elDelayValue.textContent = data.delay;
      elSize.value = data.size;

      console.log('[CAPYLULU Popup] 设置已加载:', data);
    } catch (err) {
      console.warn('[CAPYLULU Popup] 加载设置失败:', err);
    }
  }

  // ============ 保存设置 ============
  async function saveSettings() {
    const settings = {
      walkOnType: elWalkOnType.checked,
      speed: parseInt(elSpeed.value, 10),
      delay: parseInt(elDelay.value, 10),
      size: parseInt(elSize.value, 10),
    };

    try {
      await chrome.storage.local.set(settings);

      // 通知所有标签页更新设置
      const tabs = await chrome.tabs.query({});
      for (const tab of tabs) {
        try {
          await chrome.tabs.sendMessage(tab.id, {
            type: 'CAPYLULU_UPDATE_SETTINGS',
            settings: settings,
          });
        } catch (e) {
          // 标签页可能没有加载 content script，忽略
        }
      }

      showStatus('✅ 设置已保存并同步到所有页面！', 'success');
      console.log('[CAPYLULU Popup] 设置已保存:', settings);
    } catch (err) {
      showStatus('❌ 保存失败: ' + err.message, 'error');
      console.error('[CAPYLULU Popup] 保存失败:', err);
    }
  }

  // ============ 重置设置 ============
  async function resetSettings() {
    elWalkOnType.checked = DEFAULTS.walkOnType;
    elSpeed.value = DEFAULTS.speed;
    elSpeedValue.textContent = DEFAULTS.speed;
    elDelay.value = DEFAULTS.delay;
    elDelayValue.textContent = DEFAULTS.delay;
    elSize.value = DEFAULTS.size;

    await saveSettings();
    showStatus('↺ 已重置为默认设置', 'info');
  }

  // ============ 状态栏提示 ============
  let statusTimer = null;
  function showStatus(text, type) {
    statusText.innerHTML = `<span class="status-dot"></span>${text}`;
    clearTimeout(statusTimer);

    if (type === 'success') {
      statusTimer = setTimeout(() => {
        statusText.innerHTML = '<span class="status-dot"></span>桌宠运行中 · 已在当前页面激活';
      }, 3000);
    }
  }

  // ============ UI 事件绑定 ============
  elSpeed.addEventListener('input', () => {
    elSpeedValue.textContent = elSpeed.value;
  });

  elDelay.addEventListener('input', () => {
    elDelayValue.textContent = elDelay.value;
  });

  btnSave.addEventListener('click', saveSettings);
  btnReset.addEventListener('click', resetSettings);

  // ============ 初始化 ============
  renderPetPreview();
  loadSettings();

  // 检查是否为欢迎页模式
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('welcome') === '1') {
    showStatus('🎉 欢迎安装 CAPYLULU 桌宠！', 'success');
  }

  console.log('[CAPYLULU Popup] 弹窗已初始化');
});
