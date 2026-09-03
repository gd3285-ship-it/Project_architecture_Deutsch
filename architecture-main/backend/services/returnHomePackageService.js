import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import PDFDocument from 'pdfkit';
import {
  canGenerateReturnHomePackage,
  getStatusLabel
} from './businessRules.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const GENERATED_DIR = path.join(__dirname, '../generated');
const FONT_PATH = path.join(__dirname, '../fonts/NotoSansHebrew-Regular.ttf');

function ensureGeneratedDir() {
  if (!fs.existsSync(GENERATED_DIR)) {
    fs.mkdirSync(GENERATED_DIR, { recursive: true });
  }
}

function getEligibilityStatusLabel(report) {
  return report.eligibilityCheckCompleted ? 'זכאי' : 'לא זכאי / טרם נבדק';
}

function getBudgetStatusLabel(report) {
  return report.hasBudgetRequest ? 'בקשת תקציב קיימת' : 'אין בקשת תקציב';
}

function getRestorationStatusLabel(report) {
  return getStatusLabel(report.status);
}

function drawRtlLine(doc, label, value, y) {
  const pageWidth = doc.page.width;
  const margin = 60;
  const line = `${label}: ${value}`;

  doc.fontSize(13)
    .text(line, margin, y, {
      width: pageWidth - margin * 2,
      align: 'right'
    });
}

async function createPdfFile(report, filePath) {
  await new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 60 });
    const stream = fs.createWriteStream(filePath);

    doc.pipe(stream);

    if (fs.existsSync(FONT_PATH)) {
      doc.registerFont('Hebrew', FONT_PATH);
      doc.font('Hebrew');
    }

    const pageWidth = doc.page.width;
    const margin = 60;

    doc.fontSize(22)
      .fillColor('#1A5276')
      .text('תיק אכלוס מחדש', margin, 70, {
        width: pageWidth - margin * 2,
        align: 'center'
      });

    doc.moveTo(margin, 110)
      .lineTo(pageWidth - margin, 110)
      .strokeColor('#1A5276')
      .lineWidth(2)
      .stroke();

    let y = 140;
    const fields = [
      ['מזהה מבנה', report.id],
      ['כתובת', report.address],
      ['מספר דירות', String(report.apartmentCount ?? 0)],
      ['סטטוס זכאות', getEligibilityStatusLabel(report)],
      ['סטטוס תקציב', getBudgetStatusLabel(report)],
      ['סטטוס שיקום', getRestorationStatusLabel(report)]
    ];

    fields.forEach(([label, value]) => {
      drawRtlLine(doc, label, value, y);
      y += 34;
    });

    y += 20;
    doc.rect(margin, y, pageWidth - margin * 2, 56)
      .fillColor('#E8F5E9')
      .fill();

    doc.fontSize(18)
      .fillColor('#2E7D32')
      .text('ניתן לאכלוס מחדש', margin, y + 16, {
        width: pageWidth - margin * 2,
        align: 'center'
      });

    doc.fontSize(10)
      .fillColor('#666666')
      .text(
        `הופק בתאריך: ${new Date().toLocaleString('he-IL')}`,
        margin,
        doc.page.height - 80,
        { width: pageWidth - margin * 2, align: 'center' }
      );

    doc.end();

    stream.on('finish', resolve);
    stream.on('error', reject);
  });
}

export async function generateReturnHomePackage(report) {
  const eligibility = canGenerateReturnHomePackage(report);

  if (!eligibility.eligible) {
    throw new Error(`לא ניתן להפיק תיק אכלוס: ${eligibility.missing.join(' · ')}`);
  }

  await new Promise(resolve => setTimeout(resolve, 1000));

  ensureGeneratedDir();

  const fileName = `return-home-${report.id}-${Date.now()}.pdf`;
  const filePath = path.join(GENERATED_DIR, fileName);

  await createPdfFile(report, filePath);

  return {
    fileName,
    filePath,
    url: `/generated/${fileName}`
  };
}
