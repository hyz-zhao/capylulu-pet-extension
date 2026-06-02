/**
 * CAPYLULU 桌宠 - Background Service Worker
 * 处理扩展安装、图标点击、消息通信
 */

// 扩展安装/更新时执行
chrome.runtime.onInstalled.addListener((details) => {
  console.log('🐾 CAPYLULU 桌宠已安装！', details.reason);

  if (details.reason === 'install') {
    // 首次安装时打开欢迎页
    chrome.tabs.create({
      url: chrome.runtime.getURL('popup.html?welcome=1'),
    });
  }
});

// 处理来自 content script 的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'CAPYLULU_PING') {
    sendResponse({ status: 'ok', message: 'CAPYLULU 后台在线 🐾' });
  }

  if (message.type === 'CAPYLULU_LOG') {
    console.log('[CAPYLULU]', ...message.data);
  }

  return true; // 保持消息通道开放（异步响应）
});

// 点击扩展图标时的行为
chrome.action.onClicked.addListener((tab) => {
  // 如果已有 popup.html，则不会触发此事件
  // 这里作为备用：在当前页面注入/移除桌宠
  chrome.tabs.sendMessage(tab.id, { type: 'CAPYLULU_TOGGLE' }, (response) => {
    if (chrome.runtime.lastError) {
      // content script 未加载，尝试注入
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content.js'],
      });
      chrome.scripting.insertCSS({
        target: { tabId: tab.id },
        files: ['style.css'],
      });
    }
  });
});

// 监听标签页更新，确保桌宠在新页面也能运行
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    // content script 已通过 manifest 的 content_scripts 自动注入
    // 这里可以做一些额外的初始化工作
  }
});

console.log('🐾 CAPYLULU 桌宠后台服务已启动');
