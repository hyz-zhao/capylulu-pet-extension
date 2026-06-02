/**
 * CAPYLULU 桌宠 - Content Script
 * 在所有网页上显示可爱的 CAPYLULU 桌宠
 * 功能：打字时来回走动、停止打字时停下、可拖拽、点击互动
 */

(function () {
  'use strict';

  // ============ 配置 ============
  const CONFIG = {
    petSize: 80,
    walkSpeed: 3,          // px per frame
    walkFrameInterval: 30, // ms between animation frames
    typingStopDelay: 800,  // ms after last keystroke to stop walking
    bounceHeight: 6,       // walking bounce amplitude
    bounceSpeed: 180,      // ms per bounce cycle
    defaultPosition: { right: 20, bottom: 20 },
    interactionMessages: [
      '你好呀！我是 CAPYLULU ✨',
      '继续加油打字吧！💪',
      '你是最棒的！🌟',
      'CAPYLULU 陪你一起工作~ 💛',
      '要不要休息一下？☕',
      '今天也要元气满满哦！⭐',
      'cute cute~ 🎵',
      '爱你哟！💕',
    ],
    idleAnimations: ['blink', 'sway', 'float'],
    idleSwitchInterval: 3000,
  };

  // ============ 状态 ============
  const state = {
    isWalking: false,
    isTyping: false,
    directionAngle: Math.random() * Math.PI * 2, // 移动方向角度（弧度）
    positionX: 0,
    positionY: 0,
    currentIdleAnim: 'sway',
    typingTimer: null,
    walkAnimationId: null,
    idleAnimationId: null,
    isDragging: false,
    dragStartX: 0,
    dragStartY: 0,
    dragOffsetX: 0,
    dragOffsetY: 0,
    walkRange: { minX: 10, maxX: 0, minY: 10, maxY: 0 },
    lastDirectionChange: 0, // 上次方向改变的时间
    directionChangeInterval: 2000 + Math.random() * 2000, // 2-4秒随机改变方向
    element: null,
    bubbleEl: null,
    containerEl: null,
    frameCount: 0,
    particles: [],
  };

  // ============ SVG 资源 (CAPYLULU 角色) ============
  const PET_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100%" height="100%">
  <defs>
    <!-- 阴影 -->
    <filter id="petShadow" x="-50%" y="-50%" width="200%" height="200%">
      <feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="#00000022"/>
    </filter>
    <!-- 身体渐变 -->
    <radialGradient id="bodyGrad" cx="40%" cy="35%" r="65%">
      <stop offset="0%" stop-color="#FFE566"/>
      <stop offset="70%" stop-color="#FFD93D"/>
      <stop offset="100%" stop-color="#F4C430"/>
    </radialGradient>
    <!-- 脸颊渐变 -->
    <radialGradient id="cheekGrad" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#FF8FA080"/>
      <stop offset="100%" stop-color="#FF8FA000"/>
    </radialGradient>
  </defs>

  <!-- 身体/头部 (圆润的黄色主体) -->
  <ellipse cx="50" cy="52" rx="38" ry="36" fill="url(#bodyGrad)" filter="url(#petShadow)"/>

  <!-- 耳朵 -->
  <ellipse cx="18" cy="24" rx="10" ry="14" fill="#FFD93D" transform="rotate(-15 18 24)"/>
  <ellipse cx="82" cy="24" rx="10" ry="14" fill="#FFD93D" transform="rotate(15 82 24)"/>
  <!-- 内耳 -->
  <ellipse cx="19" cy="25" rx="5" ry="8" fill="#FFB8C0" transform="rotate(-15 19 25)"/>
  <ellipse cx="81" cy="25" rx="5" ry="8" fill="#FFB8C0" transform="rotate(15 81 25)"/>

  <!-- 头顶橙色装饰 -->
  <circle cx="50" cy="14" r="7" fill="#FF9A3C"/>
  <circle cx="48" cy="11" r="2.5" fill="#FFF5" />
  <circle cx="53" cy="13" r="1.5" fill="#FFF5" />

  <!-- 眼睛 -->
  <g class="pet-eyes">
    <ellipse cx="37" cy="48" rx="7" ry="8" fill="#3A2A1A"/>
    <ellipse cx="63" cy="48" rx="7" ry="8" fill="#3A2A1A"/>
    <!-- 眼睛高光 -->
    <circle class="eye-highlight" cx="39" cy="45" r="3" fill="#FFFFFF"/>
    <circle class="eye-highlight" cx="65" cy="45" r="3" fill="#FFFFFF"/>
    <circle class="eye-highlight-small" cx="37" cy="50" r="1.5" fill="#FFFFFF"/>
    <circle class="eye-highlight-small" cx="61" cy="50" r="1.5" fill="#FFFFFF"/>
  </g>

  <!-- 腮红 -->
  <ellipse cx="26" cy="58" rx="7" ry="4" fill="url(#cheekGrad)"/>
  <ellipse cx="74" cy="58" rx="7" ry="4" fill="url(#cheekGrad)"/>

  <!-- 嘴巴 (微笑) -->
  <path class="pet-mouth" d="M 43 60 Q 50 68 57 60" stroke="#C47A2A" stroke-width="2.5" fill="none" stroke-linecap="round"/>

  <!-- 小手/脚 -->
  <g class="pet-limbs">
    <!-- 左手 -->
    <ellipse class="pet-left-arm" cx="12" cy="55" rx="6" ry="9" fill="#FFD93D" transform="rotate(-20 12 55)"/>
    <!-- 右手 -->
    <ellipse class="pet-right-arm" cx="88" cy="55" rx="6" ry="9" fill="#FFD93D" transform="rotate(20 88 55)"/>
    <!-- 左脚 -->
    <ellipse class="pet-left-leg" cx="35" cy="85" rx="9" ry="6" fill="#F4C430"/>
    <!-- 右脚 -->
    <ellipse class="pet-right-leg" cx="65" cy="85" rx="9" ry="6" fill="#F4C430"/>
  </g>

  <!-- 肚子上的文字装饰 -->
  <text x="50" y="76" text-anchor="middle" font-size="7" font-weight="bold" fill="#E5A800" font-family="Arial, sans-serif" opacity="0.6">cute</text>
</svg>`;

  // ============ 创建 DOM 元素 ============
  function createPetElement() {
    // 容器
    const container = document.createElement('div');
    container.id = 'capylulu-pet-container';
    container.innerHTML = `
      <div id="capylulu-pet">
        <div id="capylulu-pet-inner">${PET_SVG}</div>
      </div>
      <div id="capylulu-bubble" class="hidden"></div>
      <div id="capylulu-particles"></div>
    `;
    document.body.appendChild(container);

    state.containerEl = container;
    state.element = container.querySelector('#capylulu-pet');
    state.bubbleEl = container.querySelector('#capylulu-bubble');

    // 初始位置（右下角）
    requestAnimationFrame(() => {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      state.walkRange.maxX = Math.max(vw - CONFIG.petSize - 10, 100);
      state.walkRange.minX = 10;
      state.walkRange.maxY = Math.max(vh - CONFIG.petSize - 10, 100);
      state.walkRange.minY = 10;
      state.positionX = state.walkRange.maxX; // 从右下角开始
      state.positionY = state.walkRange.maxY;
      applyPosition();
    });

    setupDragInteraction();
    setupClickInteraction();
  }

  // ============ 打字检测 ============
  function setupTypingDetection() {
    let typingDebounce;

    document.addEventListener('keydown', (e) => {
      // 忽略纯修饰键
      if (['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) return;
      // 忽略输入框以外的（可选：全局检测）
      if (!isTextInput(e.target)) return;

      if (!state.isTyping) {
        state.isTyping = true;
        startWalking();
      }

      clearTimeout(typingDebounce);
      typingDebounce = setTimeout(() => {
        state.isTyping = false;
        stopWalking();
      }, CONFIG.typingStopDelay);
    }, true); // capture phase for earlier detection

    // 也监听 input 事件作为补充
    document.addEventListener('input', (e) => {
      if (!isTextInput(e.target)) return;

      if (!state.isTyping) {
        state.isTyping = true;
        startWalking();
      }

      clearTimeout(typingDebounce);
      typingDebounce = setTimeout(() => {
        state.isTyping = false;
        stopWalking();
      }, CONFIG.typingStopDelay);
    }, true);
  }

  function isTextInput(el) {
    if (!el || !el.tagName) return false;
    const tag = el.tagName.toLowerCase();
    const editable = el.isContentEditable;
    return tag === 'textarea' ||
           tag === 'input' && !['checkbox', 'radio', 'submit', 'button', 'reset', 'file', 'image'].includes(el.type) ||
           editable ||
           el.getAttribute('role') === 'textbox' ||
           el.getAttribute('role') === 'combobox' ||
           el.classList.contains('ProseMirror') ||
           el.classList.contains('ql-editor') ||
           el.classList.contains('CodeMirror') ||
           el.classList.contains('monaco-editor');
  }

  // ============ 行走动画 ============
  function startWalking() {
    if (state.isWalking) return;
    state.isWalking = true;
    state.element.classList.add('walking');
    state.element.classList.remove('idle');
    state.lastDirectionChange = performance.now();
    state.directionChangeInterval = 2000 + Math.random() * 2000;

    let lastTime = performance.now();

    function walkFrame(now) {
      if (!state.isWalking) return;

      const dt = now - lastTime;
      lastTime = now;

      // 偶尔随机偏转方向（±30°）
      if (now - state.lastDirectionChange > state.directionChangeInterval) {
        state.directionAngle += (Math.random() - 0.5) * (Math.PI / 3);
        state.lastDirectionChange = now;
        state.directionChangeInterval = 2000 + Math.random() * 2000;
      }

      // 根据角度计算位移
      const dx = Math.cos(state.directionAngle) * CONFIG.walkSpeed;
      const dy = Math.sin(state.directionAngle) * CONFIG.walkSpeed;

      state.positionX += dx;
      state.positionY += dy;

      // X 轴边界反弹
      if (state.positionX >= state.walkRange.maxX) {
        state.positionX = state.walkRange.maxX;
        state.directionAngle = Math.PI - state.directionAngle;
      } else if (state.positionX <= state.walkRange.minX) {
        state.positionX = state.walkRange.minX;
        state.directionAngle = Math.PI - state.directionAngle;
      }

      // Y 轴边界反弹
      if (state.positionY >= state.walkRange.maxY) {
        state.positionY = state.walkRange.maxY;
        state.directionAngle = -state.directionAngle;
      } else if (state.positionY <= state.walkRange.minY) {
        state.positionY = state.walkRange.minY;
        state.directionAngle = -state.directionAngle;
      }

      // 翻转角色朝向（根据水平分量）
      flipDirection(dx >= 0 ? 1 : -1);

      // 应用位置
      applyPosition();

      // 行走弹跳效果
      updateWalkBounce(now);

      // 偶尔产生粒子
      state.frameCount++;
      if (state.frameCount % 12 === 0) {
        spawnStepParticle();
      }

      state.walkAnimationId = requestAnimationFrame(walkFrame);
    }

    state.walkAnimationId = requestAnimationFrame(walkFrame);
  }

  function stopWalking() {
    state.isWalking = false;
    if (state.walkAnimationId) {
      cancelAnimationFrame(state.walkAnimationId);
      state.walkAnimationId = null;
    }
    state.element.classList.remove('walking');
    state.element.classList.add('idle');
    startIdleAnimation();
  }

  function applyPosition() {
    if (!state.containerEl) return;
    state.containerEl.style.right = 'auto';
    state.containerEl.style.bottom = 'auto';
    state.containerEl.style.left = state.positionX + 'px';
    state.containerEl.style.top = state.positionY + 'px';
  }

  function flipDirection(dir) {
    if (!state.element) return;
    state.element.style.transform = `scaleX(${dir})`;
  }

  function updateWalkBounce(now) {
    if (!state.element) return;
    const phase = (now % CONFIG.bounceSpeed) / CONFIG.bounceSpeed;
    const offset = Math.sin(phase * Math.PI * 2) * CONFIG.bounceHeight;
    state.element.style.marginTop = -offset + 'px';
  }

  // ============ 待机动画 ============
  function startIdleAnimation() {
    if (state.idleAnimationId) {
      cancelAnimationFrame(state.idleAnimationId);
    }

    state.element.classList.add('idle');
    let switchTimer = 0;
    const switchInterval = CONFIG.idleSwitchInterval;
    let lastTime = performance.now();

    function idleFrame(now) {
      if (state.isWalking) return;

      const dt = now - lastTime;
      lastTime = now;
      switchTimer += dt;

      if (switchTimer >= switchInterval) {
        switchTimer = 0;
        // 切换待机动画
        const anims = CONFIG.idleAnimations;
        const nextIdx = (anims.indexOf(state.currentIdleAnim) + 1) % anims.length;
        state.currentIdleAnim = anims[nextIdx];
        state.element.setAttribute('data-idle-anim', state.currentIdleAnim);
      }

      // 微微浮动
      const floatPhase = (now % 2500) / 2500;
      const floatY = Math.sin(floatPhase * Math.PI * 2) * 3;
      state.element.style.marginTop = -floatY + 'px';

      state.idleAnimationId = requestAnimationFrame(idleFrame);
    }

    state.idleAnimationId = requestAnimationFrame(idleFrame);
    state.currentIdleAnim = 'sway';
    state.element.setAttribute('data-idle-anim', 'sway');
  }

  // ============ 粒子效果 ============
  function spawnStepParticle() {
    const particleContainer = state.containerEl?.querySelector('#capylulu-particles');
    if (!particleContainer) return;

    const particle = document.createElement('div');
    particle.className = 'capylulu-particle';
    const types = ['✨', '⭐', '💫', '♪'];
    particle.textContent = types[Math.floor(Math.random() * types.length)];
    particle.style.left = (Math.random() * 60 + 10) + 'px';
    particle.style.bottom = '5px';
    particleContainer.appendChild(particle);

    // 动画结束后移除
    setTimeout(() => particle.remove(), 1200);
  }

  function spawnInteractionParticles() {
    const particleContainer = state.containerEl?.querySelector('#capylulu-particles');
    if (!particleContainer) return;

    const types = ['💛', '⭐', '✨', '💕', '♥', '🌟', '🎵'];
    for (let i = 0; i < 6; i++) {
      const particle = document.createElement('div');
      particle.className = 'capylulu-particle capylulu-particle-burst';
      particle.textContent = types[Math.floor(Math.random() * types.length)];
      const angle = (i / 6) * Math.PI * 2;
      const dist = 40 + Math.random() * 30;
      particle.style.setProperty('--bx', Math.cos(angle) * dist + 'px');
      particle.style.setProperty('--by', Math.sin(angle) * dist + 'px');
      particle.style.left = '40px';
      particle.style.top = '40px';
      particleContainer.appendChild(particle);
      setTimeout(() => particle.remove(), 1000);
    }
  }

  // ============ 拖拽交互 ============
  function setupDragInteraction() {
    const el = state.element;
    if (!el) return;

    el.addEventListener('mousedown', dragStart);
    el.addEventListener('touchstart', dragStart, { passive: false });

    document.addEventListener('mousemove', dragMove);
    document.addEventListener('touchmove', dragMove, { passive: false });

    document.addEventListener('mouseup', dragEnd);
    document.addEventListener('touchend', dragEnd);
  }

  function dragStart(e) {
    // 忽略右键和中间键
    if (e.button !== undefined && e.button !== 0) return;

    e.preventDefault();
    state.isDragging = true;

    const pos = getEventPos(e);
    state.dragStartX = pos.x;
    state.dragStartY = pos.y;

    const rect = state.containerEl.getBoundingClientRect();
    state.dragOffsetX = pos.x - rect.left;
    state.dragOffsetY = pos.y - rect.top;

    state.element.classList.add('dragging');
    state.element.classList.remove('walking', 'idle');

    if (state.walkAnimationId) {
      cancelAnimationFrame(state.walkAnimationId);
      state.walkAnimationId = null;
    }
    if (state.idleAnimationId) {
      cancelAnimationFrame(state.idleAnimationId);
      state.idleAnimationId = null;
    }
  }

  function dragMove(e) {
    if (!state.isDragging) return;
    e.preventDefault();

    const pos = getEventPos(e);
    let newX = pos.x - state.dragOffsetX;
    let newY = pos.y - state.dragOffsetY;

    // 边界限制
    newX = Math.max(0, Math.min(newX, window.innerWidth - CONFIG.petSize));
    newY = Math.max(0, Math.min(newY, window.innerHeight - CONFIG.petSize));

    state.containerEl.style.left = newX + 'px';
    state.containerEl.style.top = newY + 'px';
    state.containerEl.style.right = 'auto';
    state.containerEl.style.bottom = 'auto';

    state.positionX = newX;
    state.positionY = newY;
  }

  function dragEnd(e) {
    if (!state.isDragging) return;
    state.isDragging = false;
    state.element.classList.remove('dragging');

    // 如果正在打字，恢复行走
    if (state.isTyping) {
      startWalking();
    } else {
      startIdleAnimation();
    }
  }

  function getEventPos(e) {
    if (e.touches && e.touches.length > 0) {
      return { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
    return { x: e.clientX, y: e.clientY };
  }

  // ============ 点击互动 ============
  function setupClickInteraction() {
    const el = state.element;
    if (!el) return;

    let clickTimer = null;

    el.addEventListener('click', (e) => {
      // 区分拖拽结束时的误触
      if (state.isDragging) return;

      // 双击检测
      if (clickTimer) {
        clearTimeout(clickTimer);
        clickTimer = null;
        onDoubleClick();
        return;
      }

      clickTimer = setTimeout(() => {
        clickTimer = null;
        onSingleClick();
      }, 250);
    });
  }

  function onSingleClick() {
    // 显示随机对话气泡
    const messages = CONFIG.interactionMessages;
    const msg = messages[Math.floor(Math.random() * messages.length)];
    showBubble(msg);
    spawnInteractionParticles();

    // 跳跃动画
    state.element.classList.add('jump');
    setTimeout(() => state.element.classList.remove('jump'), 500);
  }

  function onDoubleClick() {
    // 双击：旋转特效
    state.element.classList.add('spin');
    setTimeout(() => state.element.classList.remove('spin'), 600);
    showBubble('哇！你双击了我！🎉💖');
    spawnInteractionParticles();
    // 双倍粒子
    setTimeout(() => spawnInteractionParticles(), 150);
  }

  function showBubble(text) {
    if (!state.bubbleEl) return;
    state.bubbleEl.textContent = text;
    state.bubbleEl.classList.remove('hidden');
    state.bubbleEl.classList.add('show');

    // 3秒后自动隐藏
    clearTimeout(state.bubbleTimer);
    state.bubbleTimer = setTimeout(() => {
      state.bubbleEl.classList.remove('show');
      state.bubbleEl.classList.add('hidden');
    }, 3000);
  }

  // ============ 窗口大小变化处理 ============
  function handleResize() {
    state.walkRange.maxX = Math.max(window.innerWidth - CONFIG.petSize - 10, 100);
    state.walkRange.maxY = Math.max(window.innerHeight - CONFIG.petSize - 10, 100);
    if (state.positionX > state.walkRange.maxX) {
      state.positionX = state.walkRange.maxX;
    }
    if (state.positionY > state.walkRange.maxY) {
      state.positionY = state.walkRange.maxY;
    }
  }

  // ============ 初始化 ============
  function init() {
    // 避免重复注入
    if (document.getElementById('capylulu-pet-container')) return;

    createPetElement();
    setupTypingDetection();
    window.addEventListener('resize', handleResize);

    // 启动待机动画
    startIdleAnimation();

    console.log('%c🐾 CAPYLULU 桌宠已启动!', 'color:#FFD93D;font-size:16px;font-weight:bold;');
    console.log('%c打字时我会陪你走动哦~ 💛', 'color:#FF9A3C;font-size:12px;');
  }

  // DOM 加载完成后初始化
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
