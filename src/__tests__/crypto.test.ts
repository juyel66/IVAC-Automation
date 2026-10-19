import { describe, it, expect, beforeEach } from 'vitest';
import { encryptPassword, decryptPassword } from '../utils/crypto';
import { credentialManager } from '../features/security/credentialManager';
import { IvacProfile } from '../types/profile';

describe('Credential Security & WebCrypto AES-GCM', () => {
  const samplePassword = 'mySecretIvacPassword123!';
  const masterPin = '9876';

  beforeEach(() => {
    credentialManager.lockAll();
  });

  it('encrypts and decrypts a password with the correct Master PIN', async () => {
    const encrypted = await encryptPassword(samplePassword, masterPin);

    expect(encrypted.ciphertext).toBeDefined();
    expect(encrypted.ciphertext).not.toBe(samplePassword);
    expect(encrypted.salt).toBeDefined();
    expect(encrypted.iv).toBeDefined();

    const decrypted = await decryptPassword(encrypted, masterPin);
    expect(decrypted).toBe(samplePassword);
  });

  it('rejects decryption when an incorrect Master PIN is used', async () => {
    const encrypted = await encryptPassword(samplePassword, masterPin);
    await expect(decryptPassword(encrypted, 'wrongPin')).rejects.toThrow('Incorrect Master PIN');
  });

  it('produces different ciphertexts and IVs for the same password (fresh salt & IV)', async () => {
    const enc1 = await encryptPassword(samplePassword, masterPin);
    const enc2 = await encryptPassword(samplePassword, masterPin);

    expect(enc1.ciphertext).not.toBe(enc2.ciphertext);
    expect(enc1.iv).not.toBe(enc2.iv);
    expect(enc1.salt).not.toBe(enc2.salt);
  });

  it('manages in-memory unlocked credentials without persistent storage', async () => {
    const profileId = 'prof_test_crypto';
    expect(credentialManager.isProfileUnlocked(profileId)).toBe(false);

    credentialManager.setUnlockedPassword(profileId, samplePassword);
    expect(credentialManager.isProfileUnlocked(profileId)).toBe(true);
    expect(credentialManager.getUnlockedPassword(profileId)).toBe(samplePassword);

    credentialManager.lockProfile(profileId);
    expect(credentialManager.isProfileUnlocked(profileId)).toBe(false);
    expect(credentialManager.getUnlockedPassword(profileId)).toBeNull();
  });

  it('unlocks profile using unlockWithPin', async () => {
    const encrypted = await encryptPassword(samplePassword, masterPin);
    const profile: IvacProfile = {
      id: 'prof_unlock_test',
      displayName: 'Unlock Test',
      mobileNumber: '01711223344',
      preferredCentre: 'Dhaka',
      encryptedPassword: encrypted.ciphertext,
      passwordSalt: encrypted.salt,
      passwordIv: encrypted.iv,
      additionalDocumentIds: [],
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    // Wrong PIN
    const failRes = await credentialManager.unlockWithPin(profile, '0000');
    expect(failRes.success).toBe(false);
    expect(credentialManager.isProfileUnlocked(profile.id)).toBe(false);

    // Correct PIN
    const successRes = await credentialManager.unlockWithPin(profile, masterPin);
    expect(successRes.success).toBe(true);
    expect(successRes.password).toBe(samplePassword);
    expect(credentialManager.isProfileUnlocked(profile.id)).toBe(true);
  });
});
