/**
 * Font Manager for PDF Export
 * Caches and embeds standard PDF fonts matching user typography selections.
 */

import { StandardFonts } from 'pdf-lib';

export class FontManager {
  constructor(pdfDoc) {
    this.pdfDoc = pdfDoc;
    this.fontCache = new Map();
  }

  /**
   * Resolve and embed a standard PDF font.
   * @param {string} [family='Helvetica']
   * @param {'normal'|'bold'} [weight='normal']
   * @param {'normal'|'italic'} [style='normal']
   * @returns {Promise<import('pdf-lib').PDFFont>}
   */
  async getFont(family = 'Helvetica', weight = 'normal', style = 'normal') {
    const isBold = weight === 'bold' || weight >= 600;
    const isItalic = style === 'italic' || style === 'oblique';
    const fam = (family || '').toLowerCase();

    let standardFontName = StandardFonts.Helvetica;

    if (fam.includes('times') || fam.includes('georgia')) {
      if (isBold && isItalic) standardFontName = StandardFonts.TimesRomanBoldItalic;
      else if (isBold) standardFontName = StandardFonts.TimesRomanBold;
      else if (isItalic) standardFontName = StandardFonts.TimesRomanItalic;
      else standardFontName = StandardFonts.TimesRoman;
    } else if (fam.includes('courier') || fam.includes('mono')) {
      if (isBold && isItalic) standardFontName = StandardFonts.CourierBoldOblique;
      else if (isBold) standardFontName = StandardFonts.CourierBold;
      else if (isItalic) standardFontName = StandardFonts.CourierOblique;
      else standardFontName = StandardFonts.Courier;
    } else {
      // Default Helvetica
      if (isBold && isItalic) standardFontName = StandardFonts.HelveticaBoldOblique;
      else if (isBold) standardFontName = StandardFonts.HelveticaBold;
      else if (isItalic) standardFontName = StandardFonts.HelveticaOblique;
      else standardFontName = StandardFonts.Helvetica;
    }

    if (!this.fontCache.has(standardFontName)) {
      const embedded = await this.pdfDoc.embedFont(standardFontName);
      this.fontCache.set(standardFontName, embedded);
    }

    return this.fontCache.get(standardFontName);
  }
}
