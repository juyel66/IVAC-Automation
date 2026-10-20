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

## 5. Security & Credentials Workflow
- [ ] Confirm passwords are **never** stored in plaintext in `chrome.storage.local`, `localStorage`, or `IndexedDB`. Inspect `chrome.storage.local` in DevTools console:
  ```js
  chrome.storage.local.get(null, console.log);
  ```
  Confirm that only `encryptedPassword`, `passwordSalt`, and `passwordIv` exist, and NO plaintext password exists.
- [ ] Confirm Master PIN is **never** saved to disk or persistent storage.
- [ ] In-Memory Only: Confirm decrypted passwords exist only in the JS memory map (`SessionCredentialManager.inMemoryVault`).
- [ ] Profile Deletion: Confirm that deleting a profile explicitly locks/purges its credentials from memory.
- [ ] Browser Restart Unlock Behavior:
  - Close Chrome or reload the page.
  - Because memory is wiped, the profile returns to locked state (`PIN Needed`).
  - Plaintext password is not available until the user types their Master PIN and clicks **Unlock**.
  - Entering an incorrect PIN is rejected by AES-GCM tag verification.

---

## 6. Website Integration, Login & OTP Workflow
- [ ] Open [https://appointment.ivacbd.com/](https://appointment.ivacbd.com/).
- [ ] Login Route Detection:
  - If on home or informational page, verify assistant prompts to navigate to the official login page or clicks a verified legitimate portal link.
- [ ] Dashboard readiness check:
  - If Primary PDF is missing or credentials locked, confirm **Start Assistant** button is disabled with descriptive helper text.
  - When Primary PDF is ready and Master PIN unlocks credentials, confirm **Start Assistant** button enables.
- [ ] Click **Start Assistant**:
  - Assistant targets `form.space-y-5` with `input[name="phone"]` and `input[name="password"]`.
  - Dispatches `input`, `change`, and `blur` events using the native value setter for React compatibility.
  - Verifies populated DOM values before proceeding.
  - Detects Cloudflare Turnstile (`#cf-turnstile`, `.cf-turnstile`).
  - State changes to `WAITING_FOR_CAPTCHA`.
  - Confirms the assistant **never** attempts to solve, bypass, or forge Turnstile tokens.
  - Verifies the website submit button (`button[type="submit"]`) remains disabled until Turnstile puzzle is completed.
- [ ] Complete Turnstile Verification manually on the webpage:
  - Once Turnstile checkmark turns green ("Success!"), the website submit button enables.
  - If automated verification is possible, click **Continue / Request OTP** in the assistant; otherwise click Login on the page.
  - Assistant submits the official login form exactly once.
- [ ] OTP Verification Page:
  - Portal navigates to OTP verification page (`/otp`, `/verify-otp`, or OTP form).
  - Floating assistant detects OTP step and displays the SMS OTP entry card.
  - Keep OTP only in active session memory; do not persist to storage or send to backend.
  - Enter invalid code (e.g. `12` or non-numeric) and confirm validation error.
  - Enter the numeric SMS OTP received on the phone and click **Verify OTP**.
  - Assistant populates the website's verified OTP input (`singleInput` or `segmentedInputs`) and clicks Verify exactly once.
  - State transitions to `AUTHENTICATION_PENDING`.
  - Error check: If portal displays *"Invalid OTP"* or *"Expired OTP"*, verify assistant remains on OTP step and shows error message.
  - Success check: Detects post-auth signals or page transition and transitions to `DOCUMENT_UPLOAD`.

---

## 7. Document Upload & Sequential Verification
- [ ] Navigate to Document Upload Page (`https://appointment.ivacbd.com/document-upload` or portal flow).
- [ ] Pre-Upload Validation (500KB & PDF Enforcement):
  - In PDFs tab, attempt to load a file larger than 500KB (e.g. 600KB).
  - Confirm validation rejects it with explicit compression guidance (`exceeds portal maximum allowed size of 500KB`).
  - Attempt to load non-PDF file. Confirm rejection (`Only PDF files are accepted`).
- [ ] Applicant Card Detection & Expansion:
  - Observe portal applicant cards (e.g. "Primary Applicant", "Applicant 02").
  - If additional applicant cards are collapsed (`aria-expanded="false"` or upload container hidden), confirm assistant expands the accordion section before attempting upload.
- [ ] Upload Mapping:
  - Primary applicant PDF strictly maps to `Upload Primary Applicant's Webfile` or primary applicant card.
  - Additional applicant PDFs strictly map to `Upload Other Applicant's Webfile` or Applicant 02+ card.
  - Verifies that multiple unrelated PDFs are never dumped into a single input field.
- [ ] Sequential Processing:
  - Primary applicant Webfile is attached and verified first.
  - Additional applicant Webfiles are attached in profile order.
  - Assistant displays per-file progress in the activity stream.
- [ ] Upload Verification:
  - Verifies DOM confirmation (file input `.files` populated or parent displays attached filename / checkmark).
  - If portal rejects programmatic attachment, assistant provides manual fallback notice.

---

## 8. "Confirm All Information is Correct" Button
- [ ] Locate Button:
  - Assistant locates the orange button with text *"Confirm All Information is Correct"*.
- [ ] Disabled State Check:
  - If required applicant files are incomplete or page Turnstile is pending, the website button is disabled.
  - Verify assistant **never** force-enables or clicks a disabled button.
  - If user clicks confirm in the assistant while website button is disabled, assistant displays warning: *"The 'Confirm All Information is Correct' button is currently disabled. Please complete remaining page requirements."*
- [ ] Ready Status & Explicit User Confirmation:
  - When all applicant documents are uploaded and verified, assistant displays card: *"All Documents Uploaded & Verified"*.
  - Assistant waits for user to click **Confirm All Information is Correct** in the assistant panel.
  - Clicking triggers the website button once.
  - Assistant waits for the confirmation modal with bounded 10s wait.

---

## 9. Confirmation Modal: "Save & Continue"
- [ ] Modal Detection:
  - Assistant detects the modal dialog overlay.
  - Verifies modal heading: *"Please confirm your details"*.
  - Verifies description: *"Make sure all the information is correct before saving and continuing."*.
  - Verifies primary button *"Save & Continue"* and secondary *"Go Back"*.
- [ ] Explicit Authorization Requirement:
  - Assistant **never** clicks *"Save & Continue"* automatically when the modal opens.
  - Assistant displays card in panel: *"Please Confirm Your Details"* with warning instructing the user to inspect applicant details on screen.
  - Button in assistant: **Save & Continue**.
- [ ] Single Click Execution:
  - User clicks **Save & Continue** in the assistant.
  - Assistant checks that modal button is enabled and triggers `.click()` exactly once.
  - Assistant status shows *"Saving & Continuing..."*.
  - Duplicate click prevention: double-clicking the assistant button does not send multiple clicks.
- [ ] Route Transition & State Halting:
  - Assistant waits for the modal to close or portal route transition.
  - Upon verification, state transitions to `POST_CONFIRMATION`.
  - Assistant displays: *"Details Confirmed Successfully — Workflow stopped at document confirmation."*.
  - **Critical Scope Boundary**: Confirm automation does NOT proceed to appointment/calendar slot selection or payment. Automation halts cleanly at `POST_CONFIRMATION`.

---

## 10. Testing Boundary & Verification Status
- **Code-Level Automated Tests**:
  - **103 unit and integration tests passing** in Vitest across 10 test suites (`src/__tests__/`).
  - Includes dedicated `documentConfirmationWorkflow.test.ts` covering:
    - Login form selectors (`form.space-y-5`) and Turnstile detection
    - Disabled button protection (no force-enabling)
    - 500KB per-file limit and PDF type enforcement
    - Collapsed applicant card expansion
    - Primary vs additional applicant input mapping
    - "Confirm All Information is Correct" button detection and validation
    - Confirmation modal detection ("Please confirm your details")
    - Explicit user authorization before clicking "Save & Continue"
    - Single-click guarantee and bounded timeout handling
    - Full end-to-end state transitions stopping strictly at `POST_CONFIRMATION`.
  - TypeScript compiler (`npx tsc --noEmit`) passes with **0 errors**.
  - Production build (`npm run build`) builds `popup`, `content`, and `background` with **0 errors**.
- **Live IVAC Site Verification & Known Live Dependencies**:
  - Live Turnstile puzzles and Cloudflare challenges require manual human interaction.
  - Live SMS OTP delivery depends on Indian Visa Application Center telecommunication gateways and network conditions.
  - Live applicant card accordion animation and programmatic file attachment depend on browser security restrictions on `input[type="file"]`. Clear manual file selection fallbacks are provided if synthetic `DataTransfer` attachment is blocked by the live browser context.

