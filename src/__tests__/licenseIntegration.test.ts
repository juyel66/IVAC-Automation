import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { licenseClient } from '../features/license/licenseClient';
import { workflowEngine } from '../features/workflow/workflowEngine';
import { IvacProfile } from '../types/profile';

describe('Extension License Integration & Enforcement Tests', () => {
  const dummyProfile: IvacProfile = {
    id: 'prof-test-1',
    displayName: 'Test Applicant',
    mobileNumber: '01712345678',
    preferredCentre: 'IVAC, Dhaka (JFP)',
    primaryDocumentId: 'doc-primary-1',
    encryptedPassword: 'ciphertext-dummy',
    passwordSalt: 'salt-dummy',
    passwordIv: 'iv-dummy',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  beforeEach(() => {
    localStorage.clear();
    licenseClient.clearMemoryCache();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    localStorage.clear();
    licenseClient.clearMemoryCache();
  });

  it('1. No-license state returns UNLICENSED and cannot start automation', async () => {
    // Force a fresh unlicensed check
    const lic = await licenseClient.validateLicense(true);
    expect(lic.status).toBe('UNLICENSED');

    const authCheck = await licenseClient.isWorkflowAuthorized();
    expect(authCheck.authorized).toBe(false);
    expect(authCheck.reason).toContain('UNLICENSED');

    // Attempting to start workflowEngine with unlicensed state must fail
    await workflowEngine.start(dummyProfile);
    expect(workflowEngine.getSession().state).toBe('ERROR');
    expect(workflowEngine.getSession().errorMessage).toContain('License');
  });

  it('2. Successful activation stores entitlement, signature, and permits automation', async () => {
    // Mock successful backend activation response
    const mockEntitlement = {
      licenseId: 'lic-uuid-1',
      status: 'ACTIVE',
      activatedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),
      daysRemaining: 30,
      maxInstallations: 2,
      activeInstallationsCount: 1,
      availableSlots: 1,
      signature: 'mocked-hmac-sha256-signature',
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: mockEntitlement,
      }),
    } as any);

    const activated = await licenseClient.activateLicense('IVAC-ABCD-EFGH-JKLM-NPQR');
    expect(activated.status).toBe('ACTIVE');
    expect(activated.daysRemaining).toBe(30);
    expect(activated.signature).toBe('mocked-hmac-sha256-signature');

    const auth = await licenseClient.isWorkflowAuthorized();
    expect(auth.authorized).toBe(true);
  });

  it('3. Installation limit reached handles 409 rejection gracefully', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 409,
      json: async () => ({
        success: false,
        message: 'Maximum browser installation limit reached (2/2). Please release another browser first.',
        error: { code: 'INSTALLATION_LIMIT_REACHED' },
      }),
    } as any);

    await expect(
      licenseClient.activateLicense('IVAC-ABCD-EFGH-JKLM-NPQR')
    ).rejects.toThrow('Maximum browser installation limit reached');
  });

  it('4. Expired license cannot start a new premium workflow', async () => {
    // Seed expired license into local storage
    const pastDate = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const expiredState = {
      licenseKey: 'IVAC-EXPR-KEYS-TEST-9999',
      licenseId: 'lic-expired-id',
      status: 'EXPIRED',
      activatedAt: new Date(Date.now() - 31 * 24 * 3600 * 1000).toISOString(),
      expiresAt: pastDate,
      daysRemaining: 0,
      maxInstallations: 1,
      activeInstallationsCount: 1,
      availableSlots: 0,
      lastCheckedAt: Date.now(),
    };
    localStorage.setItem('ivac_client_license_state', JSON.stringify(expiredState));

    const authCheck = await licenseClient.isWorkflowAuthorized();
    expect(authCheck.authorized).toBe(false);
    expect(authCheck.reason?.toUpperCase()).toContain('EXPIRED');

    await workflowEngine.start(dummyProfile);
    expect(workflowEngine.getSession().state).toBe('ERROR');
    expect(workflowEngine.getSession().errorMessage?.toUpperCase()).toContain('EXPIRED');
  });

  it('5. License revoked by admin disables premium workflow immediately upon validation', async () => {
    const activeState = {
      licenseKey: 'IVAC-REVOK-KEYS-TEST-1111',
      licenseId: 'lic-revoked-id',
      status: 'ACTIVE',
      activatedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),
      daysRemaining: 30,
      maxInstallations: 1,
      activeInstallationsCount: 1,
      availableSlots: 0,
      lastCheckedAt: 0, // force revalidation
    };
    localStorage.setItem('ivac_client_license_state', JSON.stringify(activeState));

    // Mock server returning 403 LICENSE_REVOKED
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({
        success: false,
        message: 'This license has been revoked by administration.',
        error: { code: 'LICENSE_REVOKED' },
      }),
    } as any);

    await expect(licenseClient.validateLicense(true)).rejects.toThrow('revoked');

    const stored = await licenseClient.getStoredLicense();
    expect(stored?.status).toBe('REVOKED');

    const auth = await licenseClient.isWorkflowAuthorized();
    expect(auth.authorized).toBe(false);
  });

  it('6. Successful installation release frees slot and resets local license state', async () => {
    const activeState = {
      licenseKey: 'IVAC-REL-KEYS-TEST-2222',
      licenseId: 'lic-rel-id',
      status: 'ACTIVE',
      activatedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),
      daysRemaining: 30,
      maxInstallations: 1,
      activeInstallationsCount: 1,
      availableSlots: 0,
      lastCheckedAt: Date.now(),
    };
    localStorage.setItem('ivac_client_license_state', JSON.stringify(activeState));

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        message: 'Browser installation released successfully. A license slot is now freed.',
      }),
    } as any);

    const res = await licenseClient.releaseInstallation();
    expect(res.success).toBe(true);

    const stored = await licenseClient.getStoredLicense();
    expect(stored?.status).toBe('UNLICENSED');
  });

  it('7. Temporary backend network error does not falsely claim the license expired when cache is fresh', async () => {
    const futureDate = new Date(Date.now() + 20 * 24 * 3600 * 1000).toISOString();
    const activeState = {
      licenseKey: 'IVAC-NET-KEYS-TEST-3333',
      licenseId: 'lic-net-id',
      status: 'ACTIVE',
      activatedAt: new Date().toISOString(),
      expiresAt: futureDate,
      daysRemaining: 20,
      maxInstallations: 1,
      activeInstallationsCount: 1,
      availableSlots: 0,
      lastCheckedAt: Date.now() - 10 * 60 * 1000, // expired cache
    };
    localStorage.setItem('ivac_client_license_state', JSON.stringify(activeState));

    // Fetch fails with network error
    global.fetch = vi.fn().mockRejectedValue(new Error('Failed to fetch (offline)'));

    // Should gracefully return cached active state without setting status to EXPIRED
    const verified = await licenseClient.validateLicense(false);
    expect(verified.status).toBe('ACTIVE');
    expect(verified.daysRemaining).toBe(20);
  });
});
