import { ItemDonationCategory, ItemDonationWeightUnit } from '@prisma/client';
import PDFDocument from 'pdfkit';
import path from 'node:path';
import { PassThrough } from 'node:stream';

const DEVANAGARI_FONT = 'NotoSansDevanagari';
const DEVANAGARI_FONT_PATH = path.join(
  process.cwd(),
  'server/api/assets/noto-sans-devanagari-devanagari-400-normal.woff',
);
const DEVANAGARI_PATTERN = /[\u0900-\u097F]/u;
const GRAPHEME_SEGMENTER = new Intl.Segmenter('mr', { granularity: 'grapheme' });
const MARGIN = 42;
const INK = '#241914';
const MUTED = '#6B7280';
const SAFFRON = '#C2410C';
const SAFFRON_SOFT = '#FFF2E8';
const GREEN = '#157347';
const GREEN_SOFT = '#EAF7EF';
const RED = '#B42318';
const RED_SOFT = '#FDECEC';
const LINE = '#E5E7EB';
const PANEL = '#F8FAFC';

export interface ItemDonationPdfRow {
  category: ItemDonationCategory;
  createdBy: string;
  donationDate: Date;
  donorAddress?: string | null;
  donorName: string;
  donorPhone?: string | null;
  itemName: string;
  notes?: string | null;
  purity?: string | null;
  quantity: number;
  receiptNumber: string;
  storageLocation?: string | null;
  weight?: number | null;
  weightUnit?: ItemDonationWeightUnit | null;
}

export interface ItemDonationPdfContext {
  festivalName: string;
  generatedAt: Date;
  mandalAddress?: string | null;
  mandalName: string;
}

export function createItemDonationReceiptPdf(
  context: ItemDonationPdfContext,
  donation: ItemDonationPdfRow,
): PassThrough {
  const output = new PassThrough();
  const doc = new PDFDocument({
    autoFirstPage: false,
    bufferPages: true,
    info: {
      Author: 'Samavet ePawati',
      CreationDate: context.generatedAt,
      Subject: 'Physical item donation receipt',
      Title: `${context.mandalName} - Item Donation Receipt ${donation.receiptNumber}`,
    },
    layout: 'landscape',
    margin: MARGIN,
    size: 'A4',
  });
  doc.registerFont(DEVANAGARI_FONT, DEVANAGARI_FONT_PATH);
  doc.pipe(output);
  doc.addPage();

  drawReceiptHeader(doc, context, donation);
  drawReceiptSummary(doc, donation);
  drawAcknowledgement(doc, donation);
  drawReceiptDetails(doc, donation);
  drawReceiptSignatures(doc);
  drawFooter(doc, 1, 1, context.generatedAt, 'Item donation receipt');

  doc.end();
  return output;
}

export function createItemDonationReportPdf(
  context: ItemDonationPdfContext & { filters: string[]; reportPeriod: string },
  rows: ItemDonationPdfRow[],
): PassThrough {
  const output = new PassThrough();
  const doc = new PDFDocument({
    autoFirstPage: false,
    bufferPages: true,
    info: {
      Author: 'Samavet ePawati',
      CreationDate: context.generatedAt,
      Subject: 'Physical item donation register',
      Title: `${context.mandalName} - Item Donation Report`,
    },
    layout: 'landscape',
    margin: MARGIN,
    size: 'A4',
  });
  doc.registerFont(DEVANAGARI_FONT, DEVANAGARI_FONT_PATH);
  doc.pipe(output);
  doc.addPage();

  drawReportHeader(doc, context);
  drawReportSummary(doc, rows);
  drawCategoryBreakdown(doc, rows);
  drawReportTable(doc, rows);

  const range = doc.bufferedPageRange();
  for (let pageIndex = range.start; pageIndex < range.start + range.count; pageIndex += 1) {
    doc.switchToPage(pageIndex);
    drawFooter(doc, pageIndex - range.start + 1, range.count, context.generatedAt, 'Item donation register');
  }

  doc.end();
  return output;
}

