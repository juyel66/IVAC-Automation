/**
 * IVAC Assistant - License & Subscription Types
 */

export type LicenseStatus = 'PENDING' | 'ACTIVE' | 'EXPIRED' | 'SUSPENDED' | 'REVOKED' | 'UNLICENSED';

export type PaymentMethod = 'BKASH' | 'NAGAD' | 'ROCKET' | 'UPAY' | 'BANK';

export interface ClientLicenseState {
  licenseKey: string;
  licenseId?: string;
  status: LicenseStatus;
  activatedAt?: string;
  expiresAt?: string;
  daysRemaining: number;
  maxInstallations: number;
  activeInstallationsCount: number;
  availableSlots: number;
  installationId: string;
  installationLabel: string;
  lastValidatedAt: number;
  customerName?: string;
  customerContact?: string;
}

export interface PaymentPlan {
  code: string;
  name: string;
  validityDays: number;
  maxInstallations: number;
  price: number;
  currency: string;
}

export interface PaymentSettings {
  bkashNumber: string;
  nagadNumber: string;
  bankInstructions?: string | null;
  whatsappNumber: string;
  instructionText?: string | null;
}

export interface PublicPaymentInfo {
  settings: PaymentSettings;
  plans: PaymentPlan[];
}

export interface SubmitPaymentPayload {
  transactionId: string;
  paymentMethod: PaymentMethod;
  planCode: string;
  payerContact: string;
  licenseId?: string | null;
  customerName?: string | null;
}

export interface SubmitPaymentResult {
  requestId: string;
  transactionId: string;
  status: string;
  message: string;
}
