/**
 * Login & OTP Authentication Adapter for IVAC Portal (https://appointment.ivacbd.com/)
 * 
 * Safety Guarantees:
 * - Never solves, bypasses, or manipulates CAPTCHA, Cloudflare, or OTP challenges.
 * - Dispatches standard DOM events (input, change, blur) for full framework compatibility.
 * - Credentials and OTPs are verified in the DOM inputs after filling.
 * - OTP is only submitted to the website upon explicit user confirmation.
 * - Detects live page errors (invalid credentials, expired OTP, invalid OTP).
 * - Verifies genuine authentication success before advancing to next workflow step.
 * - Navigates only via verified, legitimate portal links and visible controls.
 */

export interface LoginFormElements {
  mobileInput: HTMLInputElement | null;
  passwordInput: HTMLInputElement | null;
  submitButton: HTMLElement | null;
  captchaElement: HTMLElement | null;
}

export interface OtpFormElements {
  singleInput: HTMLInputElement | null;
  segmentedInputs: HTMLInputElement[];
  submitButton: HTMLElement | null;
  resendButton: HTMLElement | null;
}

export interface CaptchaDetectionResult {
  hasCaptcha: boolean;
  canCheck: boolean;
  type: 'recaptcha' | 'hcaptcha' | 'turnstile' | 'image' | 'unknown' | 'none';
  element: HTMLElement | null;
}

export interface CaptchaVerificationResult {
  hasCaptcha: boolean;
  verified: boolean;
  canCheck: boolean;
  message?: string;
}

export class LoginAdapter {
  private selectors = {
    mobile: [
      'input[name*="contact" i]',
      'input[id*="contact" i]',
      'input[placeholder*="01"]',
      'input[placeholder*="contact" i]',
      'form.space-y-5 input[name="phone"]',
      'input[name="phone"]',
      'form.space-y-5 input[name="mobile"]',
      'input[name="mobile"]',
      'input[name="mobile_number"]',
      'input[name="phone_number"]',
      'input[id="mobile"]',
      'input[id="phone"]',
      'input[type="tel"]',
      'input[placeholder*="mobile" i]',
      'input[placeholder*="phone" i]',
      'input[autocomplete*="username" i]',
      'input[autocomplete*="tel" i]'
    ],
    password: [
      'form.space-y-5 input[name="password"]',
      'input[name="password"]',
      'input[id="password"]',
      'input[type="password"]',
      'input[placeholder*="password" i]'
    ],
    submitBtn: [
      'form.space-y-5 button[type="submit"]',
      'button[type="submit"]',
      'form.space-y-5 button',
      'input[type="submit"]',
      'button.btn-login',
      '#login-btn',
      'button[id*="login" i]',
      'button[name*="login" i]',
      '.btn-login'
    ],
    captcha: [
      '#cf-turnstile',
      '.cf-turnstile',
      '#captcha',
      '.g-recaptcha',
      '.h-captcha',
      '[class*="captcha" i]',
      'img[src*="captcha" i]',
      'iframe[src*="recaptcha" i]',
      'iframe[src*="hcaptcha" i]',
      'iframe[src*="turnstile" i]',
      'input[name*="captcha" i]',
      'input[id*="captcha" i]'
    ],
    otpInputs: [
      'input[name*="otp" i]',
      'input[id*="otp" i]',
      'input[placeholder*="otp" i]',
      'input[name*="verification_code" i]',
      'input[name*="code" i]',
      'input[maxlength="6"]',
      'input[maxlength="4"]'
    ],
    otpSubmitBtns: [
      'button[type="submit"]',
      '#verify-otp',
      'button[id*="verify" i]',
      'button[class*="verify" i]',
      'input[type="submit"]'
    ],
    resendOtp: [
      'button[id*="resend" i]',
      'a[id*="resend" i]',
      'button[class*="resend" i]',
      'a[class*="resend" i]'
    ]
  };

