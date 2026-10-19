/**
 * Payment Safety Guard Adapter
 * 
 * Strict Requirement:
 * The extension must NEVER autofill, intercept, touch, or submit payment credentials.
 * Upon reaching the payment stage, automation unconditionally halts, and notifies the user.
 */
export class PaymentAdapter {
  public static readonly HANDOFF_MESSAGE =
    'Payment stage reached. For your security, the assistant will NOT interact with payment systems. Please complete your fee payment manually on the official IVAC gateway.';

  /**
   * Inspects if any fee amount or order ID is visible for user convenience
   */
  public extractPaymentSummary(): { amountText?: string; referenceText?: string } {
    try {
      // Look for typical fee displays without touching forms
      const amountEl = document.querySelector('.fee-amount, .total-amount, [id*="total" i], [class*="price" i]');
      const refEl = document.querySelector('.order-id, .reference-no, [id*="ref" i]');

      return {
        amountText: amountEl?.textContent?.trim(),
        referenceText: refEl?.textContent?.trim()
      };
    } catch {
      return {};
    }
  }
}

export const paymentAdapter = new PaymentAdapter();
