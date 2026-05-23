const fs = require('fs');
const { jsPDF } = require('jspdf');

const doc = new jsPDF({ orientation: "p", unit: "pt", format: "a4" });
let fontPath = 'd:\\rentcar\\lib\\fonts\\Amiri-Regular.ttf';
let fontBase64 = fs.readFileSync(fontPath).toString('base64');
doc.addFileToVFS('Amiri.ttf', fontBase64);
doc.addFont('Amiri.ttf', 'Amiri', 'normal');
doc.setFont('Amiri', 'normal');

const text1 = "طلب حجز رقم #123";
const text2 = "المركبة: Toyota Camry";
const text3 = "طريقة الدفع: Apple Pay";

const shaped1 = doc.processArabic(text1);
const shaped2 = doc.processArabic(text2);
const shaped3 = doc.processArabic(text3);

// Try drawing with and without isRTL or right align
doc.text(shaped1, 500, 50, { align: "right" });
doc.text(shaped2, 500, 100, { align: "right" });
doc.text(shaped3, 500, 150, { align: "right" });

// Try with native jsPDF RTL (isRTL parameter if supported)
try {
  doc.text(text1, 500, 200, { align: "right", isRTL: true });
} catch(e) {}

fs.writeFileSync('test_invoice.pdf', Buffer.from(doc.output('arraybuffer')));
console.log("Generated test_invoice.pdf");
