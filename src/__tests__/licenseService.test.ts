import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { licenseService } from '../services/licenseService';
import { workflowEngine } from '../features/workflow/workflowEngine';
import { IvacProfile } from '../types/profile';
import { credentialManager } from '../features/security/credentialManager';

describe('License Service & Workflow Gating Tests', () => {
  const dummyProfile: IvacProfile = {
    id: 'test_prof_lic_1',
    displayName: 'Test Applicant',
    mobileNumber: '01712345678',
    preferredCentre: 'IVAC, Dhaka (JFP)',
    primaryDocumentId: 'doc_1',
    additionalDocumentIds: [],
    encryptedPassword: 'enc_password',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  beforeEach(async () => {
    localStorage.clear();
    await licenseService.saveStoredLicense(null);
    licenseService.setStrictMode(false);
    credentialManager.setUnlockedPassword(dummyProfile.id, 'MySecretPass123!');
  });

  afterEach(() => {
    vi.restoreAllMocks();
    licenseService.setStrictMode(false);
  });

  it('1. Generates and persists unique installation UUID', async () => {
    const id1 = await licenseService.getInstallationId();
    expect(id1).toBeTruthy();
    expect(id1.startsWith('inst_')).toBe(true);

    const id2 = await licenseService.getInstallationId();
    expect(id1).toBe(id2);
  });

  it('2. Activates license successfully and saves client state', async () => {
    const mockApiResponse = {
      success: true,
      message: 'License activated',
      data: {
        licenseId: 'lic-12345',
        status: 'ACTIVE',
        activatedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 30 * 86400000).toISOString(),
        daysRemaining: 30,
        maxInstallations: 2,
        activeInstallationsCount: 1,
        availableSlots: 1,
      },
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockApiResponse,
    } as any);

    const result = await licenseService.activateLicense('IVAC-TEST-1234-5678');
    expect(result.success).toBe(true);
    expect(result.data?.status).toBe('ACTIVE');
    expect(result.data?.daysRemaining).toBe(30);

    const stored = await licenseService.getStoredLicense();
    expect(stored?.licenseKey).toBe('IVAC-TEST-1234-5678');
    expect(stored?.status).toBe('ACTIVE');
  });

  it('3. Handles slot limit reached error on activation', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 409,
      json: async () => ({
        success: false,
        message: 'Maximum browser installation limit reached (2/2).',
        error: { code: 'INSTALLATION_LIMIT_REACHED' },
      }),
    } as any);

    const result = await licenseService.activateLicense('IVAC-FULL-KEY-9999');
    expect(result.success).toBe(false);
    expect(result.error).toContain('limit reached');
  });

  it('4. Validates active license and detects expiration', async () => {
    await licenseService.saveStoredLicense({
      licenseKey: 'IVAC-KEY-EXP',
      licenseId: 'lic-exp',
      status: 'ACTIVE',
      expiresAt: new Date(Date.now() - 1000).toISOString(),
      daysRemaining: 0,
      maxInstallations: 1,
      activeInstallationsCount: 1,
      availableSlots: 0,
      installationId: 'inst_1',
      installationLabel: 'Chrome',
      lastValidatedAt: Date.now() - 3600000,
    });

    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({
        success: false,
        message: 'License has expired.',
        data: { status: 'EXPIRED', daysRemaining: 0 },
      }),
    } as any);

    const valResult = await licenseService.validateLicense(true);
    expect(valResult.isValid).toBe(false);
    expect(valResult.data?.status).toBe('EXPIRED');
  });

  it('5. Supports offline grace period within 24 hours', async () => {
    const validExpiry = new Date(Date.now() + 15 * 86400000).toISOString();
    await licenseService.saveStoredLicense({
      licenseKey: 'IVAC-OFFLINE-KEY',
      licenseId: 'lic-offline',
      status: 'ACTIVE',
      expiresAt: validExpiry,
      daysRemaining: 15,
      maxInstallations: 1,
      activeInstallationsCount: 1,
      availableSlots: 0,
      installationId: 'inst_1',
      installationLabel: 'Chrome',
      lastValidatedAt: Date.now() - 3600000, // 1 hour ago
    });

    // Simulate network error
    global.fetch = vi.fn().mockRejectedValue(new Error('Failed to fetch'));

    const valResult = await licenseService.validateLicense(true);
    expect(valResult.success).toBe(true);
    expect(valResult.isValid).toBe(true);
    expect(valResult.message).toContain('offline grace');
  });

  it('6. Releases installation slot on the backend and clears local storage', async () => {
    await licenseService.saveStoredLicense({
      licenseKey: 'IVAC-REL-KEY',
      licenseId: 'lic-rel',
      status: 'ACTIVE',
      daysRemaining: 20,
      maxInstallations: 1,
      activeInstallationsCount: 1,
      availableSlots: 0,
      installationId: 'inst_1',
      installationLabel: 'Chrome',
      lastValidatedAt: Date.now(),
    });

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        message: 'Browser installation released successfully.',
      }),
    } as any);

    const relResult = await licenseService.releaseInstallation();
    expect(relResult.success).toBe(true);

    const storedAfter = await licenseService.getStoredLicense();
    expect(storedAfter).toBeNull();
  });

  it('7. Fetches public payment instructions and plans', async () => {
    const mockPaymentData = {
      success: true,
      data: {
        settings: {
          bkashNumber: '01711223344',
          nagadNumber: '01811223344',
          whatsappNumber: '01711223344',
          instructionText: 'Send money and submit TrxID',
        },
        plans: [
          { code: 'PLAN_30D', name: '30 Days Standard', validityDays: 30, price: 1000, maxInstallations: 1, currency: 'BDT' },
        ],
      },
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockPaymentData,
    } as any);

    const instructions = await licenseService.getPaymentInstructions();
    expect(instructions.settings.bkashNumber).toBe('01711223344');
    expect(instructions.plans).toHaveLength(1);
  });

  it('8. Submits bKash payment request successfully', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          requestId: 'req-999',
          transactionId: 'TRX_TEST_123',
          status: 'PENDING',
          message: 'Received',
        },
      }),
    } as any);

    const payResult = await licenseService.submitPaymentRequest({
      transactionId: 'TRX_TEST_123',
      paymentMethod: 'BKASH',
      planCode: 'PLAN_30D',
      payerContact: '01799887766',
    });

    expect(payResult.success).toBe(true);
    expect(payResult.data?.requestId).toBe('req-999');
  });

  it('9. WorkflowEngine blocks workflow start when strict license check is enforced and no license exists', async () => {
    licenseService.setStrictMode(true);
    await licenseService.saveStoredLicense(null);

    await workflowEngine.start(dummyProfile);

    const session = workflowEngine.getSession();
    expect(session.state).toBe('ERROR');
    expect(session.errorMessage).toContain('Active premium license required');
  });

  it('10. WorkflowEngine allows workflow start when valid active license is present', async () => {
    licenseService.setStrictMode(true);
    await licenseService.saveStoredLicense({
      licenseKey: 'IVAC-VALID-KEY',
      status: 'ACTIVE',
      daysRemaining: 30,
      maxInstallations: 1,
      activeInstallationsCount: 1,
      availableSlots: 0,
      installationId: 'inst_1',
      installationLabel: 'Chrome',
      lastValidatedAt: Date.now(),
      expiresAt: new Date(Date.now() + 30 * 86400000).toISOString(),
    });

    // Reset workflow state to IDLE
    (workflowEngine as any).setState('IDLE');

    await workflowEngine.start(dummyProfile);

    const session = workflowEngine.getSession();
    // It should pass license check and proceed into workflow (e.g. PROFILE_SELECTED)
    expect(session.state).not.toBe('ERROR');
  });
});
