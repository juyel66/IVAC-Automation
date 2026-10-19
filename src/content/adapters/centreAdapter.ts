/**
 * Centre Selection Adapter for IVAC Portal
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
   * Attempts to select the centre matching preferredCentre
   */
  public selectPreferredCentre(preferredCentre: string): { success: boolean; message: string; selectedValue?: string } {
    const element = this.findCentreElement();

    if (!element) {
      return {
        success: false,
        message: 'Could not detect IVAC centre selection field on the current page.'
      };
    }

    const targetLower = preferredCentre.trim().toLowerCase();

    // Case 1: Standard Select dropdown
    if (element instanceof HTMLSelectElement) {
      let matchedOption: HTMLOptionElement | null = null;

      for (let i = 0; i < element.options.length; i++) {
        const opt = element.options[i];
        const text = opt.text.trim().toLowerCase();
        const val = opt.value.trim().toLowerCase();

        if (text.includes(targetLower) || val.includes(targetLower)) {
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

      return {
        success: true,
        selectedValue: matchedOption.text,
        message: `Selected centre "${matchedOption.text}".`
      };
    }

    // Case 2: Radio buttons or custom cards
    if (Array.isArray(element)) {
      for (const item of element) {
        const text = (item.textContent || '').trim().toLowerCase();
        const val = item.getAttribute('value')?.toLowerCase() || '';

        if (text.includes(targetLower) || val.includes(targetLower)) {
          item.click();
          return {
            success: true,
            selectedValue: preferredCentre,
            message: `Selected centre "${preferredCentre}".`
          };
        }
      }
    }

    return {
      success: false,
      message: `Could not match centre "${preferredCentre}". Please select manually.`
    };
  }
}

export const centreAdapter = new CentreAdapter();
