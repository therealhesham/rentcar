const fs = require('fs');
const { jsPDF } = require('jspdf');

const doc = new jsPDF({ orientation: "p", unit: "pt", format: "a4" });
const fontPath = 'd:\\rentcar\\lib\\fonts\\Amiri-Regular.ttf';
const fontBase64 = fs.readFileSync(fontPath).toString('base64');
doc.addFileToVFS('Amiri.ttf', fontBase64);
doc.addFont('Amiri.ttf', 'Amiri', 'normal');
doc.setFont('Amiri', 'normal');
doc.setLanguage('ar');

const pageW = doc.internal.pageSize.getWidth();
const margin = 48;
const rightX = pageW - margin;

let y = 60;
const step = 28;

function label(text) {
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(150, 150, 150);
  doc.text(text, margin, y);
  y += 16;
  doc.setFont('Amiri', 'normal');
  doc.setFontSize(14);
  doc.setTextColor(0, 0, 0);
}

// ---- TEST 1: processArabic + align right (original approach) ----
label('TEST 1: processArabic() + align right');
doc.text(doc.processArabic('فاتورة — تم الدفع'), rightX, y, { align: 'right' }); y += step;
doc.text(doc.processArabic('طلب حجز رقم #123'), rightX, y, { align: 'right' }); y += step;
doc.text(doc.processArabic('المركبة: Toyota Camry'), rightX, y, { align: 'right' }); y += step;
doc.text(doc.processArabic('الإيجار (3 أيام) — Toyota Camry'), rightX, y, { align: 'right' }); y += step;
doc.text(doc.processArabic('ضريبة القيمة المضافة (15%)'), rightX, y, { align: 'right' }); y += step;

y += 10;

// ---- TEST 2: processArabic + align left ----
label('TEST 2: processArabic() + align left');
doc.text(doc.processArabic('فاتورة — تم الدفع'), margin, y, { align: 'left' }); y += step;
doc.text(doc.processArabic('طلب حجز رقم #123'), margin, y, { align: 'left' }); y += step;
doc.text(doc.processArabic('المركبة: Toyota Camry'), margin, y, { align: 'left' }); y += step;

y += 10;

// ---- TEST 3: setR2L(true) + processArabic + align right ----
label('TEST 3: setR2L(true) + processArabic() + align right');
doc.setR2L(true);
doc.text(doc.processArabic('فاتورة — تم الدفع'), rightX, y, { align: 'right' }); y += step;
doc.text(doc.processArabic('طلب حجز رقم #123'), rightX, y, { align: 'right' }); y += step;
doc.text(doc.processArabic('المركبة: Toyota Camry'), rightX, y, { align: 'right' }); y += step;
doc.text(doc.processArabic('الإيجار (3 أيام) — Toyota Camry'), rightX, y, { align: 'right' }); y += step;
doc.setR2L(false);

y += 10;

// ---- TEST 4: Raw Arabic (no processArabic) + align right ----
label('TEST 4: Raw Arabic (no processArabic) + align right');
doc.text('فاتورة — تم الدفع', rightX, y, { align: 'right' }); y += step;
doc.text('طلب حجز رقم #123', rightX, y, { align: 'right' }); y += step;
doc.text('المركبة: Toyota Camry', rightX, y, { align: 'right' }); y += step;

y += 10;

// ---- TEST 5: setR2L(true) + raw Arabic ----
label('TEST 5: setR2L(true) + raw Arabic (no processArabic)');
doc.setR2L(true);
doc.text('فاتورة — تم الدفع', rightX, y, { align: 'right' }); y += step;
doc.text('طلب حجز رقم #123', rightX, y, { align: 'right' }); y += step;
doc.text('المركبة: Toyota Camry', rightX, y, { align: 'right' }); y += step;
doc.setR2L(false);

// ---- Page 2: NotoSansArabic ----
doc.addPage();
const fontPath2 = 'd:\\rentcar\\lib\\fonts\\NotoSansArabic-Regular.ttf';
const fontBase64_2 = fs.readFileSync(fontPath2).toString('base64');
doc.addFileToVFS('NotoSansArabic.ttf', fontBase64_2);
doc.addFont('NotoSansArabic.ttf', 'NotoSansArabic', 'normal');
doc.setFont('NotoSansArabic', 'normal');
doc.setLanguage('ar');

y = 60;

label('TEST 6 (NotoSansArabic): processArabic() + align right');
doc.setFont('NotoSansArabic', 'normal');
doc.setFontSize(14);
doc.setTextColor(0, 0, 0);
doc.text(doc.processArabic('فاتورة — تم الدفع'), rightX, y, { align: 'right' }); y += step;
doc.text(doc.processArabic('طلب حجز رقم #123'), rightX, y, { align: 'right' }); y += step;
doc.text(doc.processArabic('المركبة: Toyota Camry'), rightX, y, { align: 'right' }); y += step;
doc.text(doc.processArabic('الإيجار (3 أيام) — Toyota Camry'), rightX, y, { align: 'right' }); y += step;
doc.text(doc.processArabic('ضريبة القيمة المضافة (15%)'), rightX, y, { align: 'right' }); y += step;

y += 10;

label('TEST 7 (NotoSansArabic): setR2L(true) + processArabic() + align right');
doc.setFont('NotoSansArabic', 'normal');
doc.setFontSize(14);
doc.setTextColor(0, 0, 0);
doc.setR2L(true);
doc.text(doc.processArabic('فاتورة — تم الدفع'), rightX, y, { align: 'right' }); y += step;
doc.text(doc.processArabic('طلب حجز رقم #123'), rightX, y, { align: 'right' }); y += step;
doc.text(doc.processArabic('المركبة: Toyota Camry'), rightX, y, { align: 'right' }); y += step;
doc.text(doc.processArabic('الإيجار (3 أيام) — Toyota Camry'), rightX, y, { align: 'right' }); y += step;
doc.setR2L(false);

y += 10;

label('TEST 8 (NotoSansArabic): setR2L(true) + raw Arabic');
doc.setFont('NotoSansArabic', 'normal');
doc.setFontSize(14);
doc.setTextColor(0, 0, 0);
doc.setR2L(true);
doc.text('فاتورة — تم الدفع', rightX, y, { align: 'right' }); y += step;
doc.text('طلب حجز رقم #123', rightX, y, { align: 'right' }); y += step;
doc.text('المركبة: Toyota Camry', rightX, y, { align: 'right' }); y += step;
doc.setR2L(false);

fs.writeFileSync('d:\\rentcar\\test_arabic_all.pdf', Buffer.from(doc.output('arraybuffer')));
console.log('Generated test_arabic_all.pdf');
