<<<<<<< HEAD
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
=======
export type LicenseClientStatus =
  | 'UNLICENSED'
  | 'PENDING'
  | 'ACTIVE'
  | 'EXPIRED'
  | 'SUSPENDED'
  | 'REVOKED';

export interface ClientLicenseState {
  licenseKey: string;
  licenseId: string;
  status: LicenseClientStatus;
  activatedAt: string | null;
  expiresAt: string | null;
>>>>>>> a72a1774e3f6927d0d5f9b883876b2bfcaf6d06c
  daysRemaining: number;
  maxInstallations: number;
  activeInstallationsCount: number;
  availableSlots: number;
<<<<<<< HEAD
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
=======
  signature?: string;
  lastCheckedAt: number;
}

export interface PaymentInstructionsData {
  settings: {
    bkashNumber: string;
    nagadNumber: string;
    bankInstructions?: string | null;
    whatsappNumber: string;
    instructionText?: string | null;
  };
  plans: Array<{
    code: string;
    name: string;
    validityDays: number;
    maxInstallations: number;
    price: number;
    currency: string;
  }>;
}

export interface PaymentSubmissionInput {
  transactionId: string;
  paymentMethod: 'BKASH' | 'NAGAD' | 'ROCKET' | 'UPAY' | 'BANK';
  planCode: string;
  payerContact: string;
  licenseId?: string | null;
>>>>>>> a72a1774e3f6927d0d5f9b883876b2bfcaf6d06c
}
