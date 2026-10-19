import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { profileRepository } from '../storage/profileRepository';
import { IvacProfile } from '../types/profile';

describe('ProfileRepository', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  const sampleProfile: IvacProfile = {
    id: 'test_prof_1',
    displayName: 'Dhaka Tourist Group',
    mobileNumber: '01912345678',
    preferredCentre: 'Dhaka',
    additionalDocumentIds: [],
    createdAt: Date.now(),
    updatedAt: Date.now()
  };

  it('saves and retrieves profiles', async () => {
    await profileRepository.saveProfile(sampleProfile);
    const profiles = await profileRepository.getAllProfiles();
    expect(profiles.length).toBe(1);
    expect(profiles[0].displayName).toBe('Dhaka Tourist Group');
    expect(profiles[0].mobileNumber).toBe('01912345678');
  });

  it('automatically sets first saved profile as active', async () => {
    await profileRepository.saveProfile(sampleProfile);
    const selectedId = await profileRepository.getSelectedProfileId();
    expect(selectedId).toBe(sampleProfile.id);
  });

  it('updates an existing profile', async () => {
    await profileRepository.saveProfile(sampleProfile);

    const updatedProfile: IvacProfile = {
      ...sampleProfile,
      displayName: 'Updated Profile Title',
      preferredCentre: 'Rajshahi'
    };

    await profileRepository.saveProfile(updatedProfile);
    const retrieved = await profileRepository.getProfileById(sampleProfile.id);
    expect(retrieved?.displayName).toBe('Updated Profile Title');
    expect(retrieved?.preferredCentre).toBe('Rajshahi');
  });

  it('deletes a profile and handles active selection cleanup', async () => {
    await profileRepository.saveProfile(sampleProfile);

    const secondProfile: IvacProfile = {
      id: 'test_prof_2',
      displayName: 'Second Profile',
      mobileNumber: '01799887766',
      preferredCentre: 'Sylhet',
      additionalDocumentIds: [],
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    await profileRepository.saveProfile(secondProfile);
    await profileRepository.setSelectedProfileId(sampleProfile.id);

    await profileRepository.deleteProfile(sampleProfile.id);
    const profiles = await profileRepository.getAllProfiles();
    expect(profiles.length).toBe(1);
    expect(profiles[0].id).toBe('test_prof_2');

    // Selected ID switches to remaining profile
    const selectedId = await profileRepository.getSelectedProfileId();
    expect(selectedId).toBe('test_prof_2');
  });
});
