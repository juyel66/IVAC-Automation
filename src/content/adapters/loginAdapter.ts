/**
 * Login Adapter for IVAC Portal (https://appointment.ivacbd.com/)
 * 
 * Safety Guarantee:
 * - Never bypasses CAPTCHA, Cloudflare, or OTP challenges.
 * - Dispatches standard DOM events (input, change, blur) so React / Vue forms update their state.
 * - Does not auto-submit credentials without explicit user confirmation.
 */

export interface LoginFormElements {
  mobileInput: HTMLInputElement | null;
  passwordInput: HTMLInputElement | null;
  submitButton: HTMLElement | null;
  captchaElement: HTMLElement | null;
}

export class LoginAdapter {
  /**
   * Verified & heuristic selectors for IVAC login form.
   * If real website uses custom IDs or attributes, add them to these selector lists.
   */
  private selectors = {
    // TODO: Verify against live DOM if IVAC updates input name/id
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
      'button:has-text("Login")',
      'button:has-text("Sign In")',
      'input[type="submit"]'
    ],
    captcha: [
      '#captcha',
      '.g-recaptcha',
      '.h-captcha',
      '[class*="captcha" i]',
      'img[src*="captcha" i]'
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
        // Ignore pseudo-selectors if unsupported
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
   * Pre-fill mobile number and password if provided.
   * Returns true if fields were found and populated.
   */
  public fillCredentials(mobileNumber: string, sessionPassword?: string): { success: boolean; message: string } {
    const elements = this.findFormElements();

    if (!elements.mobileInput) {
      return {
        success: false,
        message: 'Could not find the mobile number input on this page. Please enter it manually.'
      };
    }

    this.setInputValue(elements.mobileInput, mobileNumber);

    if (sessionPassword && elements.passwordInput) {
      this.setInputValue(elements.passwordInput, sessionPassword);
    }

    const hasCaptcha = !!elements.captchaElement;

    return {
      success: true,
      message: hasCaptcha
        ? 'Mobile filled. Please solve the CAPTCHA and click Login manually.'
        : 'Credentials populated. Please review and click Login.'
    };
  }
}

export const loginAdapter = new LoginAdapter();
