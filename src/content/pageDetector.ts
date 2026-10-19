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

    // 1. Payment Page Detection (Safety check)
    // To prevent false positives on regular pages containing words like "visa" or "application",
    // require:
    // - either a verified payment route, OR
    // - a verified payment gateway DOM structure (iframe, payment form, container), OR
    // - at least 2 distinct verified payment indicators.
    const paymentIndicators = this.detectPaymentSignals(url, pathname);
    const hasStrongRouteOrDom = paymentIndicators.some(s => 
      s.includes('URL indicates payment route') ||
      s.includes('Payment gateway iframe') ||
      s.includes('Payment gateway form action') ||
      s.includes('Payment gateway container')
    );

    if (hasStrongRouteOrDom || paymentIndicators.length >= 2) {
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

    // 1. Explicit payment routes
    const isPaymentRoute =
      pathname.includes('/payment') ||
      pathname.includes('/pay-fee') ||
      pathname.includes('/fee-payment') ||
      pathname.includes('/payment-gateway') ||
      url.includes('sslcommerz') ||
      url.includes('bkash-checkout') ||
      url.includes('nagad-checkout');

    if (isPaymentRoute) {
      signals.push(`URL indicates payment route: ${pathname}`);
    }

    // 2. Verified payment gateway iframes
    if (document.querySelector('iframe[src*="sslcommerz"], iframe[src*="bkash"], iframe[src*="payment"]')) {
      signals.push('Payment gateway iframe detected');
    }

    // 3. Verified payment form actions
    if (document.querySelector('form[action*="payment"], form[action*="sslcommerz"], form[action*="bkash"], form[action*="shurjopay"]')) {
      signals.push('Payment gateway form action detected');
    }

    // 4. Dedicated payment containers
    if (document.querySelector('.payment-gateway, #payment-gateway-container, .sslcz-container, [data-payment-gateway]')) {
      signals.push('Payment gateway container detected');
    }

    // 5. Explicit payment submit buttons
    if (document.querySelector('button[id*="btn-payment" i], button[name="pay_now" i], .btn-pay-fee, input[type="submit"][value*="Pay Now" i]')) {
      signals.push('Payment action button detected');
    }

    // 6. Unambiguous payment phrases (explicitly avoiding 'visa' or single words like 'payment' or 'fee')
    if (document.body) {
      const bodyText = (document.body.innerText || document.body.textContent || '').toLowerCase();
      const unambiguousPaymentPhrases = [
        'select payment method',
        'sslcommerz gateway',
        'bkash payment',
        'nagad payment',
        'rocket payment',
        'online payment gateway',
        'appointment fee payment',
        'complete fee payment'
      ];
      for (const phrase of unambiguousPaymentPhrases) {
        if (bodyText.includes(phrase)) {
          signals.push(`Unambiguous payment phrase: "${phrase}"`);
          break;
        }
      }
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
    const url = window.location.href.toLowerCase();
    const pathname = window.location.pathname.toLowerCase();

    if (pathname.includes('/otp') || pathname.includes('/verify') || url.includes('otp')) {
      signals.push('URL indicates OTP verification route');
    }

    const otpInput = document.querySelector(
      'input[name*="otp" i], input[id*="otp" i], input[placeholder*="otp" i], input[name*="code" i], input[maxlength="6"], input[maxlength="4"], .otp-digit'
    );
    if (otpInput) {
      signals.push('OTP input field present');
    }

    if (document.body) {
      const bodyText = (document.body.innerText || document.body.textContent || '').toLowerCase();
      if (bodyText.includes('enter otp') || bodyText.includes('verification code') || bodyText.includes('otp sent')) {
        signals.push('OTP instructional text found on page');
      }
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
    if (document.body) {
      const bodyText = (document.body.innerText || document.body.textContent || '').toLowerCase();
      if (bodyText.includes('upload document') || bodyText.includes('passport copy')) {
        signals.push('Document upload text found');
      }
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
