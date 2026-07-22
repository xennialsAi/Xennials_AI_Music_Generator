import { jsPDF } from 'jspdf';

/**
 * Exports composition lyrics to a beautifully formatted PDF for offline printing.
 * Includes a professional, clean layout with customizable styling, metadata header,
 * and elegant section styling for bracket-enclosed timing labels.
 */
export function exportLyricsToPDF(title: string, lyrics: string) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  const contentWidth = pageWidth - (margin * 2);

  // Background style: premium off-white canvas
  doc.setFillColor(252, 252, 252);
  doc.rect(0, 0, pageWidth, pageHeight, 'F');

  // Subtle clean border
  doc.setDrawColor(228, 228, 231);
  doc.setLineWidth(0.4);
  doc.rect(10, 10, pageWidth - 20, pageHeight - 20);

  // Professional header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(140, 140, 150);
  doc.text('XENNIALS STUDIO • OFFICIAL COMPOSITION LYRIC SHEET', margin, 18);

  // Divider line
  doc.setDrawColor(212, 212, 216);
  doc.setLineWidth(0.2);
  doc.line(margin, 21, pageWidth - margin, 21);

  // Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(24, 24, 37);
  const displayTitle = (title || 'Untitled Composition').trim().toUpperCase();
  doc.text(displayTitle, margin, 32);

  // Subtitle/Metadata
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(115, 115, 125);
  const dateStr = new Date().toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
  doc.text(`Studio Printout: ${dateStr}   |   Format: Lyrics Lead Sheet`, margin, 38);

  // Divider under metadata
  doc.setDrawColor(212, 212, 216);
  doc.line(margin, 42, pageWidth - margin, 42);

  // Start rendering lyrics
  let y = 50;
  const lineHeight = 6.5;

  // Split text by lines to parse and format each individually
  const rawLines = lyrics.split('\n');

  rawLines.forEach((rawLine) => {
    // Check page overflow first
    if (y > pageHeight - margin - 15) {
      doc.addPage();

      // Background & border for new page
      doc.setFillColor(252, 252, 252);
      doc.rect(0, 0, pageWidth, pageHeight, 'F');

      doc.setDrawColor(228, 228, 231);
      doc.setLineWidth(0.4);
      doc.rect(10, 10, pageWidth - 20, pageHeight - 20);

      // Header again
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(140, 140, 150);
      doc.text(`XENNIALS STUDIO • ${displayTitle}`, margin, 18);

      doc.setDrawColor(212, 212, 216);
      doc.setLineWidth(0.2);
      doc.line(margin, 21, pageWidth - margin, 21);

      y = 30; // reset y coordinate for new page
    }

    const trimmed = rawLine.trim();

    // Check if line contains bracket sections (e.g., timing cue "[0:00 - 0:15]" or sections like "[Chorus]")
    if (trimmed.startsWith('[') && trimmed.includes(']')) {
      const closingBracketIndex = trimmed.indexOf(']');
      const bracketText = trimmed.substring(0, closingBracketIndex + 1);
      const remainingText = trimmed.substring(closingBracketIndex + 1).trim();

      // Print the bracket part in elegant purple
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(147, 51, 234); // Purple 600
      doc.text(bracketText, margin, y);

      if (remainingText) {
        // Print the remaining text on the same line but normal styling
        const bracketWidth = doc.getTextWidth(bracketText) + 3;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(11);
        doc.setTextColor(38, 38, 38);
        doc.text(remainingText, margin + bracketWidth, y);
      }
      y += lineHeight;
    } else {
      // Normal lyrics line
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(11);
      doc.setTextColor(64, 64, 70);

      const splitLyricsLines = doc.splitTextToSize(rawLine, contentWidth);
      splitLyricsLines.forEach((sLine: string) => {
        // Handle nested overflow if a single raw line wraps
        if (y > pageHeight - margin - 15) {
          doc.addPage();
          doc.setFillColor(252, 252, 252);
          doc.rect(0, 0, pageWidth, pageHeight, 'F');
          doc.setDrawColor(228, 228, 231);
          doc.setLineWidth(0.4);
          doc.rect(10, 10, pageWidth - 20, pageHeight - 20);

          doc.setFont('helvetica', 'bold');
          doc.setFontSize(8);
          doc.setTextColor(140, 140, 150);
          doc.text(`XENNIALS STUDIO • ${displayTitle}`, margin, 18);

          doc.setDrawColor(212, 212, 216);
          doc.setLineWidth(0.2);
          doc.line(margin, 21, pageWidth - margin, 21);

          y = 30;
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(11);
          doc.setTextColor(64, 64, 70);
        }

        doc.text(sLine, margin, y);
        y += lineHeight;
      });
    }

    // Add extra tiny spacing for empty lines to separate stanzas nicely
    if (trimmed === '') {
      y += 3;
    }
  });

  // Stamp page numbers and workspace watermark on all pages
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(150, 150, 160);
    doc.text(`Page ${p} of ${totalPages}`, pageWidth - margin - 12, pageHeight - 14);
    doc.text('GENERATED SECURELY VIA XENNIALS STUDIO • REMOTION-COMPATIBLE WORKSPACE', margin, pageHeight - 14);
  }

  // Save the PDF
  const cleanFilename = `${displayTitle.toLowerCase().replace(/[^a-z0-9]+/g, '_')}_lyrics.pdf`;
  doc.save(cleanFilename);
}