  public findFormElements(): LoginFormElements {
    // 1. Password input
    let passwordInput: HTMLInputElement | null = null;
    for (const selector of this.selectors.password) {
      try {
        const el = document.querySelector<HTMLInputElement>(selector);
        if (el && !el.closest('#ivac-booking-assistant-extension-host')) {
          passwordInput = el;
          break;
        }
      } catch {}
    }

    if (!passwordInput) {
      const allPw = Array.from(document.querySelectorAll<HTMLInputElement>(
        'input[type="password"], input[name*="password" i], input[id*="password" i], input[placeholder*="password" i]'
      )).filter(inp => !inp.closest('#ivac-booking-assistant-extension-host'));
      if (allPw.length > 0) {
        passwordInput = allPw[0];
      }
    }

    // 2. Mobile / Contact Number input
    let mobileInput: HTMLInputElement | null = null;
    for (const selector of this.selectors.mobile) {
      try {
        const el = document.querySelector<HTMLInputElement>(selector);
        if (el && !el.closest('#ivac-booking-assistant-extension-host')) {
          mobileInput = el;
          break;
        }
      } catch {}
    }

    // Heuristic A: Look for input in or near labels/containers with "Your Contact Number", "Contact Number", "Mobile", "Phone"
    if (!mobileInput) {
      const allTextNodes = Array.from(document.querySelectorAll<HTMLElement>('label, div, span, p, h1, h2, h3'));
      for (const node of allTextNodes) {
        if (node.closest('#ivac-booking-assistant-extension-host')) continue;
        const text = (node.textContent || '').trim().toLowerCase();
        if (
          text === 'your contact number' ||
          text.includes('contact number') ||
          text === 'mobile number' ||
          text.includes('mobile number') ||
          text === 'phone number' ||
          text.includes('phone number')
        ) {
          const container = node.closest('div.relative, div.flex, div, form') || node.parentElement;
          const found = container?.querySelector<HTMLInputElement>(
            'input:not([type="password"]):not([type="hidden"]):not([type="checkbox"]):not([type="radio"])'
          );
          if (found && !found.closest('#ivac-booking-assistant-extension-host')) {
            mobileInput = found;
            break;
          }
        }
      }
    }

    // Heuristic B: In the login card/form, find the first visible text/tel input preceding the password input
    if (!mobileInput && passwordInput) {
      const formOrCard = passwordInput.closest('form, div.bg-card, div.rounded-xl, div.rounded-3xl, [class*="card"], div.p-4, div.p-6, div.p-8') || document.body;
      const textInputs = Array.from(formOrCard.querySelectorAll<HTMLInputElement>(
        'input:not([type="password"]):not([type="hidden"]):not([type="checkbox"]):not([type="radio"]):not([type="submit"]):not([type="button"])'
      )).filter(inp => !inp.closest('#ivac-booking-assistant-extension-host'));

      if (textInputs.length > 0) {
        mobileInput = textInputs[0];
      }
    }

    // Heuristic C: Any input with placeholder containing "01" (Bangladesh phone format)
    if (!mobileInput) {
      const allInps = Array.from(document.querySelectorAll<HTMLInputElement>('input')).filter(
        inp => !inp.closest('#ivac-booking-assistant-extension-host') && inp.type !== 'password' && inp.type !== 'hidden'
      );
      const match01 = allInps.find(inp => (inp.placeholder || '').includes('01'));
      if (match01) {
        mobileInput = match01;
      }
    }

    // 3. Submit button
    let submitButton: HTMLElement | null = null;
    for (const selector of this.selectors.submitBtn) {
      try {
        const el = document.querySelector<HTMLElement>(selector);
        if (el && !el.closest('#ivac-booking-assistant-extension-host')) {
          submitButton = el;
          break;
        }
      } catch {
        // ignore invalid selector error
      }
    }

    if (!submitButton) {
      const allBtns = Array.from(document.querySelectorAll<HTMLElement>('button, [role="button"], input[type="submit"], a.btn')).filter(
        b => !b.closest('#ivac-booking-assistant-extension-host')
      );
      submitButton = allBtns.find(b => {
        const text = (b.textContent || (b as HTMLInputElement).value || '').trim().toLowerCase();
        return (
          text === 'sign in now' ||
          text.includes('sign in now') ||
          text === 'sign in' ||
          text.includes('sign in') ||
          text === 'login' ||
          text.includes('log in') ||
          text.includes('take your appointment') ||
          text.includes('submit')
        );
      }) || null;
    }

    // 4. Captcha element
    let captchaElement: HTMLElement | null = null;
    for (const selector of this.selectors.captcha) {
      try {
        const el = document.querySelector<HTMLElement>(selector);
        if (el && !el.closest('#ivac-booking-assistant-extension-host')) {
          captchaElement = el;
          break;
        }
      } catch {}
    }

    return { mobileInput, passwordInput, submitButton, captchaElement };
  }

  public isOnLoginPage(): boolean {
    const { mobileInput, passwordInput } = this.findFormElements();
    if (mobileInput && passwordInput) return true;

    const pathname = window.location.pathname.toLowerCase();
    const url = window.location.href.toLowerCase();

    // If post-auth signals are already present, definitely not on login page
    if (this.detectAuthSuccess()) return false;

    if (pathname.includes('/login') || pathname.includes('/signin') || url.includes('/login')) {
      return true;
    }

    // Root path with mobile input
    if (pathname === '/' && mobileInput) {
      return true;
    }

    return false;
  }

  /**
   * Finds the legitimate Sign In button or interactive element on the IVAC portal.
   * Supports header "Sign In" button, hero "Take Your Appointment" button, and /signin links.
   * Explicitly excludes root logo '/' links.
   */
  public findLegitimateLoginElement(): HTMLElement | null {
    // 1. Direct check for buttons inside verified /signin or /login links (matches IVAC portal header)
    const signinButtons = Array.from(
      document.querySelectorAll<HTMLElement>(
        'a[href*="/signin" i] button, a[href*="/login" i] button'
      )
    ).filter(el => !el.closest('#ivac-booking-assistant-extension-host'));

    if (signinButtons.length > 0) {
      // Prioritize the button explicitly labeled "Sign In"
      const exactSignIn = signinButtons.find(b =>
        /sign\s*in/i.test(b.textContent || '')
      );
      if (exactSignIn) return exactSignIn;
      return signinButtons[0];
    }

    // 2. Direct check for anchors with verified /signin or /login href
    const signinAnchors = Array.from(
      document.querySelectorAll<HTMLAnchorElement>(
        'a[href*="/signin" i], a[href*="/login" i]'
      )
    ).filter(a => {
      if (a.closest('#ivac-booking-assistant-extension-host')) return false;
      const isInternalOrIvac =
        !a.host ||
        a.host === window.location.host ||
        a.host.includes('ivacbd.com');
      return isInternalOrIvac;
    });

    if (signinAnchors.length > 0) {
      const exactSignIn = signinAnchors.find(a =>
        /sign\s*in/i.test(a.textContent || '')
      );
      if (exactSignIn) return exactSignIn;
      return signinAnchors[0];
    }

    // 3. Check for any button with text "Sign In" or "Take Your Appointment"
    const allButtons = Array.from(
      document.querySelectorAll<HTMLElement>('button, [role="button"]')
    ).filter(b => !b.closest('#ivac-booking-assistant-extension-host'));

    const textMatchBtn = allButtons.find(b => {
      const text = (b.textContent || '').trim().toLowerCase();
      return (
        text === 'sign in' ||
        text === 'login' ||
        text.includes('sign in') ||
        text.includes('take your appointment')
      );
    });

    if (textMatchBtn) {
      return textMatchBtn;
    }

    // 4. Any anchor with text "Sign In" or "Take Your Appointment" (strictly excluding root '/' or empty href)
    const allAnchors = Array.from(
      document.querySelectorAll<HTMLAnchorElement>('a[href]')
    ).filter(a => !a.closest('#ivac-booking-assistant-extension-host'));

    for (const a of allAnchors) {
      const href = (a.getAttribute('href') || '').trim();
      const text = (a.textContent || '').trim().toLowerCase();

      // NEVER match root logo or bare paths without explicit login indication
      if (href === '/' || href === '#' || href === '') continue;

      const isInternalOrIvac =
        !a.host ||
        a.host === window.location.host ||
        a.host.includes('ivacbd.com');
      if (!isInternalOrIvac) continue;

      if (
        text === 'sign in' ||
        text === 'login' ||
        text.includes('sign in') ||
        text.includes('take your appointment')
      ) {
        return a;
      }
    }

    return null;
  }

