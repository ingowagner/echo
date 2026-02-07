console.log('Bug Reporter content script loaded on:', window.location.href);

const consoleMessages = [];

if (!window.__bugReporterInstalled) {
  window.__bugReporterInstalled = true;

  const originalConsole = {
    log: console.log,
    warn: console.warn,
    error: console.error,
    info: console.info
  };

  ['log', 'warn', 'error', 'info'].forEach(method => {
    console[method] = function(...args) {
      consoleMessages.push({
        type: method,
        timestamp: new Date().toISOString(),
        message: args.map(arg => {
          try {
            return typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg);
          } catch (e) {
            return String(arg);
          }
        }).join(' ')
      });
      
      if (consoleMessages.length > 100) {
        consoleMessages.shift();
      }
      
      originalConsole[method].apply(console, args);
    };
  });

  window.addEventListener('error', (event) => {
    consoleMessages.push({
      type: 'error',
      timestamp: new Date().toISOString(),
      message: `${event.message} at ${event.filename}:${event.lineno}:${event.colno}`,
      stack: event.error?.stack
    });
  });
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Message received in content script:', request);
  
  if (request.action === 'generateBugReport' || request.action === 'generateReport') {
    try {
      const report = {
        url: window.location.href,
        title: document.title,
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        viewport: {
          width: window.innerWidth,
          height: window.innerHeight
        },
        consoleLogs: consoleMessages.slice(-100), 
        pageErrors: consoleMessages.filter(m => m.type === 'error').slice(-20)
      };
      
      sendResponse({ success: true, data: report });
    } catch (error) {
      console.error('Error generating report:', error);
      sendResponse({ success: false, error: error.message });
    }
    return true; 
  }
  
  if (request.action === 'getConsoleLogs') {
    sendResponse({ success: true, logs: consoleMessages.slice(-100) });
    return true;
  }
  
  return false;
});
