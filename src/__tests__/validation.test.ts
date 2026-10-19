import { describe, it, expect } from 'vitest';
import {
  isValidBdMobile,
  normalizeBdMobile,
  validateProfileForm,
  validatePdfFile,
  validateDocumentAddition,
  formatBytes
} from '../utils/validation';
import { IvacProfile, MAX_ADDITIONAL_DOCUMENTS } from '../types/profile';

describe('Validation Utilities', () => {
  describe('isValidBdMobile', () => {
    it('accepts valid 11-digit Bangladeshi mobile numbers', () => {
      expect(isValidBdMobile('01712345678')).toBe(true);
      expect(isValidBdMobile('01812345678')).toBe(true);
      expect(isValidBdMobile('01912345678')).toBe(true);
      expect(isValidBdMobile('01312345678')).toBe(true);
      expect(isValidBdMobile('01412345678')).toBe(true);
      expect(isValidBdMobile('01512345678')).toBe(true);
      expect(isValidBdMobile('01612345678')).toBe(true);
    });

    it('accepts country-code prefixed mobile numbers', () => {
      expect(isValidBdMobile('+8801712345678')).toBe(true);
      expect(isValidBdMobile('8801712345678')).toBe(true);
    });

    it('rejects invalid mobile numbers', () => {
      expect(isValidBdMobile('01212345678')).toBe(false); // invalid operator prefix
      expect(isValidBdMobile('0171234567')).toBe(false);  // too short (10 digits)
      expect(isValidBdMobile('017123456789')).toBe(false); // too long (12 digits)
      expect(isValidBdMobile('abc12345678')).toBe(false);
      expect(isValidBdMobile('')).toBe(false);
    });
  });

  describe('normalizeBdMobile', () => {
    it('strips country code to return standard 11-digit mobile', () => {
      expect(normalizeBdMobile('+8801712345678')).toBe('01712345678');
      expect(normalizeBdMobile('8801712345678')).toBe('01712345678');
      expect(normalizeBdMobile('01712345678')).toBe('01712345678');
    });
  });

  describe('validateProfileForm', () => {
    const existingProfiles: IvacProfile[] = [
      {
        id: 'prof_1',
        displayName: 'Existing Trip',
        mobileNumber: '01712345678',
        preferredCentre: 'Dhaka',
        additionalDocumentIds: [],
        createdAt: 1000,
        updatedAt: 1000
      }
    ];

    it('passes for valid profile data', () => {
      const result = validateProfileForm(
        {
          displayName: 'New Applicant',
          mobileNumber: '01899887766',
          preferredCentre: 'Rajshahi'
        },
        existingProfiles
      );
      expect(result.isValid).toBe(true);
      expect(Object.keys(result.errors).length).toBe(0);
    });

    it('detects short or empty display name', () => {
      const result = validateProfileForm(
        {
          displayName: 'A',
          mobileNumber: '01899887766',
          preferredCentre: 'Dhaka'
        },
        existingProfiles
      );
      expect(result.isValid).toBe(false);
      expect(result.errors.displayName).toBeDefined();
    });

    it('detects duplicate profile with same display name and mobile', () => {
      const result = validateProfileForm(
        {
          displayName: 'Existing Trip',
          mobileNumber: '01712345678',
          preferredCentre: 'Dhaka'
        },
        existingProfiles
      );
      expect(result.isValid).toBe(false);
      expect(result.errors.displayName).toContain('already exists');
    });

    it('allows editing an existing profile without triggering self-duplicate', () => {
      const result = validateProfileForm(
        {
          displayName: 'Existing Trip',
          mobileNumber: '01712345678',
          preferredCentre: 'Dhaka'
        },
        existingProfiles,
        'prof_1' // same ID
      );
      expect(result.isValid).toBe(true);
    });
  });

  describe('validatePdfFile', () => {
    it('accepts valid PDF file under 5MB', () => {
      const mockFile = new File(['%PDF-1.4 dummy content'], 'passport.pdf', {
        type: 'application/pdf'
      });
      const result = validatePdfFile(mockFile);
      expect(result.isValid).toBe(true);
    });

    it('rejects non-PDF files', () => {
      const mockFile = new File(['image content'], 'photo.png', {
        type: 'image/png'
      });
      const result = validatePdfFile(mockFile);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Only PDF documents are supported');
    });

    it('rejects empty files (0 bytes)', () => {
      const mockFile = new File([], 'empty.pdf', {
        type: 'application/pdf'
      });
      const result = validatePdfFile(mockFile);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('empty (0 bytes)');
    });
  });

  describe('validateDocumentAddition and Four-Document Limit', () => {
    it('allows up to 3 additional applicants (total 4 applicants)', () => {
      // 0 additional added -> can add
      expect(validateDocumentAddition(false, 'primary_id', 0).canAdd).toBe(true);
      // 1 additional added -> can add
      expect(validateDocumentAddition(false, 'primary_id', 1).canAdd).toBe(true);
      // 2 additional added -> can add
      expect(validateDocumentAddition(false, 'primary_id', 2).canAdd).toBe(true);
      // 3 additional added -> limit reached
      const limitResult = validateDocumentAddition(false, 'primary_id', 3);
      expect(limitResult.canAdd).toBe(false);
      expect(limitResult.error).toContain(`Maximum of ${MAX_ADDITIONAL_DOCUMENTS} additional`);
    });

    it('allows replacing primary document at any time', () => {
      const replaceResult = validateDocumentAddition(true, 'existing_primary_id', 3);
      expect(replaceResult.canAdd).toBe(true);
    });
  });

  describe('formatBytes', () => {
    it('formats byte numbers cleanly', () => {
      expect(formatBytes(0)).toBe('0 Bytes');
      expect(formatBytes(1024)).toBe('1 KB');
      expect(formatBytes(1024 * 1024 * 2.5)).toBe('2.5 MB');
    });
  });
});