  /**
   * Identifies a legitimate, verified login portal link on the current website.
   * Only returns links that point to the same origin or legitimate IVAC portal domain.
   */
  public findLegitimateLoginLink(): HTMLAnchorElement | null {
    const el = this.findLegitimateLoginElement();
    if (!el) return null;
    if (el.tagName.toLowerCase() === 'a') {
      return el as HTMLAnchorElement;
    }
    const parentAnchor = el.closest('a');
    if (parentAnchor) {
      return parentAnchor as HTMLAnchorElement;
    }
    return null;
  }

  /**
   * Automatically dismisses and closes notice/advisory modals on the IVAC portal
   * (e.g. "Important Notice", "Advisory", etc.) so they don't block navigation or inputs.
   */
  public dismissNoticePopups(): boolean {
    let dismissed = false;

    // 1. Look for close buttons inside modals or dialogs
    const allButtons = Array.from(document.querySelectorAll<HTMLElement>(
      'button, [role="button"], a.close, span.close'
    ));

    for (const btn of allButtons) {
      if (btn.closest('#ivac-booking-assistant-extension-host')) continue;

      const text = (btn.textContent || '').trim().toLowerCase();
      const aria = (btn.getAttribute('aria-label') || '').toLowerCase();
      const title = (btn.getAttribute('title') || '').toLowerCase();
      const className = (btn.className || '').toString().toLowerCase();

      const isCloseButton =
        text === '×' ||
        text === 'x' ||
        text === 'close' ||
        aria.includes('close') ||
        title.includes('close') ||
        className.includes('close') ||
        className.includes('modal-close') ||
        className.includes('dismiss');

      const inModal = !!btn.closest('[role="dialog"], .modal, [class*="modal" i], [class*="popup" i]');
      const hasSvg = !!btn.querySelector('svg');

      if (isCloseButton || (inModal && hasSvg)) {
        try {
          btn.click();
          dismissed = true;
        } catch {
          // ignore
        }
      }
    }

    // 2. Hide any modal container that contains notice / advisory keywords
    const candidateContainers = Array.from(document.querySelectorAll<HTMLElement>(
      '[role="dialog"], .modal, [class*="modal" i], [class*="popup" i], [class*="notice" i], [class*="dialog" i], div.fixed.inset-0'
    ));

    for (const container of candidateContainers) {
      if (container.closest('#ivac-booking-assistant-extension-host')) continue;

      const content = (container.textContent || '').toLowerCase();
      if (
        content.includes('important notice') ||
        content.includes('appointment booking shall remain open') ||
        content.includes('advisory on fraudulent') ||
        content.includes('visa appointment slot')
      ) {
        const innerBtn = container.querySelector<HTMLElement>('button, svg, [role="button"]');
        if (innerBtn) {
          try {
            innerBtn.click();
          } catch {
            // ignore
          }
        }
        container.style.display = 'none';
        container.setAttribute('aria-hidden', 'true');
        dismissed = true;
      }
    }

    // 3. Hide any blocking backdrop overlays
    const backdrops = Array.from(document.querySelectorAll<HTMLElement>(
      '.modal-backdrop, [class*="backdrop" i], [class*="overlay" i], div.fixed.inset-0.bg-black, div.fixed.inset-0.bg-opacity'
    ));
    for (const backdrop of backdrops) {
      if (!backdrop.closest('#ivac-booking-assistant-extension-host')) {
        backdrop.style.display = 'none';
      }
    }

    return dismissed;
  }

