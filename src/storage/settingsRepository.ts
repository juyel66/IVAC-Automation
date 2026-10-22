export interface ExtensionSettings {
  panelPosition: { x: number; y: number };
  isMinimized: boolean;
  isClosed: boolean;
  autoFillEnabled: boolean;
  soundAlertsEnabled: boolean;
  stayWithinViewport: boolean;
  licenseApiUrl: string;
}

const DEFAULT_SETTINGS: ExtensionSettings = {
  panelPosition: { x: 24, y: 24 }, // Top-right offset default
  isMinimized: false,
  isClosed: false,
  autoFillEnabled: true,
  soundAlertsEnabled: true,
  stayWithinViewport: true,
  licenseApiUrl: 'http://localhost:5000/api/v1'
};

const SETTINGS_STORAGE_KEY = 'ivac_assistant_settings';

class SettingsRepository {
  private isChromeStorage(): boolean {
    return (
      typeof chrome !== 'undefined' &&
      !!chrome.storage &&
      !!chrome.storage.local
    );
  }

  async getSettings(): Promise<ExtensionSettings> {
    if (this.isChromeStorage()) {
      return new Promise((resolve) => {
        chrome.storage.local.get([SETTINGS_STORAGE_KEY], (res) => {
          resolve({ ...DEFAULT_SETTINGS, ...(res[SETTINGS_STORAGE_KEY] || {}) });
        });
      });
    } else {
      try {
        const item = localStorage.getItem(SETTINGS_STORAGE_KEY);
        return item ? { ...DEFAULT_SETTINGS, ...JSON.parse(item) } : DEFAULT_SETTINGS;
      } catch {
        return DEFAULT_SETTINGS;
      }
    }
  }

  async saveSettings(settings: Partial<ExtensionSettings>): Promise<ExtensionSettings> {
    const current = await this.getSettings();
    const updated: ExtensionSettings = { ...current, ...settings };

    if (this.isChromeStorage()) {
      return new Promise((resolve) => {
        chrome.storage.local.set({ [SETTINGS_STORAGE_KEY]: updated }, () => {
          resolve(updated);
        });
      });
    } else {
      try {
        localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(updated));
      } catch {
        // ignore
      }
      return updated;
    }
  }
}

export const settingsRepository = new SettingsRepository();
