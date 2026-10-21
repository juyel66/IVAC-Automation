import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  getCurrentStageIndex,
  getStageStatus,
  getStageSummaryText,
  STAGES
} from '../utils/workflowProgressHelper';
import { WorkflowSession } from '../types/workflow';

describe('WorkflowProgressHelper Unit Tests', () => {
  const originalLocation = window.location;

  beforeEach(() => {
    delete (window as any).location;
    window.location = {
      ...originalLocation,
      pathname: '/signin',
      href: 'https://appointment.ivacbd.com/signin'
    } as any;
  });

  afterEach(() => {
    window.location = originalLocation;
  });

  const createMockSession = (overrides?: Partial<WorkflowSession>): WorkflowSession => ({
    state: 'IDLE',
    activeProfileId: 'prof_1',
    detectedPage: 'LOGIN',
    currentDocumentIndex: 0,
    uploadedDocumentIds: [],
    errorMessage: null,
    isPaused: false,
    authStatus: 'idle',
    otpState: { isRequired: false, isSubmitting: false },
    captchaState: {
      isRequired: false,
      canVerifyAutomatically: true,
      isSolved: false,
      manualSubmissionRequired: false
    },
    logs: [],
    ...overrides
  });

  describe('1. Login Stage (Step 1)', () => {
    it('returns index 0 (Login) when on /signin in IDLE state', () => {
      const session = createMockSession({ state: 'IDLE', detectedPage: 'LOGIN' });
      const idx = getCurrentStageIndex(session, '/signin');
      expect(idx).toBe(0);

      expect(getStageStatus(0, idx, session.state)).toBe('active');
      for (let i = 1; i <= 5; i++) {
        expect(getStageStatus(i, idx, session.state)).toBe('pending');
      }
      expect(getStageSummaryText(session, idx)).toBe('1/6: Ready at Login');
    });

    it('returns index 0 (Login) when WAITING_FOR_CAPTCHA on /signin without marking Login completed', () => {
      const session = createMockSession({ state: 'WAITING_FOR_CAPTCHA', detectedPage: 'LOGIN' });
      const idx = getCurrentStageIndex(session, '/signin');
      expect(idx).toBe(0);

      // Login is active, not completed!
      expect(getStageStatus(0, idx, session.state)).toBe('active');
      expect(getStageStatus(1, idx, session.state)).toBe('pending');
      expect(getStageSummaryText(session, idx)).toBe('1/6: Verifying Turnstile...');
    });

    it('USER SCENARIO: when stopped on /signin, ONLY step 1 is active, steps 2-6 pending, zero checkmarks', () => {
      const session = createMockSession({ state: 'STOPPED', detectedPage: 'LOGIN' });
      const idx = getCurrentStageIndex(session, '/signin');
      expect(idx).toBe(0);

      // Step 1: Login is active (stopped here)
      expect(getStageStatus(0, idx, session.state)).toBe('active');
      // Steps 2-6: strictly pending (NEVER completed prematurely)
      for (let i = 1; i <= 5; i++) {
        expect(getStageStatus(i, idx, session.state)).toBe('pending');
      }
      expect(getStageSummaryText(session, idx)).toBe('1/6: Login (Stopped)');
    });
  });

  describe('2. OTP Stage (Step 2)', () => {
    it('returns index 1 when portal navigates to /otp or state is WAITING_FOR_OTP', () => {
      const session = createMockSession({ state: 'WAITING_FOR_OTP', detectedPage: 'OTP_VERIFICATION' });
      const idx = getCurrentStageIndex(session, '/otp');
      expect(idx).toBe(1);

      // Step 1 (Login) is genuinely completed!
      expect(getStageStatus(0, idx, session.state)).toBe('completed');
      // Step 2 (OTP) is active!
      expect(getStageStatus(1, idx, session.state)).toBe('active');
      // Steps 3-6 are pending
      for (let i = 2; i <= 5; i++) {
        expect(getStageStatus(i, idx, session.state)).toBe('pending');
      }
      expect(getStageSummaryText(session, idx)).toBe('2/6: Enter SMS OTP');
    });

    it('USER SCENARIO: when stopped on /otp, step 1 is completed, step 2 is active (stopped), steps 3-6 pending', () => {
      const session = createMockSession({ state: 'STOPPED', detectedPage: 'OTP_VERIFICATION' });
      const idx = getCurrentStageIndex(session, '/otp');
      expect(idx).toBe(1);

      expect(getStageStatus(0, idx, session.state)).toBe('completed');
      expect(getStageStatus(1, idx, session.state)).toBe('active');
      for (let i = 2; i <= 5; i++) {
        expect(getStageStatus(i, idx, session.state)).toBe('pending');
      }
      expect(getStageSummaryText(session, idx)).toBe('2/6: OTP (Stopped)');
    });
  });

  describe('3. Documents Stage (Step 3)', () => {
    it('returns index 2 when on /file-upload', () => {
      const session = createMockSession({ state: 'DOCUMENT_UPLOAD', detectedPage: 'DOCUMENT_UPLOAD' });
      const idx = getCurrentStageIndex(session, '/file-upload');
      expect(idx).toBe(2);

      expect(getStageStatus(0, idx, session.state)).toBe('completed');
      expect(getStageStatus(1, idx, session.state)).toBe('completed');
      expect(getStageStatus(2, idx, session.state)).toBe('active');
      for (let i = 3; i <= 5; i++) {
        expect(getStageStatus(i, idx, session.state)).toBe('pending');
      }
      expect(getStageSummaryText(session, idx)).toBe('3/6: Uploading Documents');
    });

    it('USER SCENARIO: when stopped on /file-upload, steps 1 & 2 are completed, step 3 is active (stopped)', () => {
      const session = createMockSession({ state: 'STOPPED', detectedPage: 'DOCUMENT_UPLOAD' });
      const idx = getCurrentStageIndex(session, '/file-upload');
      expect(idx).toBe(2);

      expect(getStageStatus(0, idx, session.state)).toBe('completed');
      expect(getStageStatus(1, idx, session.state)).toBe('completed');
      expect(getStageStatus(2, idx, session.state)).toBe('active');
      expect(getStageStatus(3, idx, session.state)).toBe('pending');
      expect(getStageStatus(4, idx, session.state)).toBe('pending');
      expect(getStageStatus(5, idx, session.state)).toBe('pending');
      expect(getStageSummaryText(session, idx)).toBe('3/6: Documents (Stopped)');
    });
  });

  describe('4. Centre Stage (Step 4)', () => {
    it('returns index 3 when on /mission', () => {
      const session = createMockSession({ state: 'CENTRE_SELECTION', detectedPage: 'CENTRE_SELECTION' });
      const idx = getCurrentStageIndex(session, '/mission');
      expect(idx).toBe(3);

      expect(getStageStatus(0, idx, session.state)).toBe('completed');
      expect(getStageStatus(1, idx, session.state)).toBe('completed');
      expect(getStageStatus(2, idx, session.state)).toBe('completed');
      expect(getStageStatus(3, idx, session.state)).toBe('active');
      expect(getStageStatus(4, idx, session.state)).toBe('pending');
      expect(getStageStatus(5, idx, session.state)).toBe('pending');
      expect(getStageSummaryText(session, idx)).toBe('4/6: Selecting Centre');
    });

    it('USER SCENARIO: when stopped on /mission, steps 1-3 are completed, step 4 is active (stopped)', () => {
      const session = createMockSession({ state: 'STOPPED', detectedPage: 'CENTRE_SELECTION' });
      const idx = getCurrentStageIndex(session, '/mission');
      expect(idx).toBe(3);

      expect(getStageStatus(0, idx, session.state)).toBe('completed');
      expect(getStageStatus(1, idx, session.state)).toBe('completed');
      expect(getStageStatus(2, idx, session.state)).toBe('completed');
      expect(getStageStatus(3, idx, session.state)).toBe('active');
      expect(getStageStatus(4, idx, session.state)).toBe('pending');
      expect(getStageStatus(5, idx, session.state)).toBe('pending');
      expect(getStageSummaryText(session, idx)).toBe('4/6: Centre (Stopped)');
    });
  });

  describe('5. Slot Stage (Step 5)', () => {
    it('returns index 4 when on /time-slot', () => {
      const session = createMockSession({ state: 'APPOINTMENT_SELECTION', detectedPage: 'APPOINTMENT_CALENDAR' });
      const idx = getCurrentStageIndex(session, '/time-slot');
      expect(idx).toBe(4);

      expect(getStageStatus(0, idx, session.state)).toBe('completed');
      expect(getStageStatus(1, idx, session.state)).toBe('completed');
      expect(getStageStatus(2, idx, session.state)).toBe('completed');
      expect(getStageStatus(3, idx, session.state)).toBe('completed');
      expect(getStageStatus(4, idx, session.state)).toBe('active');
      expect(getStageStatus(5, idx, session.state)).toBe('pending');
      expect(getStageSummaryText(session, idx)).toBe('5/6: Selecting Slot');
    });

    it('USER SCENARIO: when stopped on /time-slot, steps 1-4 are completed, step 5 is active (stopped)', () => {
      const session = createMockSession({ state: 'STOPPED', detectedPage: 'APPOINTMENT_CALENDAR' });
      const idx = getCurrentStageIndex(session, '/time-slot');
      expect(idx).toBe(4);

      for (let i = 0; i <= 3; i++) {
        expect(getStageStatus(i, idx, session.state)).toBe('completed');
      }
      expect(getStageStatus(4, idx, session.state)).toBe('active');
      expect(getStageStatus(5, idx, session.state)).toBe('pending');
      expect(getStageSummaryText(session, idx)).toBe('5/6: Slot (Stopped)');
    });
  });

  describe('6. Payment & Completion (Step 6)', () => {
    it('returns index 5 on /payment with manual handoff', () => {
      const session = createMockSession({ state: 'PAYMENT_HANDOFF', detectedPage: 'PAYMENT' });
      const idx = getCurrentStageIndex(session, '/payment');
      expect(idx).toBe(5);

      for (let i = 0; i <= 4; i++) {
        expect(getStageStatus(i, idx, session.state)).toBe('completed');
      }
      expect(getStageStatus(5, idx, session.state)).toBe('active');
      expect(getStageSummaryText(session, idx)).toBe('6/6: Payment Handoff (Manual)');
    });

    it('returns index 6 when state is COMPLETED (all 6 steps completed)', () => {
      const session = createMockSession({ state: 'COMPLETED' });
      const idx = getCurrentStageIndex(session, '/payment');
      expect(idx).toBe(6);

      for (let i = 0; i <= 5; i++) {
        expect(getStageStatus(i, idx, session.state)).toBe('completed');
      }
      expect(getStageSummaryText(session, idx)).toBe('6/6: All Completed');
    });
  });
});