function drawReceiptHeader(
  doc: PDFKit.PDFDocument,
  context: ItemDonationPdfContext,
  donation: ItemDonationPdfRow,
): void {
  const width = contentWidth(doc);
  doc.roundedRect(MARGIN, MARGIN, width, 68, 10).fill(INK);
  drawMultiscriptText(doc, 'Item Donation Receipt', MARGIN + 22, MARGIN + 15, 360, 22, 'left', '#FFFFFF', 19, true);
  drawMultiscriptText(
    doc,
    `${context.mandalName}  |  ${context.festivalName}`,
    MARGIN + 22,
    MARGIN + 43,
    480,
    12,
    'left',
    '#FED7AA',
    9.5,
  );
  if (context.mandalAddress) {
    drawMultiscriptText(doc, context.mandalAddress, MARGIN + 22, MARGIN + 57, 430, 10, 'left', '#D1D5DB', 7);
  }
  drawMultiscriptText(doc, donation.receiptNumber, doc.page.width - MARGIN - 230, MARGIN + 18, 208, 13, 'right', '#FFFFFF', 12, true);
  drawMultiscriptText(doc, `Issued ${formatDate(context.generatedAt)}`, doc.page.width - MARGIN - 230, MARGIN + 41, 208, 10, 'right', '#D1D5DB', 8);
  doc.y = MARGIN + 86;
}

function drawReceiptSummary(doc: PDFKit.PDFDocument, donation: ItemDonationPdfRow): void {
  const gap = 10;
  const width = (contentWidth(doc) - gap * 3) / 4;
  const y = doc.y;
  const cards = [
    { color: SAFFRON, fill: SAFFRON_SOFT, label: 'DONOR', note: donation.donorPhone || 'Mobile not added', value: donation.donorName },
    { color: GREEN, fill: GREEN_SOFT, label: 'ITEM CATEGORY', note: donation.itemName, value: formatCategory(donation.category) },
    { color: SAFFRON, fill: SAFFRON_SOFT, label: 'WEIGHT', note: donation.purity || 'Purity not recorded', value: formatWeight(donation) },
    { color: RED, fill: RED_SOFT, label: 'QUANTITY', note: formatDate(donation.donationDate), value: String(donation.quantity) },
  ];

  cards.forEach((card, index) => {
    const x = MARGIN + index * (width + gap);
    doc.roundedRect(x, y, width, 58, 9).fillAndStroke(card.fill, card.fill);
    doc.fillColor(card.color).font('Helvetica-Bold').fontSize(7.2).text(card.label, x + 13, y + 9, { lineBreak: false, width: width - 26 });
    drawMultiscriptText(doc, truncate(card.value, 27), x + 13, y + 26, width - 26, 14, 'left', INK, 12, true);
    drawMultiscriptText(doc, truncate(card.note, 34), x + 13, y + 47, width - 26, 8, 'left', MUTED, 7);
  });
  doc.y = y + 74;
}

function drawAcknowledgement(doc: PDFKit.PDFDocument, donation: ItemDonationPdfRow): void {
  const y = doc.y;
  const text = `Received with gratitude from ${donation.donorName} the item "${donation.itemName}" for ${formatCategory(donation.category).toLowerCase()} seva/offering. This receipt records the physical item only and does not include any cash amount.`;
  doc.roundedRect(MARGIN, y, contentWidth(doc), 42, 8).fillAndStroke(PANEL, LINE);
  doc.fillColor(INK).font('Helvetica-Bold').fontSize(9).text('Acknowledgement', MARGIN + 14, y + 10, { lineBreak: false });
  drawMultiscriptText(doc, truncate(text, 170), MARGIN + 14, y + 27, contentWidth(doc) - 28, 10, 'left', MUTED, 7.5);
  doc.y = y + 56;
}

function drawReceiptDetails(doc: PDFKit.PDFDocument, donation: ItemDonationPdfRow): void {
  drawSectionTitle(doc, 'Donation details', 'Official physical-item register entry.');
  const headers = ['Field', 'Recorded detail', 'Field', 'Recorded detail'];
  const widths = [105, 280, 105, contentWidth(doc) - 490];
  drawTableHeader(doc, headers, widths);
  [
    ['Receipt number', donation.receiptNumber, 'Donation date', formatDate(donation.donationDate)],
    ['Donor address', donation.donorAddress || '-', 'Storage', donation.storageLocation || '-'],
    ['Item name', donation.itemName, 'Category', formatCategory(donation.category)],
    ['Weight', formatWeight(donation), 'Purity', donation.purity || '-'],
    ['Quantity', String(donation.quantity), 'Remarks', donation.notes || '-'],
    ['Recorded by', donation.createdBy, 'Declaration', 'Physical item only'],
  ].forEach((row) => drawTableRow(doc, row,  widths, 22));
  doc.y += 12;
}

function drawReceiptSignatures(doc: PDFKit.PDFDocument): void {
  const y = 494;
  const width = contentWidth(doc);
  doc.moveTo(MARGIN, y - 18).lineTo(MARGIN + width, y - 18).strokeColor(LINE).lineWidth(0.7).stroke();
  drawSignature(doc, MARGIN, y, 'Received by Adhyaksh');
  drawSignature(doc, MARGIN + width / 2 - 80, y, 'Mandal seal / stamp');
  drawSignature(doc, doc.page.width - MARGIN - 190, y, 'Donor signature');
}

