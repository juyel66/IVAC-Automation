/**
 * IVAC Assistant - License & Subscription Types
 */

export type LicenseStatus =
  | 'PENDING'
  | 'ACTIVE'
  | 'EXPIRED'
  | 'SUSPENDED'
  | 'REVOKED'
  | 'UNLICENSED';

export type LicenseClientStatus = LicenseStatus;

export type PaymentMethod = 'BKASH' | 'NAGAD' | 'ROCKET' | 'UPAY' | 'BANK';

export interface ClientLicenseState {
  licenseKey: string;
  licenseId?: string | null;
  status: LicenseStatus;
  activatedAt?: string | null;
  expiresAt?: string | null;
  daysRemaining: number;
  maxInstallations: number;
  activeInstallationsCount: number;
  availableSlots: number;
  installationId?: string;
  installationLabel?: string;
  lastValidatedAt?: number;
  lastCheckedAt?: number;
  signature?: string;
  customerName?: string;
  customerContact?: string;
}

export interface PaymentPlan {
  id: string;
  code: string;
  name: string;
  validityDays: number;
  maxInstallations: number;
  price: number;
  currency: string;
  description?: string | null;
  isActive?: boolean;
  sortOrder?: number;
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
  planId?: string;
  planCode: string;
  payerContact: string;
  payerName?: string | null;
  licenseId?: string | null;
  customerName?: string | null;
}

export interface SubmitPaymentResult {
  requestId: string;
  transactionId: string;
  status: string;
  message: string;
  snapshot?: {
    planId?: string;
    planCode?: string;
    planName?: string;
    price?: number;
    currency?: string;
    validityDays?: number;
    maxInstallations?: number;
  };
}

export interface PaymentInstructionsData {
  settings: PaymentSettings;
  plans: PaymentPlan[];
}

export interface PaymentSubmissionInput {
  transactionId: string;
  paymentMethod: PaymentMethod;
  planId?: string;
  planCode?: string;
  payerContact: string;
  payerName?: string | null;
  customerName?: string | null;
  licenseId?: string | null;
}
