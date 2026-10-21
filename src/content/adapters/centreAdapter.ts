/**
 * Normalizes and compares centre strings for reliable matching across variations
 * (e.g., "IVAC, Dhaka (JFP)" vs "IVAC, DHAKA (JFP)" or "Dhaka")
 */
export function matchCentreOption(optionText: string, preferred: string): boolean {
  if (!optionText || !preferred) return false;

  const clean = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^a-z0-9]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

  const optNorm = clean(optionText);
  const prefNorm = clean(preferred);

  // 1. Exact normalized match
  if (optNorm === prefNorm) return true;

  // 2. Direct containment in either direction
  if (optNorm.includes(prefNorm) || prefNorm.includes(optNorm)) return true;

  // 3. Keyword token comparison
  const ignoreTokens = new Set(['ivac', 'center', 'centre', 'select', 'your']);
  const prefTokens = prefNorm.split(' ').filter((t) => t.length > 2 && !ignoreTokens.has(t));
  const optTokens = optNorm.split(' ').filter((t) => t.length > 2 && !ignoreTokens.has(t));

  if (prefTokens.length > 0 && optTokens.length > 0) {
    // If all significant preferred tokens match
    const allPrefInOpt = prefTokens.every((t) =>
      optTokens.some((o) => o.includes(t) || t.includes(o))
    );
    if (allPrefInOpt) return true;

    // Or primary city token matches (e.g. "rajshahi", "chittagong", "sylhet", "khulna")
    const primaryToken = prefTokens[0];
    if (optTokens.some((o) => o === primaryToken || o.startsWith(primaryToken))) {
      return true;
    }
  }

  return false;
}

/**
 * Centre Selection Adapter for IVAC Portal
 * Supports both modern IVAC portal custom dropdowns (/appointment/mission)
 * and legacy HTMLSelectElement / radio interfaces.
 */
export class CentreAdapter {
  private centreSelectors = [
    'select[name="center"]',
    'select[name="centre"]',
    'select[name="ivac_center"]',
    'select[id*="center" i]',
    'select[id*="centre" i]',
    '.center-select select',
    '#centre_id'
  ];

  /**
   * Finds the select dropdown or interactive centre buttons
   */
  public findCentreElement(): HTMLSelectElement | HTMLElement[] | null {
    // Check standard HTMLSelectElement
    for (const sel of this.centreSelectors) {
      const el = document.querySelector<HTMLSelectElement>(sel);
      if (el) return el;
    }

    // Check radio buttons or custom card list
    const options = Array.from(document.querySelectorAll<HTMLElement>('[data-centre], input[name*="centre" i], input[name*="center" i]'));
    if (options.length > 0) return options;

    return null;
  }