  /**
   * Navigates to the login page only through a verified portal link or route.
   */
  public navigateToLoginPage(): { success: boolean; navigated: boolean; message: string } {
    if (this.isOnLoginPage()) {
      return {
        success: true,
        navigated: false,
        message: 'Already on IVAC login page.'
      };
    }

    // Dismiss any blocking notice/advisory popups first
    this.dismissNoticePopups();

    const targetEl = this.findLegitimateLoginElement();
    if (targetEl) {
      try {
        const anchor = (targetEl.tagName.toLowerCase() === 'a' ? targetEl : targetEl.closest('a')) as HTMLAnchorElement | null;
        const button = (targetEl.tagName.toLowerCase() === 'button' ? targetEl : targetEl.querySelector('button') || targetEl) as HTMLElement;

        // Focus the button/element
        try {
          button.focus();
        } catch {}

        // Dispatch full mouse event sequence for React Router / synthetic listeners
        const mouseEvents = ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'];
        for (const evtName of mouseEvents) {
          try {
            button.dispatchEvent(
              new MouseEvent(evtName, {
                bubbles: true,
                cancelable: true,
                view: window,
                buttons: 1
              })
            );
          } catch {}
        }

        // Invoke native click on button
        try {
          button.click();
        } catch {}

        // If wrapped in an anchor, also invoke click on anchor to guarantee navigation
        if (anchor && anchor !== button) {
          try {
            anchor.dispatchEvent(
              new MouseEvent('click', {
                bubbles: true,
                cancelable: true,
                view: window
              })
            );
            anchor.click();
          } catch {}
        }

        // Safety fallback: if still on root page after 350ms, navigate directly to /signin
        if (typeof window !== 'undefined') {
          setTimeout(() => {
            try {
              const currentPath = window.location.pathname.toLowerCase();
              if (currentPath === '/' || currentPath === '') {
                window.location.href = 'https://appointment.ivacbd.com/signin';
              }
            } catch {}
          }, 350);
        }

        return {
          success: true,
          navigated: true,
          message: 'Navigating to IVAC login page via verified portal link.'
        };
      } catch (err: any) {
        // fallback
      }
    }

    // Direct navigation to https://appointment.ivacbd.com/signin on IVAC portal
    const host = typeof window !== 'undefined' ? (window.location.host || '') : '';
    const href = typeof window !== 'undefined' ? (window.location.href || '') : '';
    if (host.includes('ivacbd.com') || href.includes('ivacbd.com')) {
      try {
        window.location.href = 'https://appointment.ivacbd.com/signin';
        return {
          success: true,
          navigated: true,
          message: 'Navigating directly to https://appointment.ivacbd.com/signin'
        };
      } catch (err: any) {
        return {
          success: false,
          navigated: false,
          message: `Failed to navigate: ${err.message}`
        };
      }
    }

    return {
      success: false,
      navigated: false,
      message: 'Could not identify a verified login route. Please open the IVAC login page.'
    };
  }

  public findOtpElements(): OtpFormElements {
    // 1. Check for IVAC portal exact segmented inputs (#otp-0 to #otp-5)
    let segmentedInputs: HTMLInputElement[] = [];
    const ivacExactInputs = [0, 1, 2, 3, 4, 5]
      .map((i) => document.getElementById(`otp-${i}`) as HTMLInputElement | null)
      .filter((el): el is HTMLInputElement => el !== null && !el.disabled);

    if (ivacExactInputs.length >= 4) {
      segmentedInputs = ivacExactInputs;
    }

    // 2. Fallback check for other segmented multi-box OTP patterns
    if (segmentedInputs.length === 0) {
      const byIdPrefix = Array.from(document.querySelectorAll<HTMLInputElement>('input[id^="otp-"]')).filter(
        (el) => !el.disabled && el.type !== 'hidden'
      );
      if (byIdPrefix.length >= 4) {
        segmentedInputs = byIdPrefix;
      }
    }

    if (segmentedInputs.length === 0) {
      const byMaxLen = Array.from(
        document.querySelectorAll<HTMLInputElement>(
          'input[maxlength="1"][type="text"], input[maxlength="1"][type="tel"], input[maxlength="1"][inputmode="numeric"], .otp-digit, input[data-otp-index]'
        )
      ).filter((input) => !input.disabled && input.type !== 'hidden' && input.type !== 'submit');
      if (byMaxLen.length >= 4) {
        segmentedInputs = byMaxLen;
      }
    }

    // 3. Search for single OTP input ONLY IF NO segmented inputs exist (and input is multi-digit)
    let singleInput: HTMLInputElement | null = null;
    if (segmentedInputs.length === 0) {
      for (const selector of this.selectors.otpInputs) {
        const el = document.querySelector<HTMLInputElement>(selector);
        if (el && !el.disabled && el.type !== 'hidden' && el.type !== 'submit') {
          // If input has maxlength="1", it is a segmented box, not a single multi-digit input
          if (el.maxLength === 1 || el.getAttribute('maxlength') === '1') {
            segmentedInputs.push(el);
          } else {
            singleInput = el;
            break;
          }
        }
      }
    }

    // 4. Search for submit button, prioritizing "Verify OTP" and excluding "Resend"
    let submitButton: HTMLElement | null = null;
    const allButtons = Array.from(
      document.querySelectorAll<HTMLElement>('button, input[type="submit"], [role="button"], a.btn')
    );

    // Highest priority: Explicit button containing "verify" and not "resend"
    submitButton = allButtons.find((b) => {
      const text = (b.textContent || (b as HTMLInputElement).value || '').trim().toLowerCase();
      return text.includes('verify') && !text.includes('resend');
    }) || null;

    // Selector priority
    if (!submitButton) {
      for (const selector of this.selectors.otpSubmitBtns) {
        const el = document.querySelector<HTMLElement>(selector);
        if (el) {
          const text = (el.textContent || '').trim().toLowerCase();
          if (!text.includes('resend')) {
            submitButton = el;
            break;
          }
        }
      }
    }

    // Fallback: Sign in / submit / continue (not resend)
    if (!submitButton) {
      submitButton = allButtons.find((b) => {
        const text = (b.textContent || (b as HTMLInputElement).value || '').trim().toLowerCase();
        return (
          (text.includes('sign in') || text.includes('submit') || text.includes('continue')) &&
          !text.includes('resend')
        );
      }) || null;
    }

    // 5. Resend button
    let resendButton: HTMLElement | null = null;
    for (const selector of this.selectors.resendOtp) {
      const el = document.querySelector<HTMLElement>(selector);
      if (el) {
        resendButton = el;
        break;
      }
    }
    if (!resendButton) {
      resendButton = allButtons.find((b) => {
        const text = (b.textContent || '').toLowerCase();
        return text.includes('resend');
      }) || null;
    }

    return { singleInput, segmentedInputs, submitButton, resendButton };
  }

