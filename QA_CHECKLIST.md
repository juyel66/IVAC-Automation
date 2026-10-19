# IVAC Booking Assistant — Manual QA & Verification Checklist

Target Site: [https://appointment.ivacbd.com/](https://appointment.ivacbd.com/)

> [!IMPORTANT]
> **Safety Notice**: During testing, never attempt automated booking with real applicant accounts or complete real payments. Always pause or stop before final submission or payment.

---

## 1. Extension Installation & Setup
- [ ] Open Google Chrome and navigate to `chrome://extensions/`.
- [ ] Toggle **Developer mode** to ON (top right corner).
- [ ] Click **Load unpacked** and select the `dist` folder:
  `C:\Users\Md Juyel Rana\Desktop\IVAC-Automation\dist`
- [ ] Verify that **IVAC Booking Assistant** appears in the list with version `1.0.0` and green shield icon.
- [ ] Verify that clicking the extension toolbar icon opens the popup dashboard.

---

## 2. Injection & Floating Assistant UI (Target Website)
- [ ] Navigate to [https://appointment.ivacbd.com/](https://appointment.ivacbd.com/).
- [ ] Confirm the floating assistant panel appears automatically on the top-right corner.
- [ ] Navigate to an unrelated website (e.g. `https://google.com` or `https://github.com`) and confirm the assistant does **NOT** appear.
- [ ] Check Shadow DOM isolation: Inspect the page DOM and confirm `#ivac-booking-assistant-extension-host` has an open Shadow Root containing its own `<style>` and `<div id="ivac-react-root">`. Confirm IVAC's portal styles do not leak into the panel, and panel styles do not affect IVAC's layout.
- [ ] Dragging: Click and hold the header drag handle (grip icon). Move mouse around the viewport. Confirm panel moves smoothly.
- [ ] Viewport boundary: Drag the panel towards screen edges. Confirm it stays constrained within visible window boundaries.
- [ ] Position persistence: Move the panel to a custom position, refresh the page, and confirm it remembers its last position.
- [ ] Reset Position: Go to Settings tab, click **Reset**, confirm it snaps back to top-right (24px, 24px).
- [ ] Minimize: Click the minus (`-`) button in the header. Confirm the panel collapses into the compact floating button/badge.
- [ ] Restore: Click the minimized floating button. Confirm the full panel restores in the exact same state without resetting profile selection.
- [ ] Close vs Minimize: Click the close (`X`) button. Confirm it minimizes/hides without deleting profiles or documents.

---

## 3. Profile Management
- [ ] Switch to the **Profiles** tab.
- [ ] Click **New Profile**.
- [ ] Fill form:
  - Display Name: `Summer Vacation 2026`
  - Legal Applicant Name: `Mohammad Rahman`
  - Mobile: `01712345678`
  - IVAC Password: `mySecretPassword123`
  - Master Security PIN: `1234`
  - Preferred Centre: `Dhaka`
- [ ] Click **Save Profile**.
- [ ] Confirm profile appears in the list and credentials are automatically unlocked in the current session.
- [ ] Duplicate Validation: Click **New Profile**, enter the same display name `Summer Vacation 2026` and mobile `01712345678`. Confirm duplicate warning appears.
- [ ] Mobile Validation: Enter invalid numbers (`012...`, 10 digits, etc.) and confirm validation error triggers.
- [ ] Password Validation: Try creating a profile without a password or with a password under 4 characters. Confirm validation error triggers.
- [ ] Edit Profile: Click the pencil icon on an existing profile, change centre to `Rajshahi`, save, confirm update without needing to re-type the password.
- [ ] Delete Profile: Click trash icon. Confirm delete confirmation dialog appears. Confirm deletion and verify associated IndexedDB PDFs are cleaned up.

---

## 4. PDF Document Management & IndexedDB Persistence
- [ ] Switch to **PDFs** tab.
- [ ] Primary PDF Upload:
  - Select or drag-and-drop a valid PDF under 5MB.
  - Verify green "Ready in IndexedDB" badge appears with file name and size in KB/MB.
- [ ] Non-PDF Rejection: Try uploading an image (`.jpg` or `.png`). Confirm immediate error rejection.
- [ ] Over-size Rejection: Try uploading a file > 5MB. Confirm file size error rejection.
- [ ] Replace Primary PDF: Click **Replace**, upload a different PDF. Confirm previous one is replaced cleanly.
- [ ] Additional Applicants (up to 3):
  - Click **Add Additional Applicant PDF (1 of 3)** and upload a PDF.
  - Click **Add Additional Applicant PDF (2 of 3)** and upload a PDF.
  - Click **Add Additional Applicant PDF (3 of 3)** and upload a PDF.
  - Confirm the button changes to "Maximum limit reached (1 Primary + 3 Additional applicants)".
- [ ] IndexedDB Persistence Check: Close Chrome completely, re-open Chrome, navigate back to `https://appointment.ivacbd.com/`. Confirm all 4 uploaded PDFs remain intact and ready!

---

## 5. Security & Credentials
- [ ] Confirm passwords are **never** stored in plaintext in `chrome.storage.local`, `localStorage`, or `IndexedDB`. Inspect `chrome.storage.local` in DevTools console:
  ```js
  chrome.storage.local.get(null, console.log);
  ```
  Confirm that only `encryptedPassword`, `passwordSalt`, and `passwordIv` exist, and NO plaintext password exists.
- [ ] Confirm Master PIN is **never** saved to disk or persistent storage.
- [ ] Master PIN Unlock: Refresh the browser or close and reopen Chrome. Confirm the dashboard shows `Encrypted (PIN Needed)`. Enter `1234` and click **Unlock**. Confirm credentials become unlocked in session. Test with an incorrect PIN (`0000`) and confirm rejection.
- [ ] Confirm no cookies or OTPs are logged to console.

---

## 6. Website Integration, Login & OTP Workflow
- [ ] Open [https://appointment.ivacbd.com/](https://appointment.ivacbd.com/).
- [ ] Dashboard check:
  - If Primary PDF is missing or credentials locked, confirm **Start Assistant** button is disabled with warning.
  - When Primary PDF and credentials are ready, confirm **Start Assistant** button enables.
- [ ] Click **Start Assistant**:
  - Assistant populates the selected profile's mobile number and password into the IVAC login fields.
  - State changes to `WAITING_FOR_USER_AUTHENTICATION`.
  - Amber notification instructs: *"Please complete the CAPTCHA and submit the login form on the page."*
  - Automation pauses for manual human CAPTCHA completion.
- [ ] OTP Verification:
  - After submitting login and requesting OTP on the IVAC portal, the assistant detects the OTP verification page (`/otp` or OTP input element).
  - An interactive **IVAC SMS Verification Code** section appears inside the floating assistant.
  - Enter an invalid OTP (e.g., `12ab` or `123`) and verify validation error.
  - Enter the numeric SMS OTP received on mobile (e.g., `123456`) and click **Verify OTP**.
  - Assistant populates the website's OTP input and clicks the website's verify button.
  - Status updates to *"Verifying..."*.
  - Verification check: Assistant verifies genuine authentication before proceeding; does not prematurely claim success.
  - Error check: If IVAC reports *"Invalid OTP"* or *"Expired OTP"*, the assistant displays the error and allows re-entering code.
- [ ] Subsequent steps:
  - After authenticated, sequential upload initiates: Primary PDF first, then Additional PDFs in configured order.
  - Centre selection route: selects profile's preferred centre (`Dhaka`, `Rajshahi`, etc.).
  - Payment Safety Handoff: When payment route is reached, assistant halts immediately and directs user to complete fee payment manually.
  - When payment route (`/payment`, `sslcommerz`, `bkash`) is reached, assistant **immediately halts**.
  - Displays blue alert: *"Payment stage reached. For your security, the assistant will NOT interact with payment systems. Please complete your fee payment manually."*
- [ ] Controls check:
  - Test **Pause**: state becomes `PAUSED`, automation halts.
  - Test **Resume**: resumes at current step without duplicate file uploads.
  - Test **Stop**: halts engine and resets active state.
