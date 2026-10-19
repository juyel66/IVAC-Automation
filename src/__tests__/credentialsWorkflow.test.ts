import { describe, it, expect, beforeEach } from 'vitest';
import { credentialManager } from '../features/security/credentialManager';
import { encryptPassword } from '../utils/crypto';
import { IvacProfile } from '../types/profile';
import { profileRepository } from '../storage/profileRepository';

describe('Credential Security & Unlock Workflow Tests', () => {
  const masterPin = '1234';
  const plainPassword = 'SuperSecretIvacPassword99!';

  beforeEach(() => {
    credentialManager.lockAll();
  });

  it('encrypts passwords using PBKDF2 + AES-GCM and generates unique salt and IV', async () => {
    const creds1 = await encryptPassword(plainPassword, masterPin);
    const creds2 = await encryptPassword(plainPassword, masterPin);

    // Cryptographic uniqueness: salts and IVs must differ even for identical plaintext & PIN
    expect(creds1.salt).not.toBe(creds2.salt);
    expect(creds1.iv).not.toBe(creds2.iv);
    expect(creds1.ciphertext).not.toBe(creds2.ciphertext);

    // Plaintext must not appear anywhere in the ciphertext
    expect(creds1.ciphertext).not.toContain(plainPassword);
  });

  it('keeps decrypted credentials strictly in memory and purges on lock', async () => {
    const profileId = 'prof_security_test';
    const encrypted = await encryptPassword(plainPassword, masterPin);

    const profile: IvacProfile = {
      id: profileId,
      displayName: 'Security Test Profile',
      mobileNumber: '01711223344',
      preferredCentre: 'Dhaka',
      encryptedPassword: encrypted.ciphertext,
      passwordSalt: encrypted.salt,
      passwordIv: encrypted.iv,
      additionalDocumentIds: [],
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    // Initially locked
    expect(credentialManager.isProfileUnlocked(profileId)).toBe(false);
    expect(credentialManager.getUnlockedPassword(profileId)).toBeNull();

    // Unlock with correct PIN
    const unlockRes = await credentialManager.unlockWithPin(profile, masterPin);
    expect(unlockRes.success).toBe(true);
    expect(unlockRes.password).toBe(plainPassword);
    expect(credentialManager.isProfileUnlocked(profileId)).toBe(true);
    expect(credentialManager.getUnlockedPassword(profileId)).toBe(plainPassword);

    // Lock profile
    credentialManager.lockProfile(profileId);
    expect(credentialManager.isProfileUnlocked(profileId)).toBe(false);
    expect(credentialManager.getUnlockedPassword(profileId)).toBeNull();
  });

  it('fails decryption when an invalid Master PIN is provided', async () => {
    const profileId = 'prof_wrong_pin';
    const encrypted = await encryptPassword(plainPassword, masterPin);

    const profile: IvacProfile = {
      id: profileId,
      displayName: 'Wrong PIN Profile',
      mobileNumber: '01711223344',
      preferredCentre: 'Dhaka',
      encryptedPassword: encrypted.ciphertext,
      passwordSalt: encrypted.salt,
      passwordIv: encrypted.iv,
      additionalDocumentIds: [],
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    const unlockRes = await credentialManager.unlockWithPin(profile, '9999');
    expect(unlockRes.success).toBe(false);
    expect(unlockRes.error).toContain('Incorrect Master PIN');
    expect(credentialManager.isProfileUnlocked(profileId)).toBe(false);
  });

  it('CONFIRMS persistent storage NEVER receives plaintext passwords', async () => {
    const profileId = 'prof_no_plaintext';
    const encrypted = await encryptPassword(plainPassword, masterPin);

    const profile: IvacProfile = {
      id: profileId,
      displayName: 'No Plaintext In Storage',
      mobileNumber: '01711223344',
      preferredCentre: 'Dhaka',
      encryptedPassword: encrypted.ciphertext,
      passwordSalt: encrypted.salt,
      passwordIv: encrypted.iv,
      additionalDocumentIds: [],
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    await profileRepository.saveProfile(profile);

    const storedProfiles = await profileRepository.getAllProfiles();
    const stored = storedProfiles.find(p => p.id === profileId);

    expect(stored).toBeDefined();
    // Verify stored object has only ciphertext
    expect(stored?.encryptedPassword).toBe(encrypted.ciphertext);
    // Explicitly verify plaintext does not appear in any property of stored profile
    const serialized = JSON.stringify(stored);
    expect(serialized).not.toContain(plainPassword);
  });

  it('simulates browser restart: in-memory cache is empty, profile requires unlock', async () => {
    const profileId = 'prof_restart_sim';
    const encrypted = await encryptPassword(plainPassword, masterPin);

    const profile: IvacProfile = {
      id: profileId,
      displayName: 'Restart Simulation Profile',
      mobileNumber: '01711223344',
      preferredCentre: 'Dhaka',
      encryptedPassword: encrypted.ciphertext,
      passwordSalt: encrypted.salt,
      passwordIv: encrypted.iv,
      additionalDocumentIds: [],
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    // User previously had profile unlocked
    credentialManager.setUnlockedPassword(profileId, plainPassword);
    expect(credentialManager.isProfileUnlocked(profileId)).toBe(true);

    // BROWSER RESTART SIMULATION:
    // Memory clears, content script context destroyed and reloaded
    credentialManager.lockAll();

    // Now after restart:
    expect(credentialManager.isProfileUnlocked(profileId)).toBe(false);
    expect(credentialManager.getUnlockedPassword(profileId)).toBeNull();

    // User must enter PIN to re-unlock
    const reUnlockRes = await credentialManager.unlockWithPin(profile, masterPin);
    expect(reUnlockRes.success).toBe(true);
    expect(reUnlockRes.password).toBe(plainPassword);
  });
});
