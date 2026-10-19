/**
 * Login & OTP Authentication Adapter for IVAC Portal (https://appointment.ivacbd.com/)
 * 
 * Safety Guarantees:
 * - Never bypasses CAPTCHA, Cloudflare, or OTP challenges.
 * - Dispatches standard DOM events (input, change, blur) for full framework compatibility.
 * - OTP is only submitted to the website upon explicit user confirmation.
 * - Detects live page errors (invalid credentials, expired OTP, invalid OTP).
 * - Verifies genuine authentication success before advancing to next workflow step.
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

export class LoginAdapter {
  private selectors = {
    mobile: [
      'input[name="phone"]',
      'input[name="mobile"]',
      'input[name="mobile_number"]',
      'input[id="mobile"]',
      'input[type="tel"]',
      'input[placeholder*="mobile" i]',
      'input[placeholder*="phone" i]'
    ],
    password: [
      'input[name="password"]',
      'input[id="password"]',
      'input[type="password"]'
    ],
    submitBtn: [
      'button[type="submit"]',
      'input[type="submit"]',
      'button.btn-login',
      '#login-btn'
    ],
    captcha: [
      '#captcha',
      '.g-recaptcha',
      '.h-captcha',
      '[class*="captcha" i]',
      'img[src*="captcha" i]'
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
    let mobileInput: HTMLInputElement | null = null;
    for (const selector of this.selectors.mobile) {
      const el = document.querySelector<HTMLInputElement>(selector);
      if (el) {
        mobileInput = el;
        break;
      }
    }

    let passwordInput: HTMLInputElement | null = null;
    for (const selector of this.selectors.password) {
      const el = document.querySelector<HTMLInputElement>(selector);
      if (el) {
        passwordInput = el;
        break;
      }
    }

    let submitButton: HTMLElement | null = null;
    for (const selector of this.selectors.submitBtn) {
      try {
        const el = document.querySelector<HTMLElement>(selector);
        if (el) {
          submitButton = el;
          break;
        }
      } catch {
        // ignore
      }
    }

    let captchaElement: HTMLElement | null = null;
    for (const selector of this.selectors.captcha) {
      const el = document.querySelector<HTMLElement>(selector);
      if (el) {
        captchaElement = el;
        break;
      }
    }

    return { mobileInput, passwordInput, submitButton, captchaElement };
  }

  public findOtpElements(): OtpFormElements {
    let singleInput: HTMLInputElement | null = null;
    for (const selector of this.selectors.otpInputs) {
      const el = document.querySelector<HTMLInputElement>(selector);
      if (el && !el.disabled) {
        singleInput = el;
        break;
      }
    }

    // Check for segmented multi-box OTP (e.g. 6 single-digit inputs)
    const segmentedInputs = Array.from(
      document.querySelectorAll<HTMLInputElement>(
        'input[maxlength="1"][type="text"], input[maxlength="1"][type="tel"], .otp-digit, input[data-otp-index]'
      )
    ).filter(input => !input.disabled);

    let submitButton: HTMLElement | null = null;
    for (const selector of this.selectors.otpSubmitBtns) {
      const el = document.querySelector<HTMLElement>(selector);
      if (el) {
        submitButton = el;
        break;
      }
    }

    let resendButton: HTMLElement | null = null;
    for (const selector of this.selectors.resendOtp) {
      const el = document.querySelector<HTMLElement>(selector);
      if (el) {
        resendButton = el;
        break;
      }
    }

    return { singleInput, segmentedInputs, submitButton, resendButton };
  }

  /**
   * Safely set input value triggering React synthetic events
   */
  private setInputValue(input: HTMLInputElement, value: string) {
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      'value'
    )?.set;

    if (nativeInputValueSetter) {
      nativeInputValueSetter.call(input, value);
    } else {
      input.value = value;
    }

    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    input.dispatchEvent(new Event('blur', { bubbles: true }));
  }

  /**
   * Pre-fill mobile number and password from profile.
   */
  public fillCredentials(mobileNumber: string, password?: string): { success: boolean; message: string } {
    const elements = this.findFormElements();

    if (!elements.mobileInput) {
      return {
        success: false,
        message: 'Could not find the mobile number input on this page. Please enter it manually.'
      };
    }

    this.setInputValue(elements.mobileInput, mobileNumber);

    if (password && elements.passwordInput) {
      this.setInputValue(elements.passwordInput, password);
    }

    const hasCaptcha = !!elements.captchaElement;

    return {
      success: true,
      message: hasCaptcha
        ? 'Mobile & password populated. Please solve the CAPTCHA and submit the login form on the page.'
        : 'Credentials populated. Please complete verification on the page.'
    };
  }

  /**
   * Populates the website's OTP input with code entered by user in the assistant
   */
  public fillOtp(otpCode: string): { success: boolean; message: string; hasInput: boolean } {
    const elements = this.findOtpElements();

    // Case 1: Single OTP input
    if (elements.singleInput) {
      this.setInputValue(elements.singleInput, otpCode);
      return {
        success: true,
        hasInput: true,
        message: 'OTP filled into the website input field.'
      };
    }

    // Case 2: Segmented digits inputs
    if (elements.segmentedInputs.length > 0) {
      const digits = otpCode.split('');
      elements.segmentedInputs.forEach((input, index) => {
        if (digits[index] !== undefined) {
          this.setInputValue(input, digits[index]);
        }
      });
      return {
        success: true,
        hasInput: true,
        message: `OTP filled across ${elements.segmentedInputs.length} digit boxes.`
      };
    }

    return {
      success: false,
      hasInput: false,
      message: 'Could not detect an active OTP input on the website. Please paste the code directly on the page.'
    };
  }

  /**
   * Submits the OTP form ONLY when explicitly confirmed by the user
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
      elements.submitButton.click();
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
   * Checks for error messages displayed on the website
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
          lower.includes('timed out')
        ) {
          return text;
        }
      }
    }

    return null;
  }

  /**
   * Detects if authentication succeeded based on genuine post-auth indicators
   */
  public detectAuthSuccess(): boolean {
    // 0. Pre-condition: If page shows an active authentication error alert, auth has NOT succeeded
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
}

export const loginAdapter = new LoginAdapter();
