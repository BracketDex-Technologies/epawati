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

const PAGE_WIDTH = 841.89;
const MARGIN = 42;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const INK = '#241914';
const MUTED = '#6B7280';
const GREEN = '#157347';
const GREEN_SOFT = '#EAF7EF';
const ORANGE = '#C2410C';
const ORANGE_SOFT = '#FFF2E8';
const RED = '#B42318';
const RED_SOFT = '#FDECEC';
const LINE = '#E5E7EB';
const PANEL = '#F8FAFC';

export interface VarganiSlipsPdfMeta {
  festivalName: string;
  filters: string[];
  generatedAt: Date;
  mandalName: string;
  reportPeriod: string;
  totalAmount: number;
  totalCount: number;
}

export interface VarganiSlipsPdfRow {
  amount: number;
  area: string;
  collector: string;
  contributor: string;
  date: Date;
  paymentMode: string;
  phone: string;
  slipNumber: string;
  status: string;
}

export class VarganiSlipsPdfWriter {
  private readonly doc: PDFKit.PDFDocument;
  private pageNumber = 1;

  readonly stream = new PassThrough();

  constructor(private readonly meta: VarganiSlipsPdfMeta) {
    this.doc = new PDFDocument({
      info: {
        Author: 'Samavet ePawati',
        CreationDate: meta.generatedAt,
        Subject: 'Complete generated Vargani slip register',
        Title: `${meta.mandalName} - ${meta.festivalName} Vargani Slips`,
      },
      layout: 'landscape',
      margin: MARGIN,
      size: 'A4',
    });
    this.doc.registerFont(DEVANAGARI_FONT, DEVANAGARI_FONT_PATH);
    this.doc.pipe(this.stream);
    this.drawHeader();
    this.drawTableHeader();
  }

  addRow(row: VarganiSlipsPdfRow): void {
    this.ensureRowSpace();
    const widths = [70, 90, 140, 76, 86, 95, 65, 60, 75];
    const values = [
      formatDate(row.date),
      row.slipNumber,
      row.contributor,
      row.phone,
      row.area,
      row.collector,
      row.paymentMode,
      row.status,
      money(row.amount),
    ];
    const y = this.doc.y;
    const fill = row.status === 'Paid' ? GREEN_SOFT : row.status === 'Pending' ? ORANGE_SOFT : RED_SOFT;
    this.doc.rect(MARGIN, y, CONTENT_WIDTH, 25).fillAndStroke('#FFFFFF', LINE);
    this.doc.rect(MARGIN + CONTENT_WIDTH - widths[8] - widths[7], y, widths[7], 25).fillAndStroke(fill, LINE);

    let x = MARGIN;
    values.forEach((value, index) => {
      const align = index === values.length - 1 ? 'right' : 'left';
      const color = index === 7 ? statusColor(row.status) : INK;
      drawMultiscriptText(
        this.doc,
        truncate(value, widths[index] > 100 ? 32 : 18),
        x + 6,
        y + 8,
        widths[index] - 12,
        10,
        align,
        color,
        7.2,
        index === 7,
      );
      x += widths[index];
    });
    this.doc.y = y + 25;
  }

  finalize(): void {
    this.drawFooter();
    this.doc.end();
  }

  private drawHeader(): void {
    this.doc.roundedRect(MARGIN, MARGIN, CONTENT_WIDTH, 82, 10).fill(INK);
    this.doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(20)
      .text('All Generated Vargani Slips', MARGIN + 20, MARGIN + 16, { width: 450 });
    drawMultiscriptText(
      this.doc,
      `${this.meta.mandalName}  |  ${this.meta.festivalName}`,
      MARGIN + 20,
      MARGIN + 47,
      500,
      12,
      'left',
      '#BBF7D0',
      9,
    );
    this.doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(9)
      .text(this.meta.reportPeriod, PAGE_WIDTH - MARGIN - 260, MARGIN + 17, {
        align: 'right',
        width: 238,
      });
    this.doc.fillColor('#D1D5DB').font('Helvetica').fontSize(8)
      .text(`Generated ${formatDateTime(this.meta.generatedAt)}`, PAGE_WIDTH - MARGIN - 260, MARGIN + 38, {
        align: 'right',
        width: 238,
      });
    this.doc.fillColor('#BBF7D0').font('Helvetica-Bold').fontSize(9)
      .text(`${this.meta.totalCount} slips | ${money(this.meta.totalAmount)}`, PAGE_WIDTH - MARGIN - 260, MARGIN + 58, {
        align: 'right',
        width: 238,
      });

    this.doc.y = MARGIN + 98;
    if (this.meta.filters.length > 0) {
      this.doc.fillColor(MUTED).font('Helvetica').fontSize(8)
        .text(`Applied filters: ${this.meta.filters.join(' | ')}`, MARGIN, this.doc.y, { width: CONTENT_WIDTH });
      this.doc.moveDown(0.8);
    }
  }

  private drawTableHeader(): void {
    const headers = ['Date', 'Slip', 'Contributor', 'Phone', 'Area', 'Collector', 'Mode', 'Status', 'Amount'];
    const widths = [70, 90, 140, 76, 86, 95, 65, 60, 75];
    const y = this.doc.y;
    this.doc.rect(MARGIN, y, CONTENT_WIDTH, 24).fill(INK);
    let x = MARGIN;
    headers.forEach((header, index) => {
      const align = index === headers.length - 1 ? 'right' : 'left';
      this.doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(7.4)
        .text(header.toUpperCase(), x + 6, y + 8, {
          align,
          ellipsis: true,
          height: 10,
          lineBreak: false,
          width: widths[index] - 12,
        });
      x += widths[index];
    });
    this.doc.y = y + 24;
  }

  private ensureRowSpace(): void {
    if (this.doc.y + 25 <= this.doc.page.height - 72) return;
    this.drawFooter();
    this.doc.addPage();
    this.pageNumber += 1;
    this.doc.x = MARGIN;
    this.doc.y = MARGIN;
    this.doc.rect(MARGIN, MARGIN, CONTENT_WIDTH, 36).fillAndStroke(PANEL, LINE);
    drawMultiscriptText(
      this.doc,
      `${this.meta.mandalName} - ${this.meta.festivalName}`,
      MARGIN + 12,
      MARGIN + 13,
      420,
      10,
      'left',
      INK,
      8,
      true,
    );
    this.doc.fillColor(MUTED).font('Helvetica').fontSize(8)
      .text('All generated slips continued', PAGE_WIDTH - MARGIN - 260, MARGIN + 13, {
        align: 'right',
        width: 248,
      });
    this.doc.y = MARGIN + 50;
    this.drawTableHeader();
  }

  private drawFooter(): void {
    const y = this.doc.page.height - 54;
    this.doc.moveTo(MARGIN, y - 8).lineTo(PAGE_WIDTH - MARGIN, y - 8).strokeColor(LINE).lineWidth(0.7).stroke();
    this.doc.fillColor(MUTED).font('Helvetica').fontSize(7)
      .text('Samavet ePawati - Generated Vargani slip register', MARGIN, y, { lineBreak: false, width: 360 });
    this.doc.text(`Page ${this.pageNumber}`, PAGE_WIDTH - MARGIN - 120, y, {
      align: 'right',
      lineBreak: false,
      width: 120,
    });
  }
}

function statusColor(status: string): string {
  if (status === 'Paid') return GREEN;
  if (status === 'Pending') return ORANGE;
  return RED;
}

function money(value: number): string {
  const sign = value < 0 ? '-' : '';
  return `${sign}INR ${Math.abs(value).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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
