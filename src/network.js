
const networkLogs = new Map();

// Listen for extension installation
chrome.runtime.onInstalled.addListener((details) => {
  console.log('Bug Reporter extension installed', details);
  
  // Set default settings
  chrome.storage.sync.set({
    enabled: true,
    reportFormat: 'json'
  });
  
  // Add context menu items
  chrome.contextMenus.create({
    id: 'bugReporter',
    title: 'Generate Bug Report',
    contexts: ['page']
  });
});

// Capture network requests
chrome.webRequest.onBeforeRequest.addListener(
  (details) => {
    if (details.tabId > 0) {
      const tabLogs = networkLogs.get(details.tabId) || [];
      tabLogs.push({
        id: details.requestId,
        url: details.url,
        method: details.method,
        type: details.type,
        timestamp: new Date(details.timeStamp).toISOString(),
        requestBody: details.requestBody
      });
      // Keep only last 100 requests per tab to limit memory usage
      if (tabLogs.length > 100) {
        tabLogs.shift();
      }
      networkLogs.set(details.tabId, tabLogs);
    }
  },
  { urls: ["<all_urls>"] },
  ["requestBody"]
);

// Capture response headers (excluding Authorization)
chrome.webRequest.onCompleted.addListener(
  (details) => {
    if (details.tabId > 0) {
      const tabLogs = networkLogs.get(details.tabId) || [];
      const log = tabLogs.find(l => l.id === details.requestId);
      if (log) {
        log.statusCode = details.statusCode;
        log.statusLine = details.statusLine;
        // Filter out sensitive headers
        log.responseHeaders = details.responseHeaders?.filter(
          h => !['authorization', 'cookie', 'set-cookie'].includes(h.name.toLowerCase())
        );
      }
    }
  },
  { urls: ["<all_urls>"] },
  ["responseHeaders"]
);

// Clean up logs when tab is closed
chrome.tabs.onRemoved.addListener((tabId) => {
  networkLogs.delete(tabId);
});

// Listen for messages from popup or content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Message received in background:', request);
  
  if (request.action === 'getNetworkLogs') {
    const logs = networkLogs.get(request.tabId) || [];
    // Return last 100 requests
    sendResponse({ success: true, logs: logs.slice(-100) });
    return false;
  }
  
  if (request.action === 'clearNetworkLogs') {
    networkLogs.delete(request.tabId);
    sendResponse({ success: true });
    return false;
  }
  
  if (request.action === 'saveReport') {
    chrome.storage.local.set({ 
      lastReport: request.data,
      lastReportTime: new Date().toISOString()
    }, () => {
      sendResponse({ success: true });
    });
    return true;
  }
  
  return false;
});

// Context menu handler
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'bugReporter') {
    chrome.tabs.sendMessage(tab.id, { action: 'generateBugReport' });
  }
});
