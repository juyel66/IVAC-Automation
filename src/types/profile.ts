export interface IvacProfile {
  id: string;
  displayName: string;
  applicantName?: string;
  mobileNumber: string;
  preferredCentre: string;
  primaryDocumentId?: string;
  additionalDocumentIds: string[];
  createdAt: number;
  updatedAt: number;
}

export interface ProfileFormData {
  displayName: string;
  applicantName?: string;
  mobileNumber: string;
  preferredCentre: string;
  // Session-only password field: not persisted in local storage
  sessionPassword?: string;
}

export const SUPPORTED_IVAC_CENTRES = [
  'Dhaka',
  'Rajshahi',
  'Chittagong',
  'Sylhet',
  'Khulna',
  'Barishal',
  'Rangpur',
  'Mymensingh',
  'Cumilla',
  'Noakhali',
  'Brahmanbaria',
  'Bogura',
  'Thakurgaon',
  'Satkhira',
  'Jashore'
] as const;

export type IvacCentre = typeof SUPPORTED_IVAC_CENTRES[number];

export const MAX_ADDITIONAL_DOCUMENTS = 3;
export const MAX_TOTAL_DOCUMENTS = 4; // 1 primary + 3 additional