function drawSignature(doc: PDFKit.PDFDocument, x: number, y: number, label: string): void {
  doc.strokeColor(LINE).moveTo(x, y).lineTo(x + 190, y).stroke();
  doc.fillColor(MUTED).font('Helvetica').fontSize(7.5).text(label, x, y + 8, { align: x > doc.page.width / 2 ? 'right' : 'left', lineBreak: false, width: 190 });
}

function drawReportHeader(
  doc: PDFKit.PDFDocument,
  context: ItemDonationPdfContext & { filters: string[]; reportPeriod: string },
): void {
  const width = contentWidth(doc);
  doc.roundedRect(MARGIN, MARGIN, width, 76, 10).fill(INK);
  drawMultiscriptText(doc, 'Item Donation Report', MARGIN + 20, MARGIN + 17, 360, 22, 'left', '#FFFFFF', 20, true);
  drawMultiscriptText(doc, `${context.mandalName}  |  ${context.festivalName}`, MARGIN + 20, MARGIN + 47, 430, 12, 'left', '#FED7AA', 9.5);
  drawMultiscriptText(doc, context.reportPeriod, doc.page.width - MARGIN - 250, MARGIN + 18, 230, 10, 'right', '#FFFFFF', 8.5, true);
  drawMultiscriptText(doc, `Generated ${formatDateTime(context.generatedAt)}`, doc.page.width - MARGIN - 250, MARGIN + 39, 230, 10, 'right', '#D1D5DB', 7.5);
  doc.y = MARGIN + 92;
  if (context.filters.length > 0) {
    drawMultiscriptText(doc, `Applied filters: ${context.filters.join(' | ')}`, MARGIN, doc.y, contentWidth(doc), 10, 'left', MUTED, 8);
    doc.y += 16;
  }
}

function drawReportSummary(doc: PDFKit.PDFDocument, rows: ItemDonationPdfRow[]): void {
  const gap = 10;
  const width = (contentWidth(doc) - gap * 3) / 4;
  const y = doc.y;
  const categoryCounts = countByCategory(rows);
  const cards = [
    { color: SAFFRON, fill: SAFFRON_SOFT, label: 'GOLD ITEMS', note: weightByCategory(rows, ItemDonationCategory.GOLD) || 'No weight recorded', value: String(categoryCounts.get(ItemDonationCategory.GOLD) ?? 0) },
    { color: INK, fill: PANEL, label: 'SILVER ITEMS', note: weightByCategory(rows, ItemDonationCategory.SILVER) || 'No weight recorded', value: String(categoryCounts.get(ItemDonationCategory.SILVER) ?? 0) },
    { color: GREEN, fill: GREEN_SOFT, label: 'JEWELLERY', note: weightByCategory(rows, ItemDonationCategory.JEWELLERY) || 'No weight recorded', value: String(categoryCounts.get(ItemDonationCategory.JEWELLERY) ?? 0) },
    { color: RED, fill: RED_SOFT, label: 'TOTAL ENTRIES', note: `${totalQuantity(rows)} total quantity`, value: String(rows.length) },
  ];

  cards.forEach((card, index) => {
    const x = MARGIN + index * (width + gap);
    doc.roundedRect(x, y, width, 64, 8).fillAndStroke(card.fill, card.fill);
    doc.fillColor(card.color).font('Helvetica-Bold').fontSize(7.5).text(card.label, x + 12, y + 10, { lineBreak: false, width: width - 24 });
    drawMultiscriptText(doc, card.value, x + 12, y + 27, width - 24, 18, 'left', INK, 16, true);
    drawMultiscriptText(doc, card.note, x + 12, y + 49, width - 24, 9, 'left', MUTED, 7.2);
  });
  doc.y = y + 82;
}

function drawCategoryBreakdown(doc: PDFKit.PDFDocument, rows: ItemDonationPdfRow[]): void {
  drawSectionTitle(doc, 'Category analysis', 'All item donation categories are included in this single PDF.');
  const headers = ['Category', 'Entries', 'Quantity', 'Recorded weight'];
  const widths = [310, 110, 110, contentWidth(doc) - 530];
  drawTableHeader(doc, headers, widths);
  ITEM_CATEGORIES.forEach((category) => {
    const items = rows.filter((row) => row.category === category);
    drawTableRow(doc, [
      formatCategory(category),
      String(items.length),
      String(totalQuantity(items)),
      weightByCategory(rows, category) || '-',
    ], widths);
  });
  drawTableRow(doc, ['Total', String(rows.length), String(totalQuantity(rows)), allWeightSummary(rows) || '-'], widths, 25, true);
  doc.y += 14;
}

