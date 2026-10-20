import { describe, it, expect, beforeEach } from 'vitest';
import { WorkflowEngine } from '../features/workflow/workflowEngine';
import { IvacProfile } from '../types/profile';
import { credentialManager } from '../features/security/credentialManager';

describe('WorkflowEngine State Machine & Authentication', () => {
  let engine: WorkflowEngine;

  const validProfile: IvacProfile = {
    id: 'prof_test_1',
    displayName: 'Test Profile',
    mobileNumber: '01711223344',
    preferredCentre: 'Dhaka',
    encryptedPassword: 'mockEncryptedPassword',
    passwordSalt: 'mockSalt',
    passwordIv: 'mockIv',
    primaryDocumentId: 'doc_primary_1',
    additionalDocumentIds: ['doc_add_1'],
    createdAt: Date.now(),
    updatedAt: Date.now()
  };

  const profileWithoutDocs: IvacProfile = {
    id: 'prof_no_docs',
    displayName: 'Incomplete Profile',
    mobileNumber: '01811223344',
    preferredCentre: 'Rajshahi',
    encryptedPassword: 'mockEncryptedPassword',
    passwordSalt: 'mockSalt',
    passwordIv: 'mockIv',
    additionalDocumentIds: [],
    createdAt: Date.now(),
    updatedAt: Date.now()
  };

  beforeEach(() => {
    credentialManager.lockAll();
    engine = new WorkflowEngine();
  });

  it('initializes in IDLE state with default auth and OTP properties', () => {
    const session = engine.getSession();
    expect(session.state).toBe('IDLE');
    expect(session.isPaused).toBe(false);
    expect(session.errorMessage).toBeNull();
    expect(session.authStatus).toBe('idle');
    expect(session.otpState.isRequired).toBe(false);
  });

  it('prevents starting when required primary PDF document is missing', async () => {
    credentialManager.setUnlockedPassword(profileWithoutDocs.id, 'plainPassword');
    await engine.start(profileWithoutDocs);
    const session = engine.getSession();
    expect(session.state).toBe('ERROR');
    expect(session.errorMessage).toContain('Primary applicant PDF document is required');
  });

  it('prevents starting when profile password is locked', async () => {
    // Note: password is NOT unlocked in credentialManager
    await engine.start(validProfile);
    const session = engine.getSession();
    expect(session.state).toBe('ERROR');
    expect(session.errorMessage).toContain('Profile password is locked');
  });

  it('successfully starts workflow when profile is ready and unlocked', async () => {
    credentialManager.setUnlockedPassword(validProfile.id, 'plainPassword123');
    await engine.start(validProfile);
    const session = engine.getSession();
    expect(session.activeProfileId).toBe(validProfile.id);
    expect(session.errorMessage).toBeNull();
  });

  it('activates OTP input section when OTP_VERIFICATION page is detected', async () => {
    credentialManager.setUnlockedPassword(validProfile.id, 'plainPassword123');
    await engine.start(validProfile);
    engine.setDetectedPage('OTP_VERIFICATION');

    const session = engine.getSession();
    expect(session.state).toBe('WAITING_FOR_OTP');
    expect(session.authStatus).toBe('awaiting_otp');
    expect(session.otpState.isRequired).toBe(true);
  });

  it('rejects invalid OTP submission with formatting error message', async () => {
    credentialManager.setUnlockedPassword(validProfile.id, 'plainPassword123');
    await engine.start(validProfile);
    engine.setDetectedPage('OTP_VERIFICATION');

    const res = await engine.submitOtpVerification('12ab'); // invalid non-numeric
    expect(res.success).toBe(false);
    expect(res.message).toContain('numbers only');

    const session = engine.getSession();
    expect(session.otpState.errorMessage).toContain('numbers only');
  });

  it('pauses and resumes without state loss', async () => {
    credentialManager.setUnlockedPassword(validProfile.id, 'plainPassword123');
    await engine.start(validProfile);
    engine.setState('CENTRE_SELECTION');

    engine.pause('Testing pause');
    let session = engine.getSession();
    expect(session.state).toBe('PAUSED');
    expect(session.isPaused).toBe(true);
    expect(session.pausedReason).toBe('Testing pause');

    engine.resume();
    session = engine.getSession();
    expect(session.state).toBe('CENTRE_SELECTION');
    expect(session.isPaused).toBe(false);
  });

  it('stops workflow cleanly on user request', async () => {
    credentialManager.setUnlockedPassword(validProfile.id, 'plainPassword123');
    await engine.start(validProfile);
    engine.stop();
    const session = engine.getSession();
    expect(session.state).toBe('STOPPED');
  });

  it('reacts to payment page detection with mandatory safety stop (PAYMENT_HANDOFF)', async () => {
    credentialManager.setUnlockedPassword(validProfile.id, 'plainPassword123');
    await engine.start(validProfile);
    engine.setDetectedPage('PAYMENT');
    const session = engine.getSession();
    expect(session.state).toBe('PAYMENT_HANDOFF');
  });
});
