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
  - Preferred Centre: `Dhaka`
  - Session Password: `testPassword123`
- [ ] Click **Save Profile**.
- [ ] Confirm profile appears in the list and is set as Active.
- [ ] Duplicate Validation: Click **New Profile**, enter the same display name `Summer Vacation 2026` and mobile `01712345678`. Confirm duplicate warning appears.
- [ ] Mobile Validation: Enter invalid numbers (`012...`, 10 digits, etc.) and confirm validation error triggers.
- [ ] Edit Profile: Click the pencil icon on an existing profile, change centre to `Rajshahi`, save, confirm update.
- [ ] Multiple Profiles: Create 2 more profiles. Select between them and verify active profile switch.
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
- [ ] Confirm passwords are **never** stored in `chrome.storage.local` or `localStorage`. Inspect `chrome.storage.local` in DevTools console:
  ```js
  chrome.storage.local.get(null, console.log);
  ```
  Confirm no password fields exist anywhere in storage.
- [ ] Confirm session password is kept only in memory for the active browser session.
- [ ] Confirm no cookies or OTPs are logged to console.

---

## 6. Website Integration & Workflow Progression
- [ ] Open [https://appointment.ivacbd.com/](https://appointment.ivacbd.com/).
- [ ] Dashboard check:
  - If Primary PDF is missing, confirm **Start Assistant** button is disabled with warning.
  - When Primary PDF is ready, confirm **Start Assistant** button enables.
- [ ] Click **Start Assistant**:
  - State changes to `LOGIN_READY`.
  - Mobile number input is detected and filled.
  - Message prompts user: "Mobile filled. Please solve the CAPTCHA and click Login manually."
- [ ] Human verification check:
  - Assistant waits for user to solve CAPTCHA and submit.
  - Does NOT attempt to auto-solve CAPTCHA or bypass OTP.
- [ ] Page navigation detection:
  - Navigate to OTP verification: state updates to `WAITING_FOR_USER_AUTHENTICATION`.
  - After login completes and user navigates to Document Upload: state transitions to `DOCUMENT_UPLOAD`.
  - Sequential upload initiates: Primary PDF first, then Additional PDFs in configured order (1, 2, 3).
  - Centre selection route: state transitions to `CENTRE_SELECTION`, selects profile's preferred centre (`Dhaka`, `Rajshahi`, etc.).
  - Appointment calendar: state transitions to `APPOINTMENT_SELECTION`.
- [ ] **Payment Safety Handoff**:
  - When payment route (`/payment`, `sslcommerz`, `bkash`) is reached, assistant **immediately halts**.
  - Displays blue alert: *"Payment stage reached. For your security, the assistant will NOT interact with payment systems. Please complete your fee payment manually."*
- [ ] Controls check:
  - Test **Pause**: state becomes `PAUSED`, automation halts.
  - Test **Resume**: resumes at current step without duplicate file uploads.
  - Test **Stop**: halts engine and resets active state.