function drawReportTable(doc: PDFKit.PDFDocument, rows: ItemDonationPdfRow[]): void {
  ensureSpace(doc, 34 + 22 + Math.min(Math.max(rows.length, 1), 3) * 23);
  drawSectionTitle(doc, 'Item donation register', `Latest ${rows.length} physical item donation entries.`);
  const headers = ['Date', 'Receipt', 'Donor', 'Category', 'Item', 'Weight', 'Qty', 'Storage / remarks'];
  const widths = [62, 76, 126, 70, 104, 76, 38, contentWidth(doc) - 552];
  drawTableHeader(doc, headers, widths);
  if (rows.length === 0) {
    drawEmptyRow(doc, 'No item donations found for this report.');
    return;
  }

  rows.forEach((row) => {
    ensureSpace(doc, 28, () => drawTableHeader(doc, headers, widths));
    drawTableRow(doc, [
      formatDate(row.donationDate),
      row.receiptNumber,
      row.donorName,
      formatCategory(row.category),
      row.itemName,
      formatWeight(row),
      String(row.quantity),
      [row.storageLocation, row.notes].filter(Boolean).join(' - ') || '-',
    ], widths, 23);
  });
}

function drawSectionTitle(doc: PDFKit.PDFDocument, title: string, subtitle: string): void {
  ensureSpace(doc, 52);
  drawMultiscriptText(doc, title, MARGIN, doc.y, 280, 15, 'left', INK, 13, true);
  drawMultiscriptText(doc, subtitle, MARGIN, doc.y + 20, contentWidth(doc), 10, 'left', MUTED, 8);
  doc.y += 34;
}

function drawTableHeader(doc: PDFKit.PDFDocument, headers: string[], widths: number[]): void {
  ensureSpace(doc, 23);
  const y = doc.y;
  doc.rect(MARGIN, y, widths.reduce((sum, width) => sum + width, 0), 22).fill(INK);
  let x = MARGIN;
  headers.forEach((header, index) => {
    const align = index > 0 && ['Entries', 'Quantity', 'Qty'].includes(header) ? 'right' : 'left';
    doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(7.5)
      .text(header.toUpperCase(), x + 7, y + 7,
      {
        align,
        height: 10,
        lineBreak: false,
        width: widths[index] - 14,
      });
    x += widths[index];
  });
  doc.y = y + 22;
}

function drawTableRow(doc: PDFKit.PDFDocument, cells: string[], widths: number[], rowHeight = 23, bold = false): void {
  const y = doc.y;
  let x = MARGIN;
  doc.rect(MARGIN, y, widths.reduce((sum, width) => sum + width, 0), rowHeight).fillAndStroke(bold ? SAFFRON_SOFT : '#FFFFFF', LINE);
  cells.forEach((cell, index) => {
    const align = index > 0 && widths[index] <= 110 && /^\d+(\.\d+)?$/.test(cell) ? 'right' : 'left';
    drawMultiscriptText(
      doc,
      truncate(cell, widths[index] > 150 ? 46 : 25),
      x + 7,
      y + 7,
      widths[index] - 14,
      10,
      align,
      bold ? SAFFRON : INK,
      7.5,
      bold,
    );
    x += widths[index];
  });
  doc.y = y + rowHeight;
}

function drawEmptyRow(doc: PDFKit.PDFDocument, message: string): void {
  const y = doc.y;
  doc.rect(MARGIN, y, contentWidth(doc), 34).fillAndStroke('#FFFFFF', LINE);
  drawMultiscriptText(doc, message, MARGIN + 10, y + 12, contentWidth(doc) - 20, 10, 'left', MUTED, 8);
  doc.y = y + 34;
}

function drawFooter(doc: PDFKit.PDFDocument, page: number, totalPages: number, generatedAt: Date, label: string): void {
  const y = doc.page.height - 54;
  doc.moveTo(MARGIN, y - 8).lineTo(doc.page.width - MARGIN, y - 8).strokeColor(LINE).lineWidth(0.7).stroke();
  doc.fillColor(MUTED).font('Helvetica').fontSize(7)
    .text(`Samavet ePawati - ${label}`, MARGIN, y, { lineBreak: false, width: 320 });
  doc.text(`Generated ${formatDate(generatedAt)}  |  Page ${page} of ${totalPages}`, doc.page.width - MARGIN - 260, y, {
    align: 'right',
    lineBreak: false,
    width: 260,
  });
}

