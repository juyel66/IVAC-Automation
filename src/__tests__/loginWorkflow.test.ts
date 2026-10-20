import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { WorkflowEngine } from '../features/workflow/workflowEngine';
import { loginAdapter } from '../content/adapters/loginAdapter';
import { documentAdapter } from '../content/adapters/documentAdapter';
import { documentRepository } from '../storage/documentRepository';
import { credentialManager } from '../features/security/credentialManager';
import { IvacProfile } from '../types/profile';

describe('Login to Document Upload Workflow Verification', () => {
  let engine: WorkflowEngine;

  const sampleProfile: IvacProfile = {
    id: 'prof_workflow_user',
    displayName: 'Rahim Khan',
    mobileNumber: '01712345678',
    preferredCentre: 'Dhaka',
    encryptedPassword: 'mockEncryptedPassword',
    passwordSalt: 'mockSalt',
    passwordIv: 'mockIv',
    primaryDocumentId: 'doc_primary_rahim',
    additionalDocumentIds: ['doc_additional_utility'],
    createdAt: Date.now(),
    updatedAt: Date.now()
  };

  beforeEach(() => {
    document.documentElement.innerHTML = '<html><head></head><body></body></html>';
    window.history.replaceState({}, '', '/');
    credentialManager.lockAll();
    credentialManager.setUnlockedPassword(sampleProfile.id, 'MySecretPass123');
    engine = new WorkflowEngine();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
    engine.stop();
  });

  // 1. Login-page detection and navigation fallback
  describe('1. Login-page detection and navigation fallback', () => {
    it('detects when user is not on login page and asks user to open login page if no legitimate link exists', async () => {
      window.history.replaceState({}, '', '/random-info-page');
      document.body.innerHTML = '<div><h1>About IVAC Services</h1></div>';

      await engine.start(sampleProfile);
      const session = engine.getSession();

      expect(session.state).toBe('LOGIN_READY');
      const logs = session.logs.map((l) => l.message);
      expect(logs.some((m) => m.includes('Please open the IVAC login page'))).toBe(true);
    });

    it('navigates via verified legitimate portal link when available on the page', async () => {
      window.history.replaceState({}, '', '/portal-home');
      document.body.innerHTML = `
        <header>
          <a href="/login" id="portal-login-link">Sign In</a>
        </header>
      `;

      const link = document.getElementById('portal-login-link') as HTMLAnchorElement;
      let clicked = false;
      link.addEventListener('click', (e) => {
        e.preventDefault();
        clicked = true;
      });

      await engine.start(sampleProfile);
      expect(clicked).toBe(true);
      const session = engine.getSession();
      const logs = session.logs.map(l => l.message);
      expect(logs.some(m => m.includes('Navigating to IVAC login page'))).toBe(true);
    });

    it('navigates directly to https://appointment.ivacbd.com/signin and dismisses notice popups when on appointment.ivacbd.com', async () => {
      // Simulate landing on appointment.ivacbd.com with Important Notice popup
      delete (window as any).location;
      (window as any).location = {
        host: 'appointment.ivacbd.com',
        href: 'https://appointment.ivacbd.com/',
        pathname: '/'
      };

      document.body.innerHTML = `
        <div class="modal fixed inset-0">
          <h2>Important Notice</h2>
          <p>Appointment booking shall remain open from 12:00 Noon to 05:00 PM...</p>
          <button id="close-notice-btn" aria-label="Close">×</button>
        </div>
        <div class="modal-backdrop"></div>
      `;

      let closeClicked = false;
      document.getElementById('close-notice-btn')?.addEventListener('click', () => {
        closeClicked = true;
      });

      const navRes = loginAdapter.navigateToLoginPage();
      expect(navRes.success).toBe(true);
      expect(navRes.navigated).toBe(true);
      expect(navRes.message).toContain('https://appointment.ivacbd.com/signin');
      expect(closeClicked).toBe(true);
      expect((document.querySelector('.modal-backdrop') as HTMLElement).style.display).toBe('none');
    });

    it('clicks the header Sign In button on IVAC homepage and ignores the root logo link', () => {
      delete (window as any).location;
      (window as any).location = {
        host: 'appointment.ivacbd.com',
        href: 'https://appointment.ivacbd.com/',
        pathname: '/'
      };

      document.body.innerHTML = `
        <div class="flex items-center justify-between rounded-2xl bg-primary px-4 py-2">
          <div class="flex items-center">
            <a id="logo-link" href="/" data-discover="true">
              <img src="/assets/mvg73yfz-BO_v26IU.png" alt="Indian Visa Application Center">
            </a>
          </div>
          <div class="hidden md:flex items-center gap-3">
            <div>
              <a id="signin-link" href="/signin" data-discover="true">
                <button id="signin-button" class="flex items-center gap-3">
                  <span class="text-orange">Sign In</span>
                </button>
              </a>
            </div>
          </div>
        </div>
      `;

      let logoClicked = false;
      let buttonClicked = false;
      let anchorClicked = false;

      document.getElementById('logo-link')?.addEventListener('click', () => {
        logoClicked = true;
      });
      document.getElementById('signin-button')?.addEventListener('click', () => {
        buttonClicked = true;
      });
      document.getElementById('signin-link')?.addEventListener('click', () => {
        anchorClicked = true;
      });

      const navRes = loginAdapter.navigateToLoginPage();
      expect(navRes.success).toBe(true);
      expect(navRes.navigated).toBe(true);
      expect(logoClicked).toBe(false);
      expect(buttonClicked).toBe(true);
      expect(anchorClicked).toBe(true);
    });

    it('allows starting workflow smoothly when in PROFILE_SELECTED state without claiming active', async () => {
      window.history.replaceState({}, '', '/login');
      document.body.innerHTML = `
        <form id="login-form">
          <input type="tel" name="phone" id="phone" />
          <input type="password" name="password" id="password" />
          <button type="submit" id="btn-submit">Login</button>
        </form>
      `;

      // Set state to PROFILE_SELECTED
      (engine as any).session.state = 'PROFILE_SELECTED';
      await engine.start(sampleProfile);
      const session = engine.getSession();
      const logs = session.logs.map(l => l.message);
      expect(logs.includes('Workflow is already active.')).toBe(false);
      expect(session.state).not.toBe('ERROR');
    });

    it('detects active login page and prepares login credentials', async () => {
      window.history.replaceState({}, '', '/login');
      document.body.innerHTML = `
        <form id="login-form">
          <input type="tel" name="phone" id="phone" />
          <input type="password" name="password" id="password" />
          <button type="submit" id="btn-submit">Login</button>
        </form>
      `;

      await engine.start(sampleProfile);
      const session = engine.getSession();
      expect(session.state).toBe('LOGIN_READY');
      expect((document.getElementById('phone') as HTMLInputElement).value).toBe('01712345678');
      expect((document.getElementById('password') as HTMLInputElement).value).toBe('MySecretPass123');
    });
  });

  // 2. Mobile/password autofill
  describe('2. Mobile and password autofill verification', () => {
    it('populates fields, dispatches events, and verifies DOM values before continuing', () => {
      document.body.innerHTML = `
        <form>
          <input type="tel" name="mobile" id="mobile" />
          <input type="password" name="password" id="password" />
        </form>
      `;

      const mobileInput = document.getElementById('mobile') as HTMLInputElement;
      const passInput = document.getElementById('password') as HTMLInputElement;

      let inputDispatched = false;
      let changeDispatched = false;
      mobileInput.addEventListener('input', () => { inputDispatched = true; });
      mobileInput.addEventListener('change', () => { changeDispatched = true; });

      const res = loginAdapter.fillCredentials('01712345678', 'MySecretPass123');

      expect(res.success).toBe(true);
      expect(mobileInput.value).toBe('01712345678');
      expect(passInput.value).toBe('MySecretPass123');
      expect(inputDispatched).toBe(true);
      expect(changeDispatched).toBe(true);
    });

    it('returns error when mobile input is missing and does not claim success', () => {
      document.body.innerHTML = `
        <form>
          <input type="password" name="password" id="password" />
        </form>
      `;

      const res = loginAdapter.fillCredentials('01712345678', 'Pass123');
      expect(res.success).toBe(false);
      expect(res.message).toContain('Could not find the mobile number input');
    });

    it('reliably identifies and autofills "Your Contact Number" and password on IVAC signin page', () => {
      window.history.replaceState({}, '', '/signin');
      document.body.innerHTML = `
        <div class="bg-card rounded-2xl p-6">
          <h2>Sign In</h2>
          <p>Your data is secure with us.</p>
          <div class="space-y-4">
            <div>
              <label>Your Contact Number</label>
              <input type="text" placeholder="01......" class="w-full" />
            </div>
            <div>
              <label>Password</label>
              <input type="password" placeholder="Enter your password" class="w-full" />
            </div>
            <div id="cf-turnstile">
              <span class="text-green-600">Success!</span>
            </div>
            <button id="sign-in-now-btn" class="bg-orange">
              <span>Sign In Now</span>
            </button>
          </div>
        </div>
      `;

      credentialManager.setUnlockedPassword(sampleProfile.id, 'MySecretPass123');
      const els = loginAdapter.findFormElements();
      expect(els.mobileInput).not.toBeNull();
      expect(els.passwordInput).not.toBeNull();
      expect(els.submitButton).not.toBeNull();

      const fillRes = loginAdapter.fillCredentials('01712345678', 'MySecretPass123');
      expect(fillRes.success).toBe(true);
      expect(els.mobileInput!.value).toBe('01712345678');
      expect(els.passwordInput!.value).toBe('MySecretPass123');
    });

    it('smoothly retries autofill when inputs mount asynchronously via startLoginAutofillLoop', async () => {
      vi.useFakeTimers();
      window.history.replaceState({}, '', '/signin');
      // Initially empty DOM
      document.body.innerHTML = `<div id="loading">Loading IVAC portal...</div>`;

      (engine as any).activeProfile = sampleProfile;
      (engine as any).session.state = 'PROFILE_SELECTED';
      credentialManager.setUnlockedPassword(sampleProfile.id, 'MySecretPass123');

      // Start autofill loop
      engine.startLoginAutofillLoop();

      // Verify still waiting
      expect(engine.getSession().state).toBe('LOGIN_READY');

      // 400ms later, React mounts the form
      document.body.innerHTML = `
        <div class="bg-card">
          <label>Your Contact Number</label>
          <input type="text" placeholder="01......" id="contact-inp" />
          <input type="password" placeholder="Enter your password" id="pass-inp" />
          <button id="submit-btn">Sign In Now</button>
        </div>
      `;

      // Advance timers by 250ms
      vi.advanceTimersByTime(250);

      const contactInp = document.getElementById('contact-inp') as HTMLInputElement;
      const passInp = document.getElementById('pass-inp') as HTMLInputElement;
      expect(contactInp.value).toBe('01712345678');
      expect(passInp.value).toBe('MySecretPass123');

      vi.useRealTimers();
    });
  });

  // 3. Manual CAPTCHA pause and continuation
  describe('3. Manual CAPTCHA pause and continuation', () => {
    it('detects CAPTCHA, pauses automated submission, and enters WAITING_FOR_CAPTCHA', async () => {
      window.history.replaceState({}, '', '/login');
      document.body.innerHTML = `
        <form id="login-form">
          <input type="tel" name="phone" id="phone" />
          <input type="password" name="password" id="password" />
          <div class="g-recaptcha" data-sitekey="recaptcha-key"></div>
          <button type="submit" id="btn-login">Login</button>
        </form>
      `;

      await engine.start(sampleProfile);
      const session = engine.getSession();

      expect(session.state).toBe('WAITING_FOR_CAPTCHA');
      expect(session.authStatus).toBe('awaiting_captcha');
      expect(session.captchaState?.isRequired).toBe(true);
    });

    it('rejects Continue / Request OTP if CAPTCHA is not solved yet', async () => {
      window.history.replaceState({}, '', '/login');
      document.body.innerHTML = `
        <form id="login-form">
          <input type="tel" name="phone" id="phone" />
          <input type="password" name="password" id="password" />
          <div class="g-recaptcha" data-sitekey="recaptcha-key"></div>
          <button type="submit" id="btn-login">Login</button>
        </form>
      `;

      await engine.start(sampleProfile);
      const res = await engine.requestOtpAfterCaptcha();

      expect(res.success).toBe(false);
      expect(res.message).toContain('Please complete the Google reCAPTCHA');
      expect(engine.getSession().state).toBe('WAITING_FOR_CAPTCHA');
    });

    it('instructs user to submit manually if site cannot reliably expose CAPTCHA state', async () => {
      window.history.replaceState({}, '', '/login');
      document.body.innerHTML = `
        <form id="login-form">
          <input type="tel" name="phone" id="phone" />
          <input type="password" name="password" id="password" />
          <div id="captcha" class="custom-opaque-captcha-box"></div>
          <button type="submit" id="btn-login">Login</button>
        </form>
      `;

      await engine.start(sampleProfile);
      const res = await engine.requestOtpAfterCaptcha();

      expect(res.success).toBe(false);
      expect(res.manualRequired).toBe(true);
      expect(res.message).toContain('Please submit the login form manually');
    });

    it('submits login form once when CAPTCHA response is verified', async () => {
      vi.useFakeTimers();
      window.history.replaceState({}, '', '/login');
      document.body.innerHTML = `
        <form id="login-form">
          <input type="tel" name="phone" id="phone" />
          <input type="password" name="password" id="password" />
          <div class="g-recaptcha"></div>
          <textarea name="g-recaptcha-response">valid_token_xyz</textarea>
          <button type="submit" id="btn-login">Login</button>
        </form>
      `;

      const submitBtn = document.getElementById('btn-login') as HTMLButtonElement;
      let submitCount = 0;
      submitBtn.addEventListener('click', (e) => {
        e.preventDefault();
        submitCount++;
      });

      await engine.start(sampleProfile);
      void engine.requestOtpAfterCaptcha();

      expect(submitCount).toBe(1);
      expect(engine.getSession().state).toBe('AUTHENTICATION_PENDING');

      vi.useRealTimers();
    });
  });

  // 4. OTP card visibility
  describe('4. OTP card visibility based on workflow state', () => {
    it('sets otpState.isRequired to true when OTP verification page is detected', async () => {
      await engine.start(sampleProfile);
      expect(engine.getSession().otpState.isRequired).toBe(false);

      engine.setDetectedPage('OTP_VERIFICATION');
      const session = engine.getSession();
      expect(session.state).toBe('WAITING_FOR_OTP');
      expect(session.otpState.isRequired).toBe(true);
    });
  });

  // 5. OTP filling and single-submit behavior
  describe('5. OTP filling and single-submit behavior', () => {
    it('fills single OTP input, verifies value, and clicks submit button once', async () => {
      vi.useFakeTimers();
      window.history.replaceState({}, '', '/verify-otp');
      document.body.innerHTML = `
        <form id="otp-form">
          <input type="text" name="otp" id="otp" maxlength="6" />
          <button type="submit" id="verify-otp">Verify OTP</button>
        </form>
      `;

      const otpInput = document.getElementById('otp') as HTMLInputElement;
      const verifyBtn = document.getElementById('verify-otp') as HTMLButtonElement;

      let submitClicks = 0;
      verifyBtn.addEventListener('click', (e) => {
        e.preventDefault();
        submitClicks++;
      });

      await engine.start(sampleProfile);
      engine.setDetectedPage('OTP_VERIFICATION');

      void engine.submitOtpVerification('123456');

      // Advance clock for internal fill delay
      await vi.advanceTimersByTimeAsync(500);

      expect(otpInput.value).toBe('123456');
      expect(submitClicks).toBe(1);
      expect(engine.getSession().state).toBe('AUTHENTICATION_PENDING');

      vi.useRealTimers();
    });

    it('populates and verifies segmented digit boxes for multi-box OTP forms', () => {
      document.body.innerHTML = `
        <div class="otp-container">
          <input type="text" maxlength="1" class="otp-digit" id="d1" />
          <input type="text" maxlength="1" class="otp-digit" id="d2" />
          <input type="text" maxlength="1" class="otp-digit" id="d3" />
          <input type="text" maxlength="1" class="otp-digit" id="d4" />
          <button id="verify-otp">Verify</button>
        </div>
      `;

      const res = loginAdapter.fillOtp('9876');
      expect(res.success).toBe(true);
      expect((document.getElementById('d1') as HTMLInputElement).value).toBe('9');
      expect((document.getElementById('d2') as HTMLInputElement).value).toBe('8');
      expect((document.getElementById('d3') as HTMLInputElement).value).toBe('7');
      expect((document.getElementById('d4') as HTMLInputElement).value).toBe('6');
    });

    it('populates and submits exact IVAC portal otp-0 to otp-5 segmented inputs and clicks Verify OTP button', async () => {
      document.body.innerHTML = `
        <form class="space-y-5">
          <div class="flex items-center justify-start gap-1.5 sm:gap-2 md:gap-2.5 flex-wrap">
            <input id="otp-0" type="text" inputmode="numeric" maxlength="1" autocomplete="off" value="">
            <input id="otp-1" type="text" inputmode="numeric" maxlength="1" autocomplete="off" value="">
            <input id="otp-2" type="text" inputmode="numeric" maxlength="1" autocomplete="off" value="">
            <span>-</span>
            <input id="otp-3" type="text" inputmode="numeric" maxlength="1" autocomplete="off" value="">
            <input id="otp-4" type="text" inputmode="numeric" maxlength="1" autocomplete="off" value="">
            <input id="otp-5" type="text" inputmode="numeric" maxlength="1" autocomplete="off" value="">
          </div>
          <button type="button">Resend OTP</button>
          <button disabled="" type="submit">
            <span>Verify OTP</span>
          </button>
        </form>
      `;

      const fillRes = loginAdapter.fillOtp('992587');
      expect(fillRes.success).toBe(true);
      expect((document.getElementById('otp-0') as HTMLInputElement).value).toBe('9');
      expect((document.getElementById('otp-1') as HTMLInputElement).value).toBe('9');
      expect((document.getElementById('otp-2') as HTMLInputElement).value).toBe('2');
      expect((document.getElementById('otp-3') as HTMLInputElement).value).toBe('5');
      expect((document.getElementById('otp-4') as HTMLInputElement).value).toBe('8');
      expect((document.getElementById('otp-5') as HTMLInputElement).value).toBe('7');

      let submitClicked = false;
      const submitBtn = document.querySelector('button[type="submit"]') as HTMLButtonElement;
      submitBtn.addEventListener('click', (e) => {
        e.preventDefault();
        submitClicked = true;
      });

      const submitRes = loginAdapter.submitOtp();
      expect(submitRes.success).toBe(true);
      expect(submitClicked).toBe(true);
    });

    it('prevents accidental duplicate OTP submissions while verification is in progress', async () => {
      window.history.replaceState({}, '', '/verify-otp');
      document.body.innerHTML = `
        <form>
          <input type="text" name="otp" id="otp" />
          <button type="submit" id="verify-otp">Verify</button>
        </form>
      `;

      await engine.start(sampleProfile);
      engine.setDetectedPage('OTP_VERIFICATION');

      // First submit
      void engine.submitOtpVerification('123456');

      // Duplicate second submit immediate click
      const duplicateRes = await engine.submitOtpVerification('123456');
      expect(duplicateRes.success).toBe(false);
      expect(duplicateRes.message).toContain('already in progress');
    });
  });

  // 6. Invalid OTP and failed authentication
  describe('6. Invalid OTP and failed authentication handling', () => {
    it('rejects invalid OTP format before submitting to website', async () => {
      await engine.start(sampleProfile);
      engine.setDetectedPage('OTP_VERIFICATION');

      const res = await engine.submitOtpVerification('abc');
      expect(res.success).toBe(false);
      expect(res.message).toContain('numbers only');
    });

    it('detects live portal error message and remains on OTP step with error', async () => {
      vi.useFakeTimers();
      window.history.replaceState({}, '', '/verify-otp');
      document.body.innerHTML = `
        <form>
          <input type="text" name="otp" id="otp" />
          <button type="submit" id="verify-otp">Verify</button>
        </form>
      `;

      await engine.start(sampleProfile);
      engine.setDetectedPage('OTP_VERIFICATION');

      const submitPromise = engine.submitOtpVerification('999999');

      await vi.advanceTimersByTimeAsync(450);

      // Simulate website displaying error banner
      const errEl = document.createElement('div');
      errEl.className = 'alert-danger';
      errEl.setAttribute('role', 'alert');
      errEl.textContent = 'Invalid OTP. Please enter the correct code.';
      document.body.appendChild(errEl);

      // Advance timer for bounded check
      await vi.advanceTimersByTimeAsync(600);
      const res = await submitPromise;

      expect(res.success).toBe(false);
      expect(res.message).toContain('Invalid OTP');
      expect(engine.getSession().state).toBe('WAITING_FOR_OTP');
      expect(engine.getSession().otpState.errorMessage).toContain('Invalid OTP');

      vi.useRealTimers();
    });
  });

  // 7. Successful authentication followed by document-page detection
  describe('7. Successful authentication and continuation to document upload', () => {
    it('confirms auth upon post-auth signals and automatically proceeds to DOCUMENT_UPLOAD if already on upload page', async () => {
      vi.useFakeTimers();
      window.history.replaceState({}, '', '/verify-otp');
      document.body.innerHTML = `
        <form>
          <input type="text" name="otp" id="otp" />
          <button type="submit" id="verify-otp">Verify</button>
        </form>
      `;

      await engine.start(sampleProfile);
      engine.setDetectedPage('OTP_VERIFICATION');

      const submitPromise = engine.submitOtpVerification('123456');
      await vi.advanceTimersByTimeAsync(450);

      // Simulate authentication success with redirect to document page
      window.history.replaceState({}, '', '/document-upload');
      document.body.innerHTML = `
        <nav><a href="/logout">Logout</a></nav>
        <div>
          <h2>Upload Documents</h2>
          <input type="file" id="doc-primary" />
        </div>
      `;

      // Mock document upload sequential
      vi.spyOn(documentRepository, 'getDocumentsByProfileId').mockResolvedValue([
        {
          id: 'doc_primary_rahim',
          profileId: sampleProfile.id,
          fileName: 'passport.pdf',
          fileSize: 1024,
          mimeType: 'application/pdf',
          role: 'primary',
          orderIndex: 0,
          uploadedAt: Date.now(),
          status: 'ready'
        }
      ]);
      vi.spyOn(documentAdapter, 'uploadDocumentsSequentially').mockResolvedValue({
        success: true,
        uploadedCount: 1
      });

      await vi.advanceTimersByTimeAsync(600);
      const res = await submitPromise;

      expect(res.success).toBe(true);
      expect(['DOCUMENT_UPLOAD', 'WAITING_FOR_DOCUMENT_CONFIRMATION']).toContain(engine.getSession().state);

      vi.useRealTimers();
    });

    it('uses verified visible Next/Continue control to reach document upload page', async () => {
      window.history.replaceState({}, '', '/application-details');
      document.body.innerHTML = `
        <nav><a href="/logout">Logout</a></nav>
        <div>
          <h3>Application Details</h3>
          <button type="button" id="btn-next-step">Continue to Document Upload</button>
        </div>
      `;

      const btn = document.getElementById('btn-next-step')!;
      let nextClicked = false;
      btn.addEventListener('click', () => {
        nextClicked = true;
      });

      const navRes = loginAdapter.navigateToDocumentUpload();
      expect(navRes.success).toBe(true);
      expect(navRes.navigated).toBe(true);
      expect(nextClicked).toBe(true);
    });
  });

  // 8. Missing selectors and timeout handling
  describe('8. Missing selectors and timeout handling', () => {
    it('returns error when OTP submit button is missing from the website DOM', async () => {
      window.history.replaceState({}, '', '/verify-otp');
      // Only OTP input, no button
      document.body.innerHTML = '<input type="text" name="otp" id="otp" />';

      await engine.start(sampleProfile);
      engine.setDetectedPage('OTP_VERIFICATION');

      const res = await engine.submitOtpVerification('123456');
      expect(res.success).toBe(false);
      expect(res.message).toContain('Could not find the Verify/Submit button');
      expect(engine.getSession().state).toBe('WAITING_FOR_OTP');
    });

    it('returns error when OTP input is missing from the website DOM', async () => {
      window.history.replaceState({}, '', '/verify-otp');
      document.body.innerHTML = '<button id="verify-otp">Verify</button>';

      await engine.start(sampleProfile);
      engine.setDetectedPage('OTP_VERIFICATION');

      const res = await engine.submitOtpVerification('123456');
      expect(res.success).toBe(false);
      expect(res.message).toContain('Could not detect an active OTP input');
      expect(engine.getSession().state).toBe('WAITING_FOR_OTP');
    });

    it('handles bounded verification timeout gracefully without hanging', async () => {
      vi.useFakeTimers();
      window.history.replaceState({}, '', '/verify-otp');
      document.body.innerHTML = `
        <form>
          <input type="text" name="otp" id="otp" />
          <button type="submit" id="verify-otp">Verify</button>
        </form>
      `;

      await engine.start(sampleProfile);
      engine.setDetectedPage('OTP_VERIFICATION');

      const submitPromise = engine.submitOtpVerification('123456');
      await vi.advanceTimersByTimeAsync(450);

      // Advance past maximum attempts (30 * 500ms = 15000ms)
      await vi.advanceTimersByTimeAsync(16000);
      const res = await submitPromise;

      expect(res.success).toBe(false);
      expect(res.message).toContain('timed out');
      expect(engine.getSession().state).toBe('WAITING_FOR_OTP');
      expect(engine.getSession().otpState.isSubmitting).toBe(false);

      vi.useRealTimers();
    });
  });
});
