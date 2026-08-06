import PDFDocument from 'pdfkit';
import path from 'node:path';
import { PassThrough } from 'node:stream';

const DEVANAGARI_FONT = 'NotoSansDevanagari';
const DEVANAGARI_FONT_PATH = path.join(
  process.cwd(),
  'server/api/assets/noto-sans-devanagari-devanagari-400-normal.woff',
);
const DEVANAGARI_PATTERN = /[\u0900-\u097F]/u;

const PAGE_WIDTH = 841.89;
const PAGE_HEIGHT = 595.28;
const MARGIN = 28;
const INK = '#241914';
const MUTED = '#6B7280';
const GREEN = '#157347';
const GREEN_SOFT = '#EAF7EF';
const LINE = '#E5E7EB';
const PANEL = '#F8FAFC';

export interface VarganiSlipImagesPdfMeta {
  festivalName: string;
  generatedAt: Date;
  mandalName: string;
  reportPeriod: string;
  totalCount: number;
}

export interface VarganiSlipImagePage {
  contributor: string;
  image?: Buffer;
  note?: string;
  slipNumber: string;
}

export class VarganiSlipsPdfWriter {
  private readonly doc: PDFKit.PDFDocument;
  private pageNumber = 0;

  readonly stream = new PassThrough();

  constructor(private readonly meta: VarganiSlipImagesPdfMeta) {
    this.doc = new PDFDocument({
      autoFirstPage: false,
      info: {
        Author: 'Samavet ePawati',
        CreationDate: meta.generatedAt,
        Subject: 'Actual generated Vargani receipt slip images',
        Title: `${meta.mandalName} - ${meta.festivalName} Generated Receipt Slips`,
      },
      layout: 'landscape',
      margin: MARGIN,
      size: 'A4',
    });
    this.doc.registerFont(DEVANAGARI_FONT, DEVANAGARI_FONT_PATH);
    this.doc.pipe(this.stream);
  }

  addSlip(page: VarganiSlipImagePage): void {
    this.doc.addPage();
    this.pageNumber += 1;
    this.drawPageHeader(page);

    const imageX = MARGIN;
    const imageY = 94;
    const imageWidth = PAGE_WIDTH - MARGIN * 2;
    const imageHeight = PAGE_HEIGHT - imageY - 54;

    this.doc.roundedRect(imageX, imageY, imageWidth, imageHeight, 10).fillAndStroke('#FFFFFF', LINE);
    if (page.image) {
      try {
        this.doc.image(page.image, imageX + 10, imageY + 10, {
          align: 'center',
          fit: [imageWidth - 20, imageHeight - 20],
          valign: 'center',
        });
      } catch {
        this.drawMissingImage(imageX, imageY, imageWidth, imageHeight, 'Stored receipt image could not be embedded in PDF.');
      }
    } else {
      this.drawMissingImage(imageX, imageY, imageWidth, imageHeight, page.note ?? 'Receipt image has not been generated yet.');
    }

    this.drawFooter();
  }

  finalize(): void {
    if (this.pageNumber === 0) {
      this.addSlip({
        contributor: 'No slips found',
        note: 'No generated Vargani slip records were found for this report.',
        slipNumber: '-',
      });
    }
    this.doc.end();
  }

  private drawPageHeader(page: VarganiSlipImagePage): void {
    this.doc.roundedRect(MARGIN, MARGIN, PAGE_WIDTH - MARGIN * 2, 50, 10).fill(INK);
    this.doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(16)
      .text('Generated Vargani Slip', MARGIN + 16, MARGIN + 10, { width: 260 });
    drawMultiscriptText(
      this.doc,
      `${this.meta.mandalName} | ${this.meta.festivalName}`,
      MARGIN + 16,
      MARGIN + 32,
      360,
      10,
      '#BBF7D0',
      8,
    );

    this.doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(9)
      .text(page.slipNumber, PAGE_WIDTH - MARGIN - 260, MARGIN + 10, {
        align: 'right',
        width: 244,
      });
    drawMultiscriptText(
      this.doc,
      page.contributor,
      PAGE_WIDTH - MARGIN - 260,
      MARGIN + 29,
      244,
      10,
      '#D1D5DB',
      8,
      'right',
    );

    this.doc.roundedRect(MARGIN, MARGIN + 58, PAGE_WIDTH - MARGIN * 2, 24, 7).fillAndStroke(GREEN_SOFT, GREEN_SOFT);
    this.doc.fillColor(GREEN).font('Helvetica-Bold').fontSize(8)
      .text(`${this.meta.reportPeriod} | ${this.pageNumber} of ${this.meta.totalCount} slips`, MARGIN + 12, MARGIN + 66, {
        width: PAGE_WIDTH - MARGIN * 2 - 24,
      });
  }

  private drawMissingImage(x: number, y: number, width: number, height: number, message: string): void {
    this.doc.roundedRect(x + 22, y + 22, width - 44, height - 44, 12).fillAndStroke(PANEL, LINE);
    this.doc.fillColor(INK).font('Helvetica-Bold').fontSize(16)
      .text('Receipt image not available', x + 42, y + height / 2 - 22, {
        align: 'center',
        width: width - 84,
      });
    this.doc.fillColor(MUTED).font('Helvetica').fontSize(10)
      .text(message, x + 42, y + height / 2 + 4, {
        align: 'center',
        width: width - 84,
      });
  }

  private drawFooter(): void {
    const y = PAGE_HEIGHT - 38;
    this.doc.moveTo(MARGIN, y - 8).lineTo(PAGE_WIDTH - MARGIN, y - 8).strokeColor(LINE).lineWidth(0.7).stroke();
    this.doc.fillColor(MUTED).font('Helvetica').fontSize(7)
      .text(`Generated ${formatDateTime(this.meta.generatedAt)} by Samavet ePawati`, MARGIN, y, {
        lineBreak: false,
        width: 360,
      });
    this.doc.text(`Page ${this.pageNumber}`, PAGE_WIDTH - MARGIN - 120, y, {
      align: 'right',
      lineBreak: false,
      width: 120,
    });
  }
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

function drawMultiscriptText(
  doc: PDFKit.PDFDocument,
  value: string,
  x: number,
  y: number,
  width: number,
  height: number,
  color: string,
  fontSize: number,
  align: 'left' | 'right' = 'left',
): void {
  const normalized = value.normalize('NFC');
  const runs = splitFontRuns(normalized);
  const measuredRuns = runs.map((run) => {
    const font = run.devanagari ? DEVANAGARI_FONT : 'Helvetica';
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
