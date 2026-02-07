// Popup script for Bug Reporter extension

let currentReport = null;

document.addEventListener('DOMContentLoaded', function() {
  const reportBtn = document.getElementById('reportBtn');
  const downloadBtn = document.getElementById('downloadBtn');
  const copyBtn = document.getElementById('copyBtn');
  const statusDiv = document.getElementById('status');
  const reportDetails = document.getElementById('reportDetails');

  reportBtn.addEventListener('click', async function() {
    statusDiv.textContent = 'Generating bug report...';
    statusDiv.className = '';
    reportDetails.style.display = 'none';
    
    try {
      // Get the current active tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      // Check if we can access the tab
      if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
        throw new Error('Cannot capture data from Chrome internal pages');
      }
      
      statusDiv.textContent = 'Capturing page data...';
      
      // Try to get page data from content script
      let pageData;
      try {
        pageData = await chrome.tabs.sendMessage(tab.id, { 
          action: 'generateBugReport' 
        });
      } catch (error) {
        console.log('Content script not responding, using fallback data:', error);
        // Fallback if content script isn't loaded
        pageData = {
          success: true,
          data: {
            url: tab.url,
            title: tab.title,
            timestamp: new Date().toISOString(),
            userAgent: navigator.userAgent,
            viewport: {
              width: 0,
              height: 0
            },
            consoleLogs: [],
            pageErrors: []
          }
        };
      }
      
      statusDiv.textContent = 'Capturing network logs...';
      
      // Get network logs from background script
      const networkData = await chrome.runtime.sendMessage({ 
        action: 'getNetworkLogs',
        tabId: tab.id
      });
      
      statusDiv.textContent = 'Taking screenshot...';
      
      // Take screenshot
      const screenshot = await chrome.tabs.captureVisibleTab(null, {
        format: 'png'
      });
      
      // Compile the full report
      currentReport = {
        reportId: `bug-${Date.now()}`,
        generatedAt: new Date().toISOString(),
        page: pageData.data,
        network: {
          requests: networkData.logs || [],
          summary: {
            total: networkData.logs?.length || 0,
            failed: networkData.logs?.filter(l => l.statusCode >= 400).length || 0
          }
        },
        screenshot: screenshot
      };
      
      console.log('Report compiled:', {
        consoleLogs: currentReport.page.consoleLogs?.length || 0,
        networkRequests: currentReport.network.requests?.length || 0,
        hasScreenshot: !!currentReport.screenshot
      });
      
      // Save report
      await chrome.runtime.sendMessage({
        action: 'saveReport',
        data: currentReport
      });
      
      statusDiv.textContent = 'Bug report generated successfully!';
      statusDiv.className = 'success';
      reportDetails.style.display = 'flex';
      
    } catch (error) {
      console.error('Error:', error);
      statusDiv.textContent = 'Error: ' + error.message;
      statusDiv.className = 'error';
    }
  });
  
  downloadBtn.addEventListener('click', async function() {
    if (!currentReport) return;
    
    try {
      // Create a zip file with JSZip
      const zip = new JSZip();
      
      // Add bug report JSON (without screenshot)
      const reportData = {
        reportId: currentReport.reportId,
        generatedAt: currentReport.generatedAt,
        page: currentReport.page,
        network: currentReport.network
      };
      zip.file('bug-report.json', JSON.stringify(reportData, null, 2));
      
      // Add screenshot as PNG
      if (currentReport.screenshot) {
        const base64Data = currentReport.screenshot.split(',')[1];
        zip.file('screenshot.png', base64Data, { base64: true });
      }
      
      // Add console logs as JSON file with full details including stacktraces
      if (currentReport.page.consoleLogs && currentReport.page.consoleLogs.length > 0) {
        const consoleLogsJSON = currentReport.page.consoleLogs.map(log => {
          const logEntry = {
            timestamp: log.timestamp,
            type: log.type,
            message: log.message
          };
          
          // Include stack trace if available (for errors)
          if (log.stack) {
            logEntry.stack = log.stack;
          }
          
          return logEntry;
        });
        
        zip.file('console-logs.json', JSON.stringify(consoleLogsJSON, null, 2));
      } else {
        // Add empty array with note if no logs captured
        zip.file('console-logs.json', JSON.stringify({
          logs: [],
          note: 'No console logs captured. Console logs are only captured after the page is reloaded with the extension active.'
        }, null, 2));
      }
      
      // Add network logs as JSON with detailed headers
      if (currentReport.network.requests && currentReport.network.requests.length > 0) {
        const networkLogsJSON = currentReport.network.requests.map(req => {
          const logEntry = {
            timestamp: req.timestamp,
            method: req.method,
            url: req.url,
            type: req.type,
            statusCode: req.statusCode || null,
            statusLine: req.statusLine || null
          };
          
          // Process headers
          if (req.responseHeaders && req.responseHeaders.length > 0) {
            logEntry.responseHeaders = {};
            req.responseHeaders.forEach(header => {
              const headerName = header.name;
              const headerNameLower = headerName.toLowerCase();
              // Check if it's an authorization header
              if (headerNameLower === 'authorization') {
                logEntry.responseHeaders[headerName] = '[REDACTED - Authorization header present]';
                logEntry.hasAuthorizationHeader = true;
              } else {
                logEntry.responseHeaders[headerName] = header.value;
              }
            });
          }
          
          return logEntry;
        });
        
        zip.file('network-logs.json', JSON.stringify(networkLogsJSON, null, 2));
      }
      
      // Add failed requests summary as JSON
      const failedRequestsArray = currentReport.network.requests && currentReport.network.requests.length > 0
        ? currentReport.network.requests.filter(r => r.statusCode >= 400)
        : [];
      
      if (failedRequestsArray.length > 0) {
        const failedRequestsJSON = failedRequestsArray.map(req => ({
          timestamp: req.timestamp,
          method: req.method,
          url: req.url,
          type: req.type,
          statusCode: req.statusCode,
          statusLine: req.statusLine || null
        }));
        zip.file('failed-requests.json', JSON.stringify(failedRequestsJSON, null, 2));
      } else if (currentReport.network.requests && currentReport.network.requests.length > 0) {
        zip.file('failed-requests.json', JSON.stringify([], null, 2));
      }
      
      // Generate the zip blob
      const blob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);
      
      // Create filename from page title, sanitized for filesystem
      const sanitizedTitle = currentReport.page.title
        .replace(/[^a-z0-9]/gi, '_')
        .replace(/_+/g, '_')
        .substring(0, 100);
      
      // Download the zip file
      chrome.downloads.download({
        url: url,
        filename: `${sanitizedTitle}.zip`,
        saveAs: true
      });
      
      statusDiv.textContent = 'Report downloaded as ZIP!';
      statusDiv.className = 'success';
    } catch (error) {
      console.error('Error creating zip:', error);
      statusDiv.textContent = 'Error creating zip file: ' + error.message;
      statusDiv.className = 'error';
    }
  });
  
  copyBtn.addEventListener('click', async function() {
    if (!currentReport) return;
    
    // Create text summary for clipboard
    const pageErrors = currentReport.page.pageErrors || [];
    const consoleLogs = currentReport.page.consoleLogs || [];
    const requests = currentReport.network.requests || [];
    
    const summary = `
Bug Report
==========
Report ID: ${currentReport.reportId}
Generated: ${currentReport.generatedAt}

Page Information:
- URL: ${currentReport.page.url}
- Title: ${currentReport.page.title}
- User Agent: ${currentReport.page.userAgent}
- Viewport: ${currentReport.page.viewport.width}x${currentReport.page.viewport.height}

Console Errors (${pageErrors.length}):
${pageErrors.length > 0 ? pageErrors.map(e => `[${e.timestamp}] ${e.message}`).join('\n') : 'No errors captured'}

Network Summary:
- Total Requests: ${currentReport.network.summary.total}
- Failed Requests: ${currentReport.network.summary.failed}

Failed Network Requests:
${requests.filter(r => r.statusCode >= 400).length > 0 
  ? requests.filter(r => r.statusCode >= 400).map(r => `- [${r.statusCode}] ${r.method} ${r.url}`).join('\n')
  : 'No failed requests'}

Recent Console Logs (last 10):
${consoleLogs.length > 0 
  ? consoleLogs.slice(-10).map(log => `[${log.type.toUpperCase()}] ${log.message}`).join('\n')
  : 'No console logs captured'}

Note: For best results, reload the page with the extension active before capturing the report.
    `.trim();
    
    try {
      await navigator.clipboard.writeText(summary);
      statusDiv.textContent = 'Report copied to clipboard!';
      statusDiv.className = 'success';
    } catch (error) {
      statusDiv.textContent = 'Failed to copy to clipboard';
      statusDiv.className = 'error';
    }
  });
});
