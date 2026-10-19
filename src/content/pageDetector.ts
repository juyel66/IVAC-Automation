import { IvacPageType } from '../types/workflow';

export interface PageDetectionResult {
  pageType: IvacPageType;
  confidence: number;
  indicators: string[];
}

/**
 * Robust page detection for IVAC appointment portal (appointment.ivacbd.com).
 * Uses multi-signal heuristics: URL paths, form elements, headings, and input attributes.
 */
export class IvacPageDetector {
  private lastDetectedPage: IvacPageType = 'UNKNOWN';
  private listeners: Array<(page: IvacPageType, result: PageDetectionResult) => void> = [];
  private observer: MutationObserver | null = null;
  private debounceTimer: number | null = null;

  constructor() {
    this.initObserver();
    this.hookHistoryApi();
  }

  public detect(): PageDetectionResult {
    const url = window.location.href.toLowerCase();
    const pathname = window.location.pathname.toLowerCase();

    // 1. Payment Page Detection (Highest priority safety check)
    const paymentIndicators = this.detectPaymentSignals(url, pathname);
    if (paymentIndicators.length > 0) {
      return { pageType: 'PAYMENT', confidence: 0.95, indicators: paymentIndicators };
    }

    // 2. Login Page Detection
    const loginIndicators = this.detectLoginSignals(url, pathname);
    if (loginIndicators.length > 0) {
      return { pageType: 'LOGIN', confidence: 0.9, indicators: loginIndicators };
    }

    // 3. OTP Verification Detection
    const otpIndicators = this.detectOtpSignals();
    if (otpIndicators.length > 0) {
      return { pageType: 'OTP_VERIFICATION', confidence: 0.85, indicators: otpIndicators };
    }

    // 4. Document Upload Detection
    const docIndicators = this.detectDocumentSignals(url, pathname);
    if (docIndicators.length > 0) {
      return { pageType: 'DOCUMENT_UPLOAD', confidence: 0.85, indicators: docIndicators };
    }

    // 5. Centre Selection Detection
    const centreIndicators = this.detectCentreSignals(url, pathname);
    if (centreIndicators.length > 0) {
      return { pageType: 'CENTRE_SELECTION', confidence: 0.85, indicators: centreIndicators };
    }

    // 6. Appointment Calendar / Slot Selection Detection
    const calendarIndicators = this.detectCalendarSignals(url, pathname);
    if (calendarIndicators.length > 0) {
      return { pageType: 'APPOINTMENT_CALENDAR', confidence: 0.8, indicators: calendarIndicators };
    }

    // 7. Applicant Details Page Detection
    const applicantIndicators = this.detectApplicantDetailsSignals(url, pathname);
    if (applicantIndicators.length > 0) {
      return { pageType: 'APPLICANT_DETAILS', confidence: 0.75, indicators: applicantIndicators };
    }

    return { pageType: 'UNKNOWN', confidence: 0.2, indicators: ['No matching IVAC page signatures detected'] };
  }

  private detectPaymentSignals(url: string, pathname: string): string[] {
    const signals: string[] = [];
    if (pathname.includes('/payment') || url.includes('payment') || url.includes('sslcommerz') || url.includes('bkash')) {
      signals.push('URL contains payment keyword');
    }
    const paymentKeywords = ['payment', 'pay now', 'bKash', 'nagad', 'rocket', 'visa', 'mastercard', 'sslcommerz', 'fee amount'];
    for (const kw of paymentKeywords) {
      if (document.body && document.body.innerText.toLowerCase().includes(kw.toLowerCase())) {
        signals.push(`Page contains keyword: ${kw}`);
        break;
      }
    }
    if (document.querySelector('form[action*="payment"], button[id*="pay"], .payment-gateway')) {
      signals.push('Payment form or gateway element found in DOM');
    }
    return signals;
  }

  private detectLoginSignals(url: string, pathname: string): string[] {
    const signals: string[] = [];
    if (pathname === '/' || pathname.includes('/login') || pathname.includes('/signin') || url.includes('login')) {
      signals.push('URL indicates login route');
    }
    // Check for mobile/password input fields
    const passwordInput = document.querySelector('input[type="password"]');
    const mobileInput = document.querySelector('input[name*="mobile" i], input[id*="mobile" i], input[placeholder*="mobile" i], input[type="tel"]');
    if (passwordInput && mobileInput) {
      signals.push('Mobile and password input fields present');
    }
    return signals;
  }