  /**
   * Finds the custom IVAC center dropdown trigger button (modern portal)
   */
  public findCentreTriggerButton(): HTMLButtonElement | null {
    const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>('button'));
    for (const btn of buttons) {
      const text = (btn.textContent || '').trim().toLowerCase();
      // Must not be the disabled mission button
      if (text.includes('select your ivac center') || (text.includes('ivac center') && !text.includes('select a mission'))) {
        return btn;
      }
    }
    return null;
  }

  /**
   * Detects the mission currently active/selected on the IVAC portal (e.g. "Rajshahi")
   */
  public detectPortalMission(): string | null {
    const elements = Array.from(document.querySelectorAll<HTMLElement>('button, div'));
    for (const el of elements) {
      const text = (el.textContent || '').trim();
      if (text.toLowerCase().includes('select a mission')) {
        const missionSpan = el.querySelector<HTMLElement>('span.text-lg, span.text-xl, span.font-medium, p');
        if (missionSpan && missionSpan.textContent) {
          const val = missionSpan.textContent.trim();
          if (val && !val.toLowerCase().includes('select a mission')) {
            return val;
          }
        }
      }
    }
    return null;
  }

  /**
   * Scans the active portal session for available centers in the dropdown
   */
  public detectSessionCentres(): { mission?: string; centres: string[] } {
    const mission = this.detectPortalMission() || undefined;
    const centres: string[] = [];

    const triggerBtn = this.findCentreTriggerButton();
    let dropdownContainer = document.querySelector<HTMLElement>('.absolute.z-50, [role="listbox"], .dropdown-menu');

    if (!dropdownContainer && triggerBtn) {
      try {
        triggerBtn.click();
        dropdownContainer = document.querySelector<HTMLElement>('.absolute.z-50, [role="listbox"], .dropdown-menu');
      } catch {}
    }

    if (dropdownContainer) {
      const buttons = Array.from(dropdownContainer.querySelectorAll<HTMLButtonElement>('button'));
      for (const btn of buttons) {
        const text = (btn.textContent || '').trim();
        if (text && !text.toLowerCase().includes('select ivac') && !centres.includes(text)) {
          centres.push(text);
        }
      }
    }

    return { mission, centres };
  }

  /**
   * Attempts to select the centre matching preferredCentre
   */
  public selectPreferredCentre(preferredCentre: string): { success: boolean; message: string; selectedValue?: string } {
    const targetLower = preferredCentre.trim().toLowerCase();

    // Case 1: Standard Select dropdown
    const element = this.findCentreElement();
    if (element instanceof HTMLSelectElement) {
      let matchedOption: HTMLOptionElement | null = null;

      for (let i = 0; i < element.options.length; i++) {
        const opt = element.options[i];
        if (matchCentreOption(opt.text, preferredCentre) || matchCentreOption(opt.value, preferredCentre)) {
          matchedOption = opt;
          break;
        }
      }

      if (!matchedOption) {
        return {
          success: false,
          message: `Centre "${preferredCentre}" not found among available options in the dropdown.`
        };
      }

      element.value = matchedOption.value;
      element.dispatchEvent(new Event('input', { bubbles: true }));
      element.dispatchEvent(new Event('change', { bubbles: true }));

      if (element.value !== matchedOption.value) {
        return {
          success: false,
          message: `Attempted to select centre "${matchedOption.text}", but selection did not register. Please select manually.`
        };
      }

      return {
        success: true,
        selectedValue: matchedOption.text,
        message: `Selected centre "${matchedOption.text}".`
      };
    }

    // Case 2: Modern portal custom button dropdown (e.g. /appointment/mission)
    const triggerBtn = this.findCentreTriggerButton();
    if (triggerBtn) {
      // Check if dropdown popup is already open
      let dropdownContainer = document.querySelector<HTMLElement>('.absolute.z-50, [role="listbox"], .dropdown-menu');

      if (!dropdownContainer) {
        // Click to open dropdown list
        try {
          triggerBtn.click();
        } catch {}
        dropdownContainer = document.querySelector<HTMLElement>('.absolute.z-50, [role="listbox"], .dropdown-menu');
      }

      // Search for option buttons inside dropdown list or on page
      const optionButtons = Array.from(
        (dropdownContainer || document).querySelectorAll<HTMLButtonElement>('button')
      ).filter(b => b !== triggerBtn);

      let matchedBtn: HTMLButtonElement | null = null;
      for (const btn of optionButtons) {
        const text = (btn.textContent || '').trim();
        if (matchCentreOption(text, preferredCentre)) {
          matchedBtn = btn;
          break;
        }
      }

      // If no exact match, check if there's only 1 center option (e.g. for mission Rajshahi, only IVAC, RAJSHAHI)
      if (!matchedBtn && optionButtons.length === 1) {
        matchedBtn = optionButtons[0];
      }

      if (matchedBtn) {
        const chosenText = matchedBtn.textContent?.trim() || preferredCentre;
        try {
          matchedBtn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
          matchedBtn.click();
          matchedBtn.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
        } catch {}

        return {
          success: true,
          selectedValue: chosenText,
          message: `Selected IVAC center "${chosenText}".`
        };
      }
    }

    // Case 3: Radio buttons or custom cards
    if (Array.isArray(element)) {
      for (const item of element) {
        const text = (item.textContent || '').trim().toLowerCase();
        const val = item.getAttribute('value')?.toLowerCase() || '';

        if (text.includes(targetLower) || val.includes(targetLower)) {
          item.click();

          const isChecked = (item as HTMLInputElement).checked === true;
          const isSelected =
            item.classList.contains('active') ||
            item.classList.contains('selected') ||
            item.getAttribute('aria-checked') === 'true' ||
            item.getAttribute('aria-selected') === 'true';

          if (isChecked || isSelected) {
            return {
              success: true,
              selectedValue: preferredCentre,
              message: `Selected centre "${preferredCentre}".`
            };
          }

          return {
            success: false,
            message: `Clicked centre "${preferredCentre}", but selection confirmation was not detected on the page. Please select manually.`
          };
        }
      }
    }

    return {
      success: false,
      message: `Could not match centre "${preferredCentre}". Please select manually.`
    };
  }

  /**
   * Locates the "Confirm Mission & IVAC Center" submit button
   */
  public findConfirmCentreButton(): HTMLButtonElement | null {
    const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>('button, input[type="submit"]'));
    for (const btn of buttons) {
      const text = (btn.textContent || (btn as HTMLInputElement).value || '').trim().toLowerCase();
      if (text.includes('confirm mission') || text.includes('confirm mission & ivac center')) {
        return btn;
      }
    }
    return null;
  }

  /**
   * Checks if the "Confirm Mission & IVAC Center" button is enabled
   */
  public isConfirmCentreButtonEnabled(): boolean {
    const btn = this.findConfirmCentreButton();
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
   * Clicks the "Confirm Mission & IVAC Center" button
   */
  public clickConfirmCentreButton(): { success: boolean; message: string } {
    const btn = this.findConfirmCentreButton();
    if (!btn) {
      return {
        success: false,
        message: 'Could not find "Confirm Mission & IVAC Center" button.'
      };
    }

    if (!this.isConfirmCentreButtonEnabled()) {
      return {
        success: false,
        message: '"Confirm Mission & IVAC Center" button is currently disabled.'
      };
    }

    try {
      btn.click();
      return {
        success: true,
        message: 'Clicked "Confirm Mission & IVAC Center".'
      };
    } catch (err: any) {
      return {
        success: false,
        message: `Failed to click button: ${err.message}`
      };
    }
  }
}

export const centreAdapter = new CentreAdapter();
