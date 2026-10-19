import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { IvacPageDetector } from '../content/pageDetector';

describe('IvacPageDetector & Payment Page Detection Regression Tests', () => {
  let detector: IvacPageDetector;

  beforeEach(() => {
    // Reset DOM
    document.documentElement.innerHTML = '<html><head></head><body></body></html>';
    window.history.replaceState({}, '', '/');
    detector = new IvacPageDetector();
  });

  afterEach(() => {
    detector.destroy();
  });

  it('REGRESSION TEST: Does NOT classify ordinary application pages containing "visa" as PAYMENT', () => {
    window.history.replaceState({}, '', '/application/details');
    document.body.innerHTML = `
      <div class="header">
        <h1>Indian Visa Application Center (IVAC) Bangladesh</h1>
        <p>Welcome to the online visa application portal. Select your Visa category.</p>
      </div>
      <div class="content">
        <label>Visa Type</label>
        <div>Tourist Visa, Medical Visa, Business Visa available</div>
        <p>Visa processing fee information and visa guidelines.</p>
      </div>
    `;

    const result = detector.detect();
    expect(result.pageType).not.toBe('PAYMENT');
  });

  it('REGRESSION TEST: Does NOT classify regular payment info mention without gateway or route as PAYMENT', () => {
    window.history.replaceState({}, '', '/application/info');
    document.body.innerHTML = `
      <div>
        <p>Visa Application form instructions.</p>
        <p>Payment information: Visa fee is 800 BDT payable at final stage via bKash or card.</p>
      </div>
    `;

    const result = detector.detect();
    expect(result.pageType).not.toBe('PAYMENT');
  });

  it('detects genuine payment route (/payment) as PAYMENT page', () => {
    window.history.replaceState({}, '', '/payment/checkout');
    document.body.innerHTML = '<div>Payment Portal</div>';

    const result = detector.detect();
    expect(result.pageType).toBe('PAYMENT');
    expect(result.confidence).toBeGreaterThanOrEqual(0.9);
  });

  it('detects SSLCommerz gateway route as PAYMENT page', () => {
    window.history.replaceState({}, '', '/sslcommerz-gateway');
    document.body.innerHTML = '<div>Redirecting to gateway...</div>';

    const result = detector.detect();
    expect(result.pageType).toBe('PAYMENT');
  });

  it('detects payment gateway iframe in DOM as PAYMENT page', () => {
    window.history.replaceState({}, '', '/checkout');
    document.body.innerHTML = `
      <div class="container">
        <iframe src="https://securepay.sslcommerz.com/gwprocess/v4/main.php"></iframe>
      </div>
    `;

    const result = detector.detect();
    expect(result.pageType).toBe('PAYMENT');
  });

  it('detects payment form action in DOM as PAYMENT page', () => {
    window.history.replaceState({}, '', '/invoice/pay');
    document.body.innerHTML = `
      <form action="https://appointment.ivacbd.com/payment/process" method="POST">
        <button type="submit">Submit Fee</button>
      </form>
    `;

    const result = detector.detect();
    expect(result.pageType).toBe('PAYMENT');
  });

  it('detects multi-signal payment indicators (action button + checkout phrase) as PAYMENT page', () => {
    window.history.replaceState({}, '', '/order-summary');
    document.body.innerHTML = `
      <div>
        <h3>Select Payment Method</h3>
        <button id="btn-payment-submit">Pay Now</button>
      </div>
    `;

    const result = detector.detect();
    expect(result.pageType).toBe('PAYMENT');
  });

  it('detects LOGIN page when mobile and password inputs are present on login route', () => {
    window.history.replaceState({}, '', '/login');
    document.body.innerHTML = `
      <form id="login-form">
        <input type="tel" name="mobile" id="mobile" placeholder="Mobile Number" />
        <input type="password" name="password" id="password" />
        <button type="submit">Login</button>
      </form>
    `;

    const result = detector.detect();
    expect(result.pageType).toBe('LOGIN');
  });

  it('detects OTP_VERIFICATION page when OTP input is present', () => {
    window.history.replaceState({}, '', '/verify-otp');
    document.body.innerHTML = `
      <form>
        <p>Enter OTP sent to your mobile phone</p>
        <input type="text" name="otp" id="otp" maxlength="6" />
        <button type="submit" id="verify-otp">Verify OTP</button>
      </form>
    `;

    const result = detector.detect();
    expect(result.pageType).toBe('OTP_VERIFICATION');
  });

  it('detects DOCUMENT_UPLOAD page when file inputs are present', () => {
    window.history.replaceState({}, '', '/upload-documents');
    document.body.innerHTML = `
      <div>
        <h2>Upload Document</h2>
        <input type="file" name="primary_passport" />
        <input type="file" name="additional_doc" />
      </div>
    `;

    const result = detector.detect();
    expect(result.pageType).toBe('DOCUMENT_UPLOAD');
  });

  it('detects CENTRE_SELECTION page when centre select dropdown is present', () => {
    window.history.replaceState({}, '', '/centre-selection');
    document.body.innerHTML = `
      <div>
        <select name="center" id="centre_id">
          <option value="1">Dhaka (Jamuna Future Park)</option>
          <option value="2">Chittagong</option>
        </select>
      </div>
    `;

    const result = detector.detect();
    expect(result.pageType).toBe('CENTRE_SELECTION');
  });

  it('detects APPOINTMENT_CALENDAR page when calendar container is present', () => {
    window.history.replaceState({}, '', '/appointment-slot');
    document.body.innerHTML = `
      <div class="calendar-table">
        <div class="slot-container"></div>
      </div>
    `;

    const result = detector.detect();
    expect(result.pageType).toBe('APPOINTMENT_CALENDAR');
  });
});
