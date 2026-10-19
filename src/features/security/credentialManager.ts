import { IvacProfile } from '../../types/profile';
import { decryptPassword } from '../../utils/crypto';

class SessionCredentialManager {
  // In-memory cache holding decrypted passwords during active session
  // Never written to localStorage or chrome.storage
  private inMemoryVault: Map<string, string> = new Map();

  public setUnlockedPassword(profileId: string, password: string): void {
    this.inMemoryVault.set(profileId, password);
  }

  public getUnlockedPassword(profileId: string): string | null {
    return this.inMemoryVault.get(profileId) || null;
  }

  public isProfileUnlocked(profileId: string): boolean {
    return this.inMemoryVault.has(profileId);
  }

  public lockProfile(profileId: string): void {
    this.inMemoryVault.delete(profileId);
  }

  public lockAll(): void {
    this.inMemoryVault.clear();
  }

  /**
   * Attempts to decrypt and unlock a profile's IVAC password using the user's Master PIN
   */
  public async unlockWithPin(
    profile: IvacProfile,
    masterPin: string
  ): Promise<{ success: boolean; password?: string; error?: string }> {
    if (!profile.encryptedPassword || !profile.passwordSalt || !profile.passwordIv) {
      return {
        success: false,
        error: 'No encrypted credentials found for this profile. Please edit the profile to set a password.'
      };
    }

    try {
      const plaintext = await decryptPassword(
        {
          ciphertext: profile.encryptedPassword,
          salt: profile.passwordSalt,
          iv: profile.passwordIv
        },
        masterPin
      );

      this.setUnlockedPassword(profile.id, plaintext);
      return { success: true, password: plaintext };
    } catch (err: any) {
      return {
        success: false,
        error: err.message || 'Incorrect Master PIN.'
      };
    }
  }
}

export const credentialManager = new SessionCredentialManager();