function ensureSpace(doc: PDFKit.PDFDocument, needed: number, redraw?: () => void): void {
  if (doc.y + needed <= doc.page.height - 72) return;
  doc.addPage();
  doc.x = MARGIN;
  doc.y = MARGIN;
  if (redraw) redraw();
}

const ITEM_CATEGORIES = [
  ItemDonationCategory.GOLD,
  ItemDonationCategory.SILVER,
  ItemDonationCategory.JEWELLERY,
  ItemDonationCategory.OTHER,
];

function countByCategory(rows: ItemDonationPdfRow[]) {
  const counts = new Map<ItemDonationCategory, number>();
  rows.forEach((row) => counts.set(row.category, (counts.get(row.category) ?? 0) + 1));
  return counts;
}

function weightByCategory(rows: ItemDonationPdfRow[], category: ItemDonationCategory): string {
  return weightSummary(rows.filter((row) => row.category === category));
}

function allWeightSummary(rows: ItemDonationPdfRow[]): string {
  return weightSummary(rows);
}

function weightSummary(rows: ItemDonationPdfRow[]): string {
  const totals = new Map<ItemDonationWeightUnit, number>();
  rows
    .filter((row) => row.weight && row.weightUnit)
    .forEach((row) => totals.set(row.weightUnit as ItemDonationWeightUnit, (totals.get(row.weightUnit as ItemDonationWeightUnit) ?? 0) + Number(row.weight)));
  return Array.from(totals.entries()).map(([unit, total]) => `${formatNumber(total)} ${formatUnit(unit)}`).join(' | ');
}

function totalQuantity(rows: ItemDonationPdfRow[]): number {
  return rows.reduce((sum, row) => sum + row.quantity, 0);
}

function formatWeight(row: ItemDonationPdfRow): string {
  if (!row.weight || !row.weightUnit) return '-';
  return `${formatNumber(row.weight)} ${formatUnit(row.weightUnit)}`;
}

function formatNumber(value: number): string {
  return Number(value).toLocaleString('en-IN', { maximumFractionDigits: 3 });
}

function formatCategory(value: ItemDonationCategory): string {
  return value.charAt(0) + value.slice(1).toLowerCase();
}

function formatUnit(value: ItemDonationWeightUnit): string {
  if (value === ItemDonationWeightUnit.GRAM) return 'g';
  if (value === ItemDonationWeightUnit.KG) return 'kg';
  return 'tola';
}

function formatDate(value: Date): string {
  return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(value);
}

function formatDateTime(value: Date): string {
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(value);
}

function truncate(value: string, limit: number): string {
  const graphemes = Array.from(GRAPHEME_SEGMENTER.segment(value), ({ segment }) => segment);
  if (graphemes.length <= limit) return value;
  return `${graphemes.slice(0, Math.max(0, limit - 3)).join('')}...`;
}

function contentWidth(doc: PDFKit.PDFDocument): number {
  return doc.page.width - MARGIN * 2;
}

function drawMultiscriptText(
  doc: PDFKit.PDFDocument,
  value: string,
  x: number,
  y: number,
  width: number,
  height: number,
  align: 'left' | 'right',
  color: string,
  fontSize: number,
  bold = false,
): void {
  const normalized = value.normalize('NFC');
  const runs = splitFontRuns(normalized);
  const fallbackFont = bold ? 'Helvetica-Bold' : 'Helvetica';
  const measuredRuns = runs.map((run) => {
    const font = run.devanagari ? DEVANAGARI_FONT : fallbackFont;
    doc.font(font).fontSize(fontSize);
    return { ...run, font, width: doc.widthOfString(run.text) };
  });
  const totalWidth = measuredRuns.reduce((sum, run) => sum + run.width, 0);
  let cursorX = align === 'right' ? Math.max(x, x + width - totalWidth) : x;

  doc.save().rect(x, y - 1, width, height + 2).clip();
  for (const run of measuredRuns) {
    doc.fillColor(color).font(run.font).fontSize(fontSize)
      .text(run.text, cursorX, y, { lineBreak: false });
    cursorX += run.width;
  }
  doc.restore();
}

function splitFontRuns(value: string): Array<{ devanagari: boolean; text: string }> {
  const runs: Array<{ devanagari: boolean; text: string }> = [];
  for (const character of value) {
    const devanagari = DEVANAGARI_PATTERN.test(character);
    const previous = runs.at(-1);
    if (previous?.devanagari === devanagari) {
      previous.text += character;
    } else {
      runs.push({ devanagari, text: character });
    }
  }
  return runs;
}
