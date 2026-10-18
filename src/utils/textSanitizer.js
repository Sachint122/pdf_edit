/**
 * Text Sanitizer for PDF Standard Fonts (WinAnsi / Latin-1)
 * Replaces unencodable Unicode characters, currency symbols, and emojis
 * with compatible ASCII/WinAnsi equivalents to prevent pdf-lib export crashes.
 */

// Common Unicode symbol replacements
const CHAR_REPLACEMENTS = {
  '\u20B9': 'Rs.',  // Indian Rupee (₹)
  '\u20AC': 'EUR',  // Euro (€)
  '\u00A3': 'GBP',  // Pound (£)
  '\u00A5': 'JPY',  // Yen (¥)
  '\u2022': '*',    // Bullet (•)
  '\u2023': '>',    // Triangular bullet
  '\u25E6': 'o',    // White bullet
  '\u2713': '[x]',  // Checkmark (✓)
  '\u2714': '[x]',  // Heavy Checkmark (✔)
  '\u2717': '[ ]',  // Ballot X (✗)
  '\u2718': '[ ]',  // Heavy Ballot X (✘)
  '\u201C': '"',    // Left double quote (“)
  '\u201D': '"',    // Right double quote (”)
  '\u2018': "'",    // Left single quote (‘)
  '\u2019': "'",    // Right single quote (’)
  '\u2013': '-',    // En dash (–)
  '\u2014': '--',   // Em dash (—)
  '\u2026': '...',  // Ellipsis (…)
  '\u00A0': ' ',    // Non-breaking space
};

/**
 * Sanitize text to ensure it can be safely encoded by pdf-lib's WinAnsi standard fonts.
 * @param {string} text
 * @returns {string}
 */
export function sanitizeForWinAnsi(text) {
  if (!text || typeof text !== 'string') return '';

  let sanitized = '';
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const code = text.charCodeAt(i);

    // 1. Check mapped replacement dictionary
    if (CHAR_REPLACEMENTS[char] !== undefined) {
      sanitized += CHAR_REPLACEMENTS[char];
      continue;
    }

    // 2. Standard ASCII (0x20 - 0x7E) and newline / tab
    if ((code >= 0x20 && code <= 0x7e) || code === 0x0a || code === 0x09) {
      sanitized += char;
      continue;
    }

    // 3. Supported Latin-1 Supplement characters (0xA0 - 0xFF)
    if (code >= 0xa0 && code <= 0xff) {
      sanitized += char;
      continue;
    }

    // 4. Handle surrogate pairs (e.g. emojis)
    if (code >= 0xd800 && code <= 0xdbff) {
      i++; // Skip low surrogate
      sanitized += '?';
      continue;
    }

    // 5. Fallback for unencodable unicode character
    sanitized += '?';
  }

  return sanitized;
}
