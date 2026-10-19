import { describe, it, expect, beforeEach } from 'vitest';
import { WorkflowEngine } from '../features/workflow/workflowEngine';
import { IvacProfile } from '../types/profile';

describe('WorkflowEngine State Machine', () => {
  let engine: WorkflowEngine;

  const validProfile: IvacProfile = {
    id: 'prof_test_1',
    displayName: 'Test Profile',
    mobileNumber: '01711223344',
    preferredCentre: 'Dhaka',
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
    additionalDocumentIds: [],
    createdAt: Date.now(),
    updatedAt: Date.now()
  };

  beforeEach(() => {
    engine = new WorkflowEngine();
  });

  it('initializes in IDLE state', () => {
    const session = engine.getSession();
    expect(session.state).toBe('IDLE');
    expect(session.isPaused).toBe(false);
    expect(session.errorMessage).toBeNull();
  });

  it('prevents starting when required primary PDF document is missing', async () => {
    await engine.start(profileWithoutDocs);
    const session = engine.getSession();
    expect(session.state).toBe('ERROR');
    expect(session.errorMessage).toContain('Primary applicant PDF document is required');
  });

  it('successfully starts workflow with ready profile', async () => {
    await engine.start(validProfile);
    const session = engine.getSession();
    expect(session.activeProfileId).toBe(validProfile.id);
    expect(session.errorMessage).toBeNull();
  });

  it('pauses and resumes without state loss', async () => {
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
    await engine.start(validProfile);
    engine.stop();
    const session = engine.getSession();
    expect(session.state).toBe('STOPPED');
  });

  it('reacts to payment page detection with mandatory safety stop (PAYMENT_HANDOFF)', async () => {
    await engine.start(validProfile);
    engine.setDetectedPage('PAYMENT');
    const session = engine.getSession();
    expect(session.state).toBe('PAYMENT_HANDOFF');
  });

  it('reacts to OTP verification detection by waiting for user', async () => {
    await engine.start(validProfile);
    engine.setDetectedPage('OTP_VERIFICATION');
    const session = engine.getSession();
    expect(session.state).toBe('WAITING_FOR_USER_AUTHENTICATION');
  });
});
