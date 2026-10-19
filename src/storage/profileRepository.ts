import { IvacProfile } from '../types/profile';
import { documentRepository } from './documentRepository';

const PROFILES_STORAGE_KEY = 'ivac_assistant_profiles';
const SELECTED_PROFILE_KEY = 'ivac_assistant_selected_profile_id';

const memoryStore: Record<string, string> = {};

function getFallbackItem(key: string): string | null {
  try {
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem(key);
    }
  } catch {
    // ignore
  }
  return memoryStore[key] || null;
}

function setFallbackItem(key: string, val: string): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(key, val);
      return;
    }
  } catch {
    // ignore
  }
  memoryStore[key] = val;
}

function removeFallbackItem(key: string): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(key);
      return;
    }
  } catch {
    // ignore
  }
  delete memoryStore[key];
}

class ProfileRepository {
  private isChromeStorageAvailable(): boolean {
    return (
      typeof chrome !== 'undefined' &&
      !!chrome.storage &&
      !!chrome.storage.local
    );
  }

  async getAllProfiles(): Promise<IvacProfile[]> {
    if (this.isChromeStorageAvailable()) {
      return new Promise((resolve) => {
        chrome.storage.local.get([PROFILES_STORAGE_KEY], (result) => {
          const profiles = (result[PROFILES_STORAGE_KEY] as IvacProfile[]) || [];
          resolve(profiles);
        });
      });
    } else {
      try {
        const data = getFallbackItem(PROFILES_STORAGE_KEY);
        return data ? JSON.parse(data) : [];
      } catch {
        return [];
      }
    }
  }

  async getProfileById(id: string): Promise<IvacProfile | null> {
    const profiles = await this.getAllProfiles();
    return profiles.find((p) => p.id === id) || null;
  }

  async saveProfile(profile: IvacProfile): Promise<void> {
    const profiles = await this.getAllProfiles();
    const existingIndex = profiles.findIndex((p) => p.id === profile.id);

    const updatedProfile: IvacProfile = {
      ...profile,
      updatedAt: Date.now()
    };

    if (existingIndex >= 0) {
      profiles[existingIndex] = updatedProfile;
    } else {
      profiles.push(updatedProfile);
    }

    await this.setProfiles(profiles);

    // If no profile is selected, set this newly created profile as active
    const selectedId = await this.getSelectedProfileId();
    if (!selectedId) {
      await this.setSelectedProfileId(profile.id);
    }
  }

  async deleteProfile(id: string): Promise<void> {
    const profiles = await this.getAllProfiles();
    const filtered = profiles.filter((p) => p.id !== id);
    await this.setProfiles(filtered);

    // Clean up documents in IndexedDB
    try {
      await documentRepository.deleteDocumentsForProfile(id);
    } catch (err) {
      console.warn('Warning: Failed to clean up associated IndexedDB documents', err);
    }

    // Reset selected profile if this one was selected
    const selectedId = await this.getSelectedProfileId();
    if (selectedId === id) {
      const nextSelected = filtered.length > 0 ? filtered[0].id : null;
      await this.setSelectedProfileId(nextSelected);
    }
  }

  async getSelectedProfileId(): Promise<string | null> {
    if (this.isChromeStorageAvailable()) {
      return new Promise((resolve) => {
        chrome.storage.local.get([SELECTED_PROFILE_KEY], (result) => {
          resolve(result[SELECTED_PROFILE_KEY] || null);
        });
      });
    } else {
      try {
        return getFallbackItem(SELECTED_PROFILE_KEY);
      } catch {
        return null;
      }
    }
  }

  async setSelectedProfileId(id: string | null): Promise<void> {
    if (this.isChromeStorageAvailable()) {
      return new Promise((resolve) => {
        if (id) {
          chrome.storage.local.set({ [SELECTED_PROFILE_KEY]: id }, () => resolve());
        } else {
          chrome.storage.local.remove([SELECTED_PROFILE_KEY], () => resolve());
        }
      });
    } else {
      try {
        if (id) {
          setFallbackItem(SELECTED_PROFILE_KEY, id);
        } else {
          removeFallbackItem(SELECTED_PROFILE_KEY);
        }
      } catch {
        // ignore
      }
    }
  }

  private async setProfiles(profiles: IvacProfile[]): Promise<void> {
    if (this.isChromeStorageAvailable()) {
      return new Promise((resolve) => {
        chrome.storage.local.set({ [PROFILES_STORAGE_KEY]: profiles }, () => resolve());
      });
    } else {
      try {
        setFallbackItem(PROFILES_STORAGE_KEY, JSON.stringify(profiles));
      } catch (err) {
        console.error('Failed to save profiles to fallback storage', err);
      }
    }
  }
}

export const profileRepository = new ProfileRepository();
