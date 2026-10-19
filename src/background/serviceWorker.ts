/**
 * IVAC Booking Assistant - Background Service Worker (Manifest V3)
 */

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('[IVAC Assistant] Extension installed successfully.');
    // Set default badge
    chrome.action.setBadgeText({ text: 'IVAC' });
    chrome.action.setBadgeBackgroundColor({ color: '#16a34a' });
  } else if (details.reason === 'update') {
    console.log('[IVAC Assistant] Extension updated to new version.');
  }
});

// Handle incoming messages from content scripts or popup
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'PING') {
    sendResponse({ status: 'PONG', timestamp: Date.now() });
    return true;
  }

  if (message.type === 'GET_EXTENSION_INFO') {
    sendResponse({
      name: 'IVAC Booking Assistant',
      version: chrome.runtime.getManifest().version,
      targetDomain: 'appointment.ivacbd.com'
    });
    return true;
  }
});