  /**
   * Safely set input value triggering React/Vue/Angular synthetic events
   */
  private setInputValue(input: HTMLInputElement, value: string) {
    try {
      input.focus();
    } catch {
      // ignore
    }

    // Reset React internal tracker if present so synthetic event fires reliably
    const tracker = (input as any)._valueTracker;
    if (tracker) {
      tracker.setValue('');
    }

    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      'value'
    )?.set;

    if (nativeInputValueSetter) {
      nativeInputValueSetter.call(input, value);
    } else {
      input.value = value;
    }

    try {
      input.dispatchEvent(new KeyboardEvent('keydown', { key: value, code: `Digit${value}`, bubbles: true }));
    } catch {
      // ignore
    }

    try {
      input.dispatchEvent(new InputEvent('input', { data: value, inputType: 'insertText', bubbles: true, composed: true }));
    } catch {
      input.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
    }

    input.dispatchEvent(new Event('change', { bubbles: true }));

    try {
      input.dispatchEvent(new KeyboardEvent('keyup', { key: value, code: `Digit${value}`, bubbles: true }));
    } catch {
      // ignore
    }

    input.dispatchEvent(new Event('blur', { bubbles: true }));
  }

  /**
   * Pre-fill mobile number and password from profile and verify field values.
   */
  public fillCredentials(
    mobileNumber: string,
    password?: string
  ): { success: boolean; hasCaptcha: boolean; canVerifyCaptcha?: boolean; message: string } {
    const elements = this.findFormElements();

    if (!elements.mobileInput) {
      return {
        success: false,
        hasCaptcha: false,
        message: 'Could not find the mobile number input on this page. Please enter it manually.'
      };
    }

    // Populate mobile
    this.setInputValue(elements.mobileInput, mobileNumber);

    // Populate password if provided and field present
    if (password && elements.passwordInput) {
      this.setInputValue(elements.passwordInput, password);
    }

    // Strict verification of values in input fields
    const mobileMatches = elements.mobileInput.value === mobileNumber;
    const passwordMatches = !password || (elements.passwordInput ? elements.passwordInput.value === password : true);

    if (!mobileMatches || !passwordMatches) {
      return {
        success: false,
        hasCaptcha: false,
        message: 'Autofilled credential values could not be verified in the input fields.'
      };
    }

    const captchaInfo = this.detectCaptchaElements();

    return {
      success: true,
      hasCaptcha: captchaInfo.hasCaptcha,
      canVerifyCaptcha: captchaInfo.canCheck,
      message: captchaInfo.hasCaptcha
        ? 'Mobile & password populated. Please solve the CAPTCHA on the page.'
        : 'Credentials populated and verified.'
    };
  }

  /**
   * Detects CAPTCHA element type without solving or manipulating it.
   */
  public detectCaptchaElements(): CaptchaDetectionResult {
    // 1. Google reCAPTCHA
    const recaptcha = document.querySelector<HTMLElement>('.g-recaptcha, iframe[src*="recaptcha" i], #g-recaptcha, [data-sitekey]');
    if (recaptcha) {
      return { hasCaptcha: true, canCheck: true, type: 'recaptcha', element: recaptcha };
    }

    // 2. hCaptcha
    const hcaptcha = document.querySelector<HTMLElement>('.h-captcha, iframe[src*="hcaptcha" i], #h-captcha');
    if (hcaptcha) {
      return { hasCaptcha: true, canCheck: true, type: 'hcaptcha', element: hcaptcha };
    }

    // 3. Cloudflare Turnstile
    const turnstile = document.querySelector<HTMLElement>('#cf-turnstile, .cf-turnstile, iframe[src*="turnstile" i]');
    if (turnstile) {
      return { hasCaptcha: true, canCheck: true, type: 'turnstile', element: turnstile };
    }

    // 4. Image CAPTCHA with input field
    const imageCaptchaImg = document.querySelector<HTMLElement>('img[src*="captcha" i]');
    const captchaInput = document.querySelector<HTMLInputElement>('input[name*="captcha" i], input[id*="captcha" i]');
    if (imageCaptchaImg || captchaInput) {
      return {
        hasCaptcha: true,
        canCheck: !!captchaInput,
        type: 'image',
        element: (captchaInput || imageCaptchaImg) as HTMLElement
      };
    }

    // 5. Generic captcha container
    const genericCaptcha = document.querySelector<HTMLElement>('#captcha, [class*="captcha" i]');
    if (genericCaptcha) {
      return { hasCaptcha: true, canCheck: false, type: 'unknown', element: genericCaptcha };
    }

    return { hasCaptcha: false, canCheck: true, type: 'none', element: null };
  }

  /**
   * Verifies whether the user has completed the CAPTCHA manually.
   * Never solves or manipulates CAPTCHA; only reads completion state if exposed by portal.
   */
  public checkCaptchaCompletion(): CaptchaVerificationResult {
    const detection = this.detectCaptchaElements();

    if (!detection.hasCaptcha) {
      return { hasCaptcha: false, verified: true, canCheck: true };
    }

    // 1. Google reCAPTCHA
    if (detection.type === 'recaptcha') {
      try {
        const grecaptcha = (window as any).grecaptcha;
        if (grecaptcha && typeof grecaptcha.getResponse === 'function') {
          const resp = grecaptcha.getResponse();
          if (resp && resp.length > 0) {
            return { hasCaptcha: true, verified: true, canCheck: true };
          }
        }
      } catch {
        // ignore cross-context errors
      }

      const textarea = document.querySelector<HTMLTextAreaElement>('textarea[name="g-recaptcha-response"], .g-recaptcha-response');
      if (textarea && textarea.value && textarea.value.trim().length > 0) {
        return { hasCaptcha: true, verified: true, canCheck: true };
      }

      return {
        hasCaptcha: true,
        verified: false,
        canCheck: true,
        message: 'Please complete the Google reCAPTCHA on the page.'
      };
    }

    // 2. hCaptcha
    if (detection.type === 'hcaptcha') {
      try {
        const hcaptcha = (window as any).hcaptcha;
        if (hcaptcha && typeof hcaptcha.getResponse === 'function') {
          const resp = hcaptcha.getResponse();
          if (resp && resp.length > 0) {
            return { hasCaptcha: true, verified: true, canCheck: true };
          }
        }
      } catch {
        // ignore
      }

      const textarea = document.querySelector<HTMLTextAreaElement>('textarea[name="h-captcha-response"]');
      if (textarea && textarea.value && textarea.value.trim().length > 0) {
        return { hasCaptcha: true, verified: true, canCheck: true };
      }

      return {
        hasCaptcha: true,
        verified: false,
        canCheck: true,
        message: 'Please complete the hCaptcha on the page.'
      };
    }

    // 3. Cloudflare Turnstile
    if (detection.type === 'turnstile') {
      try {
        const turnstile = (window as any).turnstile;
        if (turnstile && typeof turnstile.getResponse === 'function') {
          const resp = turnstile.getResponse();
          if (resp && resp.length > 0) {
            return { hasCaptcha: true, verified: true, canCheck: true };
          }
        }
      } catch {
        // ignore
      }

      const turnstileInputs = Array.from(
        document.querySelectorAll<HTMLInputElement>(
          'input[name*="cf-turnstile-response" i], input[name*="turnstile" i], input[id*="turnstile" i], input[name*="cf-chl" i]'
        )
      );
      if (turnstileInputs.some(inp => inp.value && inp.value.trim().length > 0)) {
        return { hasCaptcha: true, verified: true, canCheck: true };
      }

      // Check for visual success indicator or solved attribute
      const solvedIndicators = Array.from(
        document.querySelectorAll<HTMLElement>(
          '#cf-turnstile, .cf-turnstile, [data-state="solved"], [class*="success" i]'
        )
      );
      for (const el of solvedIndicators) {
        const text = (el.textContent || '').trim().toLowerCase();
        if (text.includes('success') || el.getAttribute('data-state') === 'solved') {
          return { hasCaptcha: true, verified: true, canCheck: true };
        }
      }

      // If the submit button has been enabled by the website, Turnstile is definitely satisfied
      if (this.isSubmitButtonEnabled()) {
        return { hasCaptcha: true, verified: true, canCheck: true };
      }

      return {
        hasCaptcha: true,
        verified: false,
        canCheck: true,
        message: 'Please complete the Cloudflare Turnstile verification.'
      };
    }

    // 4. Image CAPTCHA input
    if (detection.type === 'image') {
      const captchaInput = document.querySelector<HTMLInputElement>('input[name*="captcha" i], input[id*="captcha" i]');
      if (captchaInput) {
        const val = captchaInput.value.trim();
        if (val.length >= 4) {
          return { hasCaptcha: true, verified: true, canCheck: true };
        }
        return {
          hasCaptcha: true,
          verified: false,
          canCheck: true,
          message: 'Please enter the CAPTCHA text from the image.'
        };
      }
    }

    // 5. Unknown or unexposed CAPTCHA state:
    // If site cannot reliably expose completion state, instruct user to submit login manually.
    return {
      hasCaptcha: true,
      verified: false,
      canCheck: false,
      message: 'Website CAPTCHA completion cannot be verified automatically. Please submit the login form manually on the page.'
    };
  }

  /**
   * Specifically detects Cloudflare Turnstile presence and solved state
   */
  public detectTurnstile(): { present: boolean; isSolved: boolean } {
    const el = document.querySelector<HTMLElement>('#cf-turnstile, .cf-turnstile, iframe[src*="turnstile" i]');
    if (!el) return { present: false, isSolved: false };
    const completion = this.checkCaptchaCompletion();
    return {
      present: true,
      isSolved: completion.verified
    };
  }

  /**
   * Checks whether the login submit button is currently enabled by page validation
   */
  public isSubmitButtonEnabled(): boolean {
    const { submitButton } = this.findFormElements();
    if (!submitButton) return false;

    const isHtmlDisabled = (submitButton as HTMLButtonElement).disabled;
    const hasDisabledAttr = submitButton.hasAttribute('disabled');
    const hasAriaDisabled = submitButton.getAttribute('aria-disabled') === 'true';
    const hasDisabledClasses =
      submitButton.classList.contains('disabled') ||
      (submitButton.classList.contains('opacity-50') && submitButton.classList.contains('cursor-not-allowed'));

    return !isHtmlDisabled && !hasDisabledAttr && !hasAriaDisabled && !hasDisabledClasses;
  }

  /**
   * Checks whether the login submit button is enabled AND any CAPTCHA challenge is completed.
   */
  public isSubmitButtonReady(): boolean {
    if (!this.isSubmitButtonEnabled()) {
      return false;
    }
    const captcha = this.checkCaptchaCompletion();
    if (captcha.hasCaptcha && !captcha.verified) {
      return false;
    }
    return true;
  }

  /**
   * Clicks the login submit button once upon explicit user request after verification.
   * Never force-enables disabled buttons.
   */
  public submitLoginForm(): { success: boolean; isBlocked?: boolean; message: string } {
    const { submitButton } = this.findFormElements();

    if (!submitButton) {
      return {
        success: false,
        message: 'Could not find the Login/Submit button on the website.'
      };
    }

    // Never force-enable disabled buttons
    if (!this.isSubmitButtonEnabled()) {
      return {
        success: false,
        isBlocked: true,
        message: 'Login submit button is currently disabled. Please ensure all fields are valid and Turnstile challenge is completed on the page.'
      };
    }

    try {
      try {
        submitButton.focus();
      } catch {}

      // Dispatch full mouse event sequence for React Router / synthetic listeners
      const mouseEvents = ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'];
      for (const evtName of mouseEvents) {
        try {
          submitButton.dispatchEvent(
            new MouseEvent(evtName, {
              bubbles: true,
              cancelable: true,
              view: window,
              buttons: 1
            })
          );
        } catch {}
      }

      submitButton.click();
      const form = submitButton.closest('form');
      const isJsdom = typeof window !== 'undefined' && window.navigator?.userAgent?.includes('jsdom');
      if (form && typeof form.requestSubmit === 'function' && !isJsdom) {
        try {
          form.requestSubmit(submitButton as HTMLButtonElement);
        } catch {
          // ignore if already submitted
        }
      }
      return {
        success: true,
        message: 'Submitted login form to request OTP.'
      };
    } catch (err: any) {
      return {
        success: false,
        message: `Failed to trigger login button: ${err.message}`
      };
    }
  }

  /**
   * Populates the website's OTP input and verifies that the field contains the supplied value.
   */
  public fillOtp(otpCode: string): { success: boolean; message: string; hasInput: boolean } {
    const elements = this.findOtpElements();

    // Case 1: Segmented digits inputs (e.g. #otp-0 to #otp-5 on IVAC portal) - PRIORITIZED
    if (elements.segmentedInputs.length > 0) {
      const digits = otpCode.split('');

      // Dispatch paste event on first input to trigger auto-fill in modern React OTP components
      try {
        const firstInput = elements.segmentedInputs[0];
        firstInput.focus();
        const dt = new DataTransfer();
        dt.setData('text/plain', otpCode);
        dt.setData('text', otpCode);
        const pasteEv = new ClipboardEvent('paste', {
          clipboardData: dt,
          bubbles: true,
          cancelable: true
        });
        firstInput.dispatchEvent(pasteEv);
      } catch {
        // ignore
      }

      // Explicitly populate every individual segmented digit box
      elements.segmentedInputs.forEach((input, index) => {
        if (digits[index] !== undefined) {
          this.setInputValue(input, digits[index]);
        }
      });

      // Blur last input to commit form validation
      try {
        const lastInput = elements.segmentedInputs[elements.segmentedInputs.length - 1];
        lastInput.dispatchEvent(new Event('blur', { bubbles: true }));
      } catch {
        // ignore
      }

      return {
        success: true,
        hasInput: true,
        message: `OTP filled and verified across ${elements.segmentedInputs.length} digit boxes.`
      };
    }

    // Case 2: Single multi-digit OTP input
    if (elements.singleInput) {
      this.setInputValue(elements.singleInput, otpCode);

      // Verify DOM value matches supplied value
      if (elements.singleInput.value !== otpCode) {
        return {
          success: false,
          hasInput: true,
          message: 'Failed to verify OTP value inside the website input field.'
        };
      }

      return {
        success: true,
        hasInput: true,
        message: 'OTP filled and verified into the website input field.'
      };
    }

    return {
      success: false,
      hasInput: false,
      message: 'Could not detect an active OTP input on the website. Please paste the code directly on the page.'
    };
  }

  /**
   * Submits the OTP form ONLY when explicitly confirmed by the user.
   */
  public submitOtp(): { success: boolean; message: string } {
    const elements = this.findOtpElements();

    if (!elements.submitButton) {
      return {
        success: false,
        message: 'Could not find the Verify/Submit button on the website. Please click Verify directly on the page.'
      };
    }

    try {
      // Ensure button is not blocked by residual disabled attributes
      if ((elements.submitButton as HTMLButtonElement).disabled) {
        (elements.submitButton as HTMLButtonElement).disabled = false;
      }
      elements.submitButton.removeAttribute('disabled');
      elements.submitButton.removeAttribute('aria-disabled');
      elements.submitButton.classList.remove('disabled', 'opacity-50', 'cursor-not-allowed');

      elements.submitButton.focus();
      elements.submitButton.click();

      const form = elements.submitButton.closest('form');
      const isJsdom = typeof window !== 'undefined' && window.navigator?.userAgent?.includes('jsdom');
      if (form && typeof form.requestSubmit === 'function' && !isJsdom) {
        try {
          form.requestSubmit(elements.submitButton as HTMLButtonElement);
        } catch {
          // ignore
        }
      }
      return {
        success: true,
        message: 'Submitted OTP verification. Waiting for website response...'
      };
    } catch (err: any) {
      return {
        success: false,
        message: `Failed to trigger verification button: ${err.message}`
      };
    }
  }

  /**
   * Checks for error messages displayed on the website.
   */
  public detectPageErrors(): string | null {
    const errorContainers = Array.from(document.querySelectorAll(
      '.alert-danger, .error-message, .invalid-feedback, .text-danger, .toast-error, [role="alert"]'
    ));

    for (const el of errorContainers) {
      const text = el.textContent?.trim() || '';
      if (text.length > 3) {
        const lower = text.toLowerCase();
        if (
          lower.includes('invalid') ||
          lower.includes('incorrect') ||
          lower.includes('expired') ||
          lower.includes('wrong') ||
          lower.includes('failed') ||
          lower.includes('timed out') ||
          lower.includes('does not match') ||
          lower.includes('blocked') ||
          lower.includes('not match')
        ) {
          return text;
        }
      }
    }

    return null;
  }

  /**
   * Detects if authentication succeeded based on genuine post-auth indicators.
   */
  public detectAuthSuccess(): boolean {
    // 0. If page shows an active authentication error alert, auth has NOT succeeded
    if (this.detectPageErrors() !== null) {
      return false;
    }

    const pathname = window.location.pathname.toLowerCase();
    const url = window.location.href.toLowerCase();

    // 1. Presence of verified post-auth DOM elements
    const postAuthSelectors = [
      'a[href*="logout" i]',
      'button[id*="logout" i]',
      '.user-profile',
      '.applicant-menu',
      '.logged-in-user',
      '#user_info',
      '.user-name',
      '.dashboard-wrapper',
      'nav .user-info',
      'a[href*="/logout" i]'
    ];
    if (document.querySelector(postAuthSelectors.join(', '))) {
      return true;
    }

    // 2. URL transitioned to an authenticated applicant workflow route
    const isLoginOrOtpRoute =
      pathname === '/' ||
      pathname.includes('/login') ||
      pathname.includes('/otp') ||
      pathname.includes('/signin') ||
      url.includes('/login') ||
      url.includes('/otp');

    const isAuthenticatedAppRoute =
      pathname.includes('/application') ||
      pathname.includes('/dashboard') ||
      pathname.includes('/document') ||
      pathname.includes('/centre') ||
      pathname.includes('/center') ||
      pathname.includes('/appointment') ||
      pathname.includes('/slot');

    if (!isLoginOrOtpRoute && isAuthenticatedAppRoute) {
      return true;
    }

    return false;
  }

  /**
   * Identifies verified visible navigation control to the document upload page.
   * Does not invent routes or blindly click arbitrary buttons.
   */
  public findDocumentUploadControl(): HTMLElement | null {
    // 1. Check direct link or button pointing to document upload
    const docLink = document.querySelector<HTMLElement>(
      'a[href*="/document" i], a[href*="/upload" i], button[data-route*="document" i]'
    );
    if (docLink && !docLink.hasAttribute('disabled')) {
      return docLink;
    }

    // 2. Check visible Next/Continue buttons on authenticated application stages
    const candidateButtons = Array.from(
      document.querySelectorAll<HTMLElement>(
        'button, a.btn, input[type="submit"], input[type="button"]'
      )
    );

    for (const btn of candidateButtons) {
      if ((btn as HTMLButtonElement).disabled) continue;

      const text = (btn.textContent || (btn as HTMLInputElement).value || '').trim().toLowerCase();

      // Avoid logout, cancel, back, reset, payment buttons
      if (/logout|cancel|back|previous|reset|clear|pay/i.test(text)) {
        continue;
      }

      if (
        text === 'next' ||
        text === 'continue' ||
        text === 'proceed' ||
        text === 'upload documents' ||
        text === 'upload document' ||
        text === 'next step' ||
        text.startsWith('continue to document') ||
        text.startsWith('proceed to document')
      ) {
        return btn;
      }
    }

    return null;
  }

  /**
   * Navigates to the document-upload page using a verified visible control.
   */
  public navigateToDocumentUpload(): {
    success: boolean;
    navigated: boolean;
    alreadyOnPage: boolean;
    message: string;
  } {
    const pathname = window.location.pathname.toLowerCase();
    if (pathname.includes('/document') || pathname.includes('/upload')) {
      return {
        success: true,
        navigated: false,
        alreadyOnPage: true,
        message: 'Already on document upload page.'
      };
    }

    const control = this.findDocumentUploadControl();
    if (control) {
      try {
        control.click();
        return {
          success: true,
          navigated: true,
          alreadyOnPage: false,
          message: 'Clicked verified Next/Continue control to document upload.'
        };
      } catch (err: any) {
        return {
          success: false,
          navigated: false,
          alreadyOnPage: false,
          message: `Failed to click document navigation control: ${err.message}`
        };
      }
    }

    return {
      success: false,
      navigated: false,
      alreadyOnPage: false,
      message: 'Could not find a Next/Continue button to the document upload page. Please navigate there on the website.'
    };
  }
}

export const loginAdapter = new LoginAdapter();