  private detectOtpSignals(): string[] {
    const signals: string[] = [];
    const otpInput = document.querySelector('input[name*="otp" i], input[id*="otp" i], input[placeholder*="otp" i], input[maxlength="6"]');
    if (otpInput) {
      signals.push('OTP input field present');
    }
    return signals;
  }

  private detectDocumentSignals(_url: string, pathname: string): string[] {
    const signals: string[] = [];
    if (pathname.includes('/document') || pathname.includes('/upload')) {
      signals.push('URL indicates document upload route');
    }
    const fileInputs = document.querySelectorAll('input[type="file"]');
    if (fileInputs.length > 0) {
      signals.push(`Found ${fileInputs.length} file upload inputs`);
    }
    if (document.body && (document.body.innerText.includes('Upload Document') || document.body.innerText.includes('Passport Copy'))) {
      signals.push('Document upload text found');
    }
    return signals;
  }

  private detectCentreSignals(_url: string, pathname: string): string[] {
    const signals: string[] = [];
    if (pathname.includes('/centre') || pathname.includes('/center') || pathname.includes('/branch')) {
      signals.push('URL indicates centre selection route');
    }
    const centreSelect = document.querySelector('select[name*="center" i], select[name*="centre" i], select[id*="centre" i]');
    if (centreSelect) {
      signals.push('Centre selection dropdown found');
    }
    return signals;
  }

  private detectCalendarSignals(_url: string, pathname: string): string[] {
    const signals: string[] = [];
    if (pathname.includes('/appointment') || pathname.includes('/slot') || pathname.includes('/calendar')) {
      signals.push('URL indicates appointment calendar');
    }
    if (document.querySelector('.calendar, .datepicker, [class*="calendar"], [class*="slot"], [id*="slot"]')) {
      signals.push('Calendar or slot container found');
    }
    return signals;
  }

  private detectApplicantDetailsSignals(_url: string, pathname: string): string[] {
    const signals: string[] = [];
    if (pathname.includes('/applicant') || pathname.includes('/application')) {
      signals.push('URL indicates applicant details');
    }
    if (document.querySelector('input[name*="passport" i], input[id*="passport" i]')) {
      signals.push('Passport input field found');
    }
    return signals;
  }

  public subscribe(callback: (page: IvacPageType, result: PageDetectionResult) => void): () => void {
    this.listeners.push(callback);
    // Trigger immediately with current page
    const initialResult = this.detect();
    callback(initialResult.pageType, initialResult);

    return () => {
      this.listeners = this.listeners.filter(cb => cb !== callback);
    };
  }

  private triggerChange() {
    if (this.debounceTimer) window.clearTimeout(this.debounceTimer);
    this.debounceTimer = window.setTimeout(() => {
      const result = this.detect();
      if (result.pageType !== this.lastDetectedPage) {
        this.lastDetectedPage = result.pageType;
        this.listeners.forEach(cb => cb(result.pageType, result));
      }
    }, 200);
  }

  private initObserver() {
    if (typeof MutationObserver === 'undefined') return;
    this.observer = new MutationObserver(() => {
      this.triggerChange();
    });

    this.observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'style', 'id']
    });
  }

  private hookHistoryApi() {
    if (typeof window === 'undefined') return;

    window.addEventListener('popstate', () => this.triggerChange());
    window.addEventListener('hashchange', () => this.triggerChange());

    const originalPushState = history.pushState;
    history.pushState = (...args) => {
      originalPushState.apply(history, args);
      this.triggerChange();
    };

    const originalReplaceState = history.replaceState;
    history.replaceState = (...args) => {
      originalReplaceState.apply(history, args);
      this.triggerChange();
    };
  }

  public destroy() {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
    if (this.debounceTimer) {
      window.clearTimeout(this.debounceTimer);
    }
    this.listeners = [];
  }
}

export const ivacPageDetector = new IvacPageDetector();
