import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { licenseClient } from '../features/license/licenseClient';
import { licenseService } from '../services/licenseService';
import { PaymentPlan } from '../types/license';

describe('Dynamic Subscription Pricing & Plans Integration Tests', () => {
  beforeEach(() => {
    licenseClient.clearMemoryCache();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('1. Fetches dynamic plans from GET /api/v1/public/plans with complete attributes', async () => {
    const mockPlans: PaymentPlan[] = [
      {
        id: 'plan_db_uuid_1',
        code: 'PLAN_7D',
        name: 'Weekly Sprint Pass',
        validityDays: 7,
        maxInstallations: 1,
        price: 350,
        currency: 'BDT',
        description: 'Ideal for single fast-track IVAC appointment booking',
        isActive: true,
      },
      {
        id: 'plan_db_uuid_2',
        code: 'PLAN_30D',
        name: 'Monthly Pro Access',
        validityDays: 30,
        maxInstallations: 3,
        price: 1200,
        currency: 'BDT',
        description: 'Multi-device pass with priority booking slots',
        isActive: true,
      },
      {
        id: 'plan_db_uuid_3',
        code: 'PLAN_365D',
        name: 'Annual Agency Enterprise',
        validityDays: 365,
        maxInstallations: 10,
        price: 9999,
        currency: 'BDT',
        description: 'Dedicated enterprise agency access for high volume operations',
        isActive: true,
      },
    ];

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: mockPlans,
      }),
    } as any);

    const plans = await licenseClient.getPublicPlans();

    expect(plans).toHaveLength(3);
    expect(plans[0].id).toBe('plan_db_uuid_1');
    expect(plans[0].name).toBe('Weekly Sprint Pass');
    expect(plans[0].price).toBe(350);
    expect(plans[0].currency).toBe('BDT');
    expect(plans[0].validityDays).toBe(7);
    expect(plans[0].maxInstallations).toBe(1);
    expect(plans[0].description).toBe('Ideal for single fast-track IVAC appointment booking');

    expect(plans[2].maxInstallations).toBe(10);
    expect(plans[2].validityDays).toBe(365);
    expect(plans[2].price).toBe(9999);
  });

  it('2. Caches dynamic plans and respects forceRefresh parameter', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: [{ id: 'plan_1', code: 'P1', name: 'Plan 1', price: 100, currency: 'BDT', validityDays: 30, maxInstallations: 1 }],
      }),
    } as any);
    global.fetch = fetchSpy;

    // First call fetches from network
    const firstCall = await licenseClient.getPublicPlans(false);
    expect(firstCall).toHaveLength(1);
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    // Second call without forceRefresh returns cached plans without extra fetch
    const secondCall = await licenseClient.getPublicPlans(false);
    expect(secondCall).toHaveLength(1);
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    // Third call with forceRefresh=true forces a network request
    const thirdCall = await licenseClient.getPublicPlans(true);
    expect(thirdCall).toHaveLength(1);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('3. Handles empty plan list gracefully', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: [],
      }),
    } as any);

    const plans = await licenseClient.getPublicPlans();
    expect(plans).toEqual([]);
  });

  it('4. Handles API failures and errors cleanly', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({
        success: false,
        message: 'Database connection failed while fetching plans',
      }),
    } as any);

    await expect(licenseClient.getPublicPlans()).rejects.toThrow(
      'Database connection failed while fetching plans'
    );
  });

  it('5. Submits payment request retaining planId without client-authoritative price', async () => {
    let capturedBody: any = null;
    global.fetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
      if (url.includes('/payments/requests')) {
        capturedBody = JSON.parse(init?.body as string);
        return {
          ok: true,
          status: 201,
          json: async () => ({
            success: true,
            data: {
              requestId: 'req_sub_777',
              transactionId: capturedBody.transactionId,
              status: 'PENDING',
              message: 'Payment request received. Awaiting admin review.',
              snapshot: {
                planId: capturedBody.planId,
                planCode: capturedBody.planCode,
                planName: 'Monthly Pro Access',
                price: 1200,
                currency: 'BDT',
                validityDays: 30,
                maxInstallations: 3,
              },
            },
          }),
        };
      }
      return { ok: false, status: 404, json: async () => ({}) };
    });

    const submissionResult = await licenseClient.submitPaymentRequest({
      transactionId: 'TRX-BKASH-888999',
      paymentMethod: 'BKASH',
      planId: 'plan_db_uuid_2',
      planCode: 'PLAN_30D',
      payerContact: '01712345678',
      payerName: 'Md Juyel Rana',
    });

    expect(capturedBody).toBeDefined();
    expect(capturedBody.transactionId).toBe('TRX-BKASH-888999');
    expect(capturedBody.planId).toBe('plan_db_uuid_2');
    expect(capturedBody.planCode).toBe('PLAN_30D');
    expect(capturedBody.payerContact).toBe('01712345678');
    expect(capturedBody.payerName).toBe('Md Juyel Rana');
    // Ensure client NEVER dictates price, validity, or maxInstallations
    expect(capturedBody.price).toBeUndefined();
    expect(capturedBody.amount).toBeUndefined();
    expect(capturedBody.validityDays).toBeUndefined();
    expect(capturedBody.maxInstallations).toBeUndefined();

    // Verify response snapshot confirmed by server
    expect(submissionResult.requestId).toBe('req_sub_777');
    expect(submissionResult.status).toBe('PENDING');
    expect(submissionResult.snapshot?.price).toBe(1200);
    expect(submissionResult.snapshot?.validityDays).toBe(30);
  });

  it('6. Invalidates cached plans if backend rejects payment due to inactive or changed plan', async () => {
    // 1. Populate cache first
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: [{ id: 'plan_old', code: 'OLD', name: 'Old Plan', price: 500, currency: 'BDT', validityDays: 15, maxInstallations: 1 }],
      }),
    } as any);

    const initialPlans = await licenseClient.getPublicPlans();
    expect(initialPlans).toHaveLength(1);

    // 2. Mock payment failure with INVALID_PLAN
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({
        success: false,
        message: 'The selected plan is no longer active or does not exist.',
        error: { code: 'INVALID_PLAN' },
      }),
    } as any);

    await expect(
      licenseClient.submitPaymentRequest({
        transactionId: 'TRX_DEACTIVATED',
        paymentMethod: 'NAGAD',
        planId: 'plan_old',
        payerContact: '01899998888',
      })
    ).rejects.toThrow('no longer active');

    // 3. Verify cache was invalidated by confirming next getPublicPlans triggers a fetch
    const fetchAfterInvalidation = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: [{ id: 'plan_new', code: 'NEW', name: 'New Plan', price: 600, currency: 'BDT', validityDays: 20, maxInstallations: 2 }],
      }),
    } as any);
    global.fetch = fetchAfterInvalidation;

    const refreshedPlans = await licenseClient.getPublicPlans(false);
    expect(refreshedPlans[0].id).toBe('plan_new');
    expect(fetchAfterInvalidation).toHaveBeenCalledTimes(1);
  });

  it('7. licenseService.getPublicPlans calls fetchApi with /public/plans', async () => {
    const fetchApiSpy = vi.spyOn(licenseService, 'fetchApi').mockResolvedValue({
      ok: true,
      status: 200,
      body: {
        success: true,
        data: [
          {
            id: 'plan_service_1',
            code: 'PLAN_SERVICE',
            name: 'Service Plan',
            price: 800,
            currency: 'BDT',
            validityDays: 15,
            maxInstallations: 2,
          },
        ],
      },
    });

    const result = await licenseService.getPublicPlans();
    expect(fetchApiSpy).toHaveBeenCalledWith('/public/plans', { method: 'GET' });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('plan_service_1');
    expect(result[0].price).toBe(800);
  });
});
