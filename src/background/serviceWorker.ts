/**
 * IVAC Booking Assistant - Background Service Worker (Manifest V3)
 * Handles installation lifecycle, periodic alarms, and license badge synchronization.
 */

import { licenseService } from '../services/licenseService';

const LICENSE_ALARM_NAME = 'ivac_periodic_license_check';

async function updateExtensionBadge() {
  try {
    const isLicensed = await licenseService.hasActiveLicense();
    if (isLicensed) {
      chrome.action.setBadgeText({ text: 'PRO' });
      chrome.action.setBadgeBackgroundColor({ color: '#16a34a' });
    } else {
      chrome.action.setBadgeText({ text: 'FREE' });
      chrome.action.setBadgeBackgroundColor({ color: '#64748b' });
    }
  } catch {
    chrome.action.setBadgeText({ text: 'IVAC' });
    chrome.action.setBadgeBackgroundColor({ color: '#16a34a' });
  }
}

chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'install') {
    console.log('[IVAC Assistant] Extension installed successfully.');
  } else if (details.reason === 'update') {
    console.log('[IVAC Assistant] Extension updated to new version.');
  }

  // Setup periodic license check alarm (every 6 hours)
  if (typeof chrome.alarms !== 'undefined') {
    chrome.alarms.create(LICENSE_ALARM_NAME, {
      delayInMinutes: 5,
      periodInMinutes: 360,
    });
  }

  await updateExtensionBadge();
});

// Alarm listener
if (typeof chrome.alarms !== 'undefined') {
  chrome.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name === LICENSE_ALARM_NAME) {
      try {
        await licenseService.validateLicense(false);
        await licenseService.heartbeat();
        await updateExtensionBadge();
      } catch (err) {
        console.warn('[IVAC Assistant] Background license check warning:', err);
      }
    }
  });
}

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
      targetDomain: 'appointment.ivacbd.com',
    });
    return true;
  }

  if (message.type === 'REFRESH_LICENSE_BADGE') {
    updateExtensionBadge().then(() => sendResponse({ success: true }));
    return true;
  }

  // Proxy network requests from content scripts to bypass web page CORS and Mixed Content (HTTPS -> HTTP)
  if (message.type === 'LICENSE_API_FETCH') {
    const { url, options } = message.payload || {};
    fetch(url, options)
      .then(async (res) => {
        const body = await res.json().catch(() => ({}));
        sendResponse({
          ok: res.ok,
          status: res.status,
          body,
        });
      })
      .catch((err) => {
        sendResponse({
          ok: false,
          status: 0,
          body: {},
          error: err.message || 'Network request failed',
        });
      });
    return true; // Keep message port open for async response
  }
});
