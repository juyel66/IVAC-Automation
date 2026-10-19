import { describe, it, expect } from 'vitest';
import {
  isValidBdMobile,
  normalizeBdMobile,
  validateProfileForm,
  validateOtpFormat,
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
      expect(isValidBdMobile('01212345678')).toBe(false);
      expect(isValidBdMobile('0171234567')).toBe(false);
      expect(isValidBdMobile('017123456789')).toBe(false);
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

  describe('validateProfileForm with Credentials', () => {
    const existingProfiles: IvacProfile[] = [
      {
        id: 'prof_1',
        displayName: 'Existing Trip',
        mobileNumber: '01712345678',
        preferredCentre: 'Dhaka',
        encryptedPassword: 'mockEncryptedCiphertext',
        passwordSalt: 'mockSalt',
        passwordIv: 'mockIv',
        additionalDocumentIds: [],
        createdAt: 1000,
        updatedAt: 1000
      }
    ];

    it('passes for valid profile data with password and master PIN', () => {
      const result = validateProfileForm(
        {
          displayName: 'New Applicant',
          mobileNumber: '01899887766',
          preferredCentre: 'Rajshahi',
          password: 'ivacSecret123',
          masterPin: '1234'
        },
        existingProfiles
      );
      expect(result.isValid).toBe(true);
      expect(Object.keys(result.errors).length).toBe(0);
    });

    it('requires password on new profile creation', () => {
      const result = validateProfileForm(
        {
          displayName: 'New Applicant',
          mobileNumber: '01899887766',
          preferredCentre: 'Rajshahi',
          password: '',
          masterPin: ''
        },
        existingProfiles
      );
      expect(result.isValid).toBe(false);
      expect(result.errors.password).toContain('IVAC password is required');
    });

    it('requires Master PIN when setting a password', () => {
      const result = validateProfileForm(
        {
          displayName: 'New Applicant',
          mobileNumber: '01899887766',
          preferredCentre: 'Rajshahi',
          password: 'myPassword123',
          masterPin: '12' // too short
        },
        existingProfiles
      );
      expect(result.isValid).toBe(false);
      expect(result.errors.masterPin).toContain('at least 4 characters');
    });

    it('allows keeping existing password when editing a profile', () => {
      const result = validateProfileForm(
        {
          displayName: 'Existing Trip',
          mobileNumber: '01712345678',
          preferredCentre: 'Rajshahi',
          password: '', // left blank to keep current
          masterPin: '',
          hasExistingPassword: true
        },
        existingProfiles,
        'prof_1'
      );
      expect(result.isValid).toBe(true);
    });

    it('detects duplicate profile with same display name and mobile', () => {
      const result = validateProfileForm(
        {
          displayName: 'Existing Trip',
          mobileNumber: '01712345678',
          preferredCentre: 'Dhaka',
          password: 'pass',
          masterPin: '1234'
        },
        existingProfiles
      );
      expect(result.isValid).toBe(false);
      expect(result.errors.displayName).toContain('already exists');
    });
  });

  describe('validateOtpFormat', () => {
    it('accepts valid numeric OTP codes of 4 to 8 digits', () => {
      expect(validateOtpFormat('1234').isValid).toBe(true);
      expect(validateOtpFormat('123456').isValid).toBe(true);
      expect(validateOtpFormat('98765432').isValid).toBe(true);
    });

    it('rejects empty or whitespace OTP', () => {
      expect(validateOtpFormat('').isValid).toBe(false);
      expect(validateOtpFormat('   ').isValid).toBe(false);
    });

    it('rejects non-numeric characters', () => {
      const res = validateOtpFormat('12a456');
      expect(res.isValid).toBe(false);
      expect(res.error).toContain('numbers only');
    });

    it('rejects OTP codes that are too short or too long', () => {
      expect(validateOtpFormat('123').isValid).toBe(false);
      expect(validateOtpFormat('123456789').isValid).toBe(false);
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
      expect(validateDocumentAddition(false, 'primary_id', 0).canAdd).toBe(true);
      expect(validateDocumentAddition(false, 'primary_id', 1).canAdd).toBe(true);
      expect(validateDocumentAddition(false, 'primary_id', 2).canAdd).toBe(true);
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
