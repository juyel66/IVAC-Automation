/**
 * Appointment / Slot Selection Adapter
 * 
 * Safety constraints:
 * - NO infinite click loops.
 * - Strict verification of genuinely selectable, enabled slot elements.
 * - Graceful reporting when slots are unavailable.
 * - Supports modern calendar date selection (/appointment/time-slot)
 *   and classic slot container cards.
 */

export interface AvailableSlotInfo {
  id: string;
  element: HTMLElement;
  displayText: string;
  isAvailable: boolean;
}

export class AppointmentAdapter {
  public readonly calendarSelectors = [
    '.calendar-table',
    '.ui-datepicker',
    '#calendar',
    '.slot-container',
    '.appointment-slots',
    '.grid-cols-7'
  ];

  /**
   * Scans for slot buttons or selectable calendar date cards that are genuinely active and not disabled
   */
  public findSelectableSlots(): AvailableSlotInfo[] {
    const results: AvailableSlotInfo[] = [];

    // 1. Check modern calendar day buttons (e.g., grid of numbers 1-31 on /appointment/time-slot)
    const calendarGrids = Array.from(document.querySelectorAll<HTMLElement>('.grid-cols-7, .calendar, .datepicker, [class*="calendar"]'));
    for (const grid of calendarGrids) {
      const dayButtons = Array.from(grid.querySelectorAll<HTMLButtonElement>('button'));
      for (const btn of dayButtons) {
        const text = (btn.textContent || '').trim();
        // Check if numeric day (1 to 31)
        if (!/^\d{1,2}$/.test(text)) continue;

        // Skip disabled or past or unselectable days
        if (
          btn.disabled ||
          btn.hasAttribute('disabled') ||
          btn.getAttribute('aria-disabled') === 'true' ||
          btn.classList.contains('cursor-not-allowed') ||
          btn.classList.contains('text-[#B0B0B0]') ||
          btn.classList.contains('disabled')
        ) {
          continue;
        }

        results.push({
          id: `calendar_day_${text}`,
          element: btn,
          displayText: `Day ${text}`,
          isAvailable: true
        });
      }
    }

    // 2. Check classic slot buttons
    const candidates = Array.from(document.querySelectorAll<HTMLElement>(
      'button.slot-btn, button[class*="slot"], .time-slot, [data-slot], .available-slot, input[type="radio"][name*="slot" i]'
    ));

    for (const el of candidates) {
      // 1. Strict disabled attribute and aria checks
      if (
        el.hasAttribute('disabled') ||
        el.getAttribute('aria-disabled') === 'true' ||
        el.getAttribute('data-disabled') === 'true' ||
        el.getAttribute('aria-hidden') === 'true'
      ) {
        continue;
      }

      // 2. Check disabled / unselectable CSS classes
      const classList = el.className.toLowerCase();
      const unselectableClasses = [
        'disabled',
        'booked',
        'unavailable',
        'sold-out',
        'no-slot',
        'off',
        'past',
        'holiday',
        'closed',
        'not-available'
      ];
      if (unselectableClasses.some(cls => classList.includes(cls))) {
        continue;
      }

      // 3. Computed visibility check
      const style = window.getComputedStyle(el);
      if (
        style.display === 'none' ||
        style.visibility === 'hidden' ||
        style.opacity === '0' ||
        style.pointerEvents === 'none'
      ) {
        continue;
      }

      // 4. Content check: filter out negative or empty text
      const text = (el.textContent || (el as HTMLInputElement).value || '').trim();
      const lower = text.toLowerCase();
      const negativePhrases = [
        'full',
        'booked',
        'unavailable',
        'closed',
        'holiday',
        'no slot',
        '0 slot',
        'not available',
        'sold out',
        'n/a'
      ];
      if (!text || negativePhrases.some(phrase => lower.includes(phrase))) {
        continue;
      }

      if (!results.some(r => r.element === el)) {
        results.push({
          id: el.id || el.getAttribute('data-slot') || `slot_${results.length}`,
          element: el,
          displayText: text,
          isAvailable: true
        });
      }
    }

    return results;
  }

  /**
   * Attempts to select an available slot once, without repeated looping.
   * Strictly verifies that the website registered the selection before claiming success.
   */
  public selectFirstAvailableSlot(): { success: boolean; slotText?: string; message: string } {
    const availableSlots = this.findSelectableSlots();

    if (availableSlots.length === 0) {
      return {
        success: false,
        message: 'No available appointment slots found at this time. Please check back later.'
      };
    }

    const targetSlot = availableSlots[0];
    try {
      targetSlot.element.click();
      targetSlot.element.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    } catch {}

    // Verify whether the selection state was confirmed by the DOM
    const isSelected =
      targetSlot.element.classList.contains('selected') ||
      targetSlot.element.classList.contains('active') ||
      (targetSlot.element.classList.contains('text-white') && targetSlot.element.classList.contains('bg-[#FF671F]')) ||
      targetSlot.element.getAttribute('aria-selected') === 'true' ||
      (targetSlot.element as HTMLInputElement).checked === true ||
      targetSlot.element.closest('.selected, .active') !== null;

    if (!isSelected) {
      return {
        success: false,
        slotText: targetSlot.displayText,
        message: `Attempted to select slot "${targetSlot.displayText}", but selection confirmation was not detected on the page. Please select slot manually.`
      };
    }

    return {
      success: true,
      slotText: targetSlot.displayText,
      message: `Confirmed slot selection: ${targetSlot.displayText}`
    };
  }

  /**
   * Locates the "Continue Booking" button on the time-slot page
   */
  public findContinueBookingButton(): HTMLButtonElement | null {
    const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>('button, input[type="submit"]'));
    for (const btn of buttons) {
      const text = (btn.textContent || (btn as HTMLInputElement).value || '').trim().toLowerCase();
      if (text.includes('continue booking')) {
        return btn;
      }
    }
    return null;
  }

  /**
   * Checks if the "Continue Booking" button is enabled
   */
  public isContinueBookingButtonEnabled(): boolean {
    const btn = this.findContinueBookingButton();
    if (!btn) return false;

    const isHtmlDisabled = btn.disabled;
    const hasDisabledAttr = btn.hasAttribute('disabled');
    const hasAriaDisabled = btn.getAttribute('aria-disabled') === 'true';
    const hasDisabledClasses =
      btn.classList.contains('disabled') ||
      (btn.classList.contains('opacity-50') && btn.classList.contains('cursor-not-allowed'));

    return !isHtmlDisabled && !hasDisabledAttr && !hasAriaDisabled && !hasDisabledClasses;
  }

  /**
   * Clicks the "Continue Booking" button
   */
  public clickContinueBooking(): { success: boolean; message: string } {
    const btn = this.findContinueBookingButton();
    if (!btn) {
      return {
        success: false,
        message: 'Could not find "Continue Booking" button.'
      };
    }

    if (!this.isContinueBookingButtonEnabled()) {
      return {
        success: false,
        message: '"Continue Booking" button is currently disabled. Waiting for verification.'
      };
    }

    try {
      btn.click();
      return {
        success: true,
        message: 'Clicked "Continue Booking".'
      };
    } catch (err: any) {
      return {
        success: false,
        message: `Failed to click Continue Booking button: ${err.message}`
      };
    }
  }
}

export const appointmentAdapter = new AppointmentAdapter();
