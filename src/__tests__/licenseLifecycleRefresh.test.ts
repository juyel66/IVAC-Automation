import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { licenseService } from '../services/licenseService';
import { licenseClient } from '../features/license/licenseClient';
import { ClientLicenseState } from '../types/license';

describe('License Lifecycle, Persistence & Page Refresh Tests', () => {
  beforeEach(async () => {
    localStorage.clear();
    licenseClient.clearMemoryCache();
    await licenseService.saveStoredLicense(null);
    await licenseClient.saveLicenseState(null);
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('1. Generates and preserves a stable installation ID across concurrent calls and reloads', async () => {
    // Test concurrent calls on cold startup
    licenseClient.clearMemoryCache();
    const [id1, id2, id3] = await Promise.all([
      licenseClient.getInstallationId(),
      licenseClient.getInstallationId(),
      licenseService.getInstallationId(),
    ]);

    expect(id1).toBeTruthy();
    expect(id1).toBe(id2);
    expect(id1).toBe(id3);

    // Simulate page reload / memory cache wipe
    licenseClient.clearMemoryCache();
    const reloadedId = await licenseClient.getInstallationId();
    expect(reloadedId).toBe(id1);

    const serviceId = await licenseService.getInstallationId();
    expect(serviceId).toBe(id1);
  });

  it('2. Successful activation persists state to storage and synchronizes licenseClient and licenseService', async () => {
    const mockEntitlement = {
      licenseId: 'lic-uuid-999',
      status: 'ACTIVE',
      activatedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 30 * 86400000).toISOString(),
      daysRemaining: 30,
      maxInstallations: 2,
      activeInstallationsCount: 1,
      availableSlots: 1,
      signature: 'valid-sig-123',
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: mockEntitlement,
      }),
    } as any);

    let notifiedState: ClientLicenseState | null = null;
    licenseService.subscribe((lic) => {
      notifiedState = lic;
    });

    const activated = await licenseClient.activateLicense('IVAC-ABCD-1234-5678-9999');
    expect(activated.status).toBe('ACTIVE');
    expect(activated.daysRemaining).toBe(30);

    // Verify licenseService got synchronized immediately
    expect(notifiedState).not.toBeNull();
    expect((notifiedState as any)?.status).toBe('ACTIVE');

    const storedViaService = await licenseService.getStoredLicense();
    expect(storedViaService?.status).toBe('ACTIVE');
    expect(storedViaService?.licenseId).toBe('lic-uuid-999');
  });

  it('3. Page refresh after activation: cold memory reload restores ACTIVE status without flashing UNLICENSED', async () => {
    // 1. Simulate an activated license in storage
    const activeState: ClientLicenseState = {
      licenseKey: 'IVAC-PERSIST-1111-2222',
      licenseId: 'lic-persisted-1',
      status: 'ACTIVE',
      activatedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 25 * 86400000).toISOString(),
      daysRemaining: 25,
      maxInstallations: 2,
      activeInstallationsCount: 1,
      availableSlots: 1,
      lastCheckedAt: Date.now(),
      lastValidatedAt: Date.now(),
    };

    await licenseClient.saveLicenseState(activeState);

    // 2. Simulate complete page refresh / script reload
    licenseClient.clearMemoryCache();

    // 3. FloatingPanel on mount reads stored license first
    const restoredService = await licenseService.getStoredLicense();
    expect(restoredService).not.toBeNull();
    expect(restoredService?.status).toBe('ACTIVE');
    expect(restoredService?.daysRemaining).toBe(25);
    expect(restoredService?.licenseKey).toBe('IVAC-PERSIST-1111-2222');

    const restoredClient = await licenseClient.getStoredLicense();
    expect(restoredClient?.status).toBe('ACTIVE');
  });

  it('4. Background validation on refresh: confirms active license and updates timestamps', async () => {
    const activeState: ClientLicenseState = {
      licenseKey: 'IVAC-VALID-5555-6666',
      licenseId: 'lic-valid-55',
      status: 'ACTIVE',
      activatedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 20 * 86400000).toISOString(),
      daysRemaining: 20,
      maxInstallations: 1,
      activeInstallationsCount: 1,
      availableSlots: 0,
      lastCheckedAt: Date.now() - 3600000,
      lastValidatedAt: Date.now() - 3600000,
    };
    await licenseService.saveStoredLicense(activeState);

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          licenseId: 'lic-valid-55',
          status: 'ACTIVE',
          daysRemaining: 19,
          maxInstallations: 1,
          activeInstallationsCount: 1,
          availableSlots: 0,
          expiresAt: activeState.expiresAt,
          activatedAt: activeState.activatedAt,
          signature: 'sig-verified',
        },
      }),
    } as any);

    const valRes = await licenseService.validateLicense(true);
    expect(valRes.success).toBe(true);
    expect(valRes.isValid).toBe(true);
    expect(valRes.data?.daysRemaining).toBe(19);

    const stored = await licenseService.getStoredLicense();
    expect(stored?.daysRemaining).toBe(19);
  });

  it('5. Offline tolerance: remains ACTIVE within 24-hour grace period if backend is unreachable', async () => {
    const activeState: ClientLicenseState = {
      licenseKey: 'IVAC-OFFLINE-7777',
      licenseId: 'lic-offline-1',
      status: 'ACTIVE',
      activatedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 10 * 86400000).toISOString(),
      daysRemaining: 10,
      maxInstallations: 1,
      activeInstallationsCount: 1,
      availableSlots: 0,
      lastValidatedAt: Date.now() - 2 * 3600000, // Validated 2 hours ago (< 24h grace)
      lastCheckedAt: Date.now() - 2 * 3600000,
    };
    await licenseService.saveStoredLicense(activeState);

    // Mock network failure / server offline
    global.fetch = vi.fn().mockRejectedValue(new Error('Failed to fetch (net::ERR_CONNECTION_REFUSED)'));

    const valRes = await licenseService.validateLicense(true);
    expect(valRes.success).toBe(true);
    expect(valRes.isValid).toBe(true);
    expect(valRes.data?.status).toBe('ACTIVE');
    expect(valRes.message).toContain('offline grace period');
  });

  it('6. Offline policy: fails validation when offline tolerance exceeds 24 hours', async () => {
    const activeState: ClientLicenseState = {
      licenseKey: 'IVAC-EXPIRED-GRACE',
      licenseId: 'lic-expired-grace',
      status: 'ACTIVE',
      activatedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 10 * 86400000).toISOString(),
      daysRemaining: 10,
      maxInstallations: 1,
      activeInstallationsCount: 1,
      availableSlots: 0,
      lastValidatedAt: Date.now() - 25 * 3600000, // Validated 25 hours ago (> 24h grace)
      lastCheckedAt: Date.now() - 25 * 3600000,
    };
    await licenseService.saveStoredLicense(activeState);

    global.fetch = vi.fn().mockRejectedValue(new Error('Network offline'));

    const valRes = await licenseService.validateLicense(true);
    expect(valRes.isValid).toBe(false);
    expect(valRes.message).toContain('grace period expired');
  });

  it('7. Revocation & Expiry handling: updates stored state and blocks automation when revoked by server', async () => {
    const activeState: ClientLicenseState = {
      licenseKey: 'IVAC-REVOKED-KEY',
      licenseId: 'lic-revoked',
      status: 'ACTIVE',
      activatedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 10 * 86400000).toISOString(),
      daysRemaining: 10,
      maxInstallations: 1,
      activeInstallationsCount: 1,
      availableSlots: 0,
      lastValidatedAt: Date.now(),
    };
    await licenseService.saveStoredLicense(activeState);

    // Server returns 403 LICENSE_REVOKED
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({
        success: false,
        message: 'This license has been revoked by administration.',
        error: { code: 'LICENSE_REVOKED' },
      }),
    } as any);

    const valRes = await licenseService.validateLicense(true);
    expect(valRes.isValid).toBe(false);
    expect(valRes.data?.status).toBe('REVOKED');
    expect(valRes.data?.daysRemaining).toBe(0);

    const stored = await licenseService.getStoredLicense();
    expect(stored?.status).toBe('REVOKED');
  });

  it('8. Voluntary release clears activation state from local storage', async () => {
    const activeState: ClientLicenseState = {
      licenseKey: 'IVAC-RELEASE-KEY',
      licenseId: 'lic-rel',
      status: 'ACTIVE',
      activatedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 10 * 86400000).toISOString(),
      daysRemaining: 10,
      maxInstallations: 1,
      activeInstallationsCount: 1,
      availableSlots: 0,
      lastValidatedAt: Date.now(),
    };
    await licenseService.saveStoredLicense(activeState);

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        message: 'Browser installation slot successfully released.',
        data: { availableSlots: 1 },
      }),
    } as any);

    const releaseRes = await licenseService.releaseInstallation();
    expect(releaseRes.success).toBe(true);

    const storedAfter = await licenseService.getStoredLicense();
    expect(storedAfter).toBeNull();
  });
});
