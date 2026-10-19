/**
 * Appointment / Slot Selection Adapter
 * 
 * Safety constraints:
 * - NO infinite click loops.
 * - Strict verification of genuinely selectable, enabled slot elements.
 * - Graceful reporting when slots are unavailable.
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
    '.appointment-slots'
  ];

  /**
   * Scans for slot buttons or selectable time cards that are genuinely active and not disabled
   */
  public findSelectableSlots(): AvailableSlotInfo[] {
    const candidates = Array.from(document.querySelectorAll<HTMLElement>(
      'button.slot-btn, button[class*="slot"], .time-slot, [data-slot], .available-slot, input[type="radio"][name*="slot" i]'
    ));

    const results: AvailableSlotInfo[] = [];

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

      results.push({
        id: el.id || el.getAttribute('data-slot') || `slot_${results.length}`,
        element: el,
        displayText: text,
        isAvailable: true
      });
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
    targetSlot.element.click();

    // Verify whether the selection state was confirmed by the DOM
    const isSelected =
      targetSlot.element.classList.contains('selected') ||
      targetSlot.element.classList.contains('active') ||
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
}

export const appointmentAdapter = new AppointmentAdapter();
