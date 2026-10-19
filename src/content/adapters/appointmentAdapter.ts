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
      '.slot-btn, button[class*="slot"], .time-slot, [data-slot], .available-slot, td.available'
    ));

    const results: AvailableSlotInfo[] = [];

    for (const el of candidates) {
      // Filter out disabled, hidden, or unavailable slots
      if (el.hasAttribute('disabled') || el.getAttribute('aria-disabled') === 'true') {
        continue;
      }

      const style = window.getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
        continue;
      }

      const text = (el.textContent || '').trim();
      if (!text || text.toLowerCase().includes('full') || text.toLowerCase().includes('booked')) {
        continue;
      }

      results.push({
        id: el.id || `slot_${results.length}`,
        element: el,
        displayText: text,
        isAvailable: true
      });
    }

    return results;
  }

  /**
   * Selects an available slot if one exists, without repeated looping
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

    // Verify if selection state updated
    const isSelected = targetSlot.element.classList.contains('selected') ||
                       targetSlot.element.classList.contains('active') ||
                       targetSlot.element.getAttribute('aria-selected') === 'true';

    return {
      success: true,
      slotText: targetSlot.displayText,
      message: isSelected 
        ? `Selected slot: ${targetSlot.displayText}`
        : `Clicked slot: ${targetSlot.displayText}. Please confirm on page.`
    };
  }
}

export const appointmentAdapter = new AppointmentAdapter();
