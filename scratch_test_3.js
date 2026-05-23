const fs = require('fs');
const { jsPDF } = require('jspdf');

const doc = new jsPDF({ orientation: "p", unit: "pt", format: "a4" });
let fontPath = 'd:\\rentcar\\lib\\fonts\\Amiri-Regular.ttf';
let fontBase64 = fs.readFileSync(fontPath).toString('base64');
doc.addFileToVFS('Amiri.ttf', fontBase64);
doc.addFont('Amiri.ttf', 'Amiri', 'normal');
doc.setFont('Amiri', 'normal');

const text2 = "المركبة: Toyota Camry";

// Try different ways to render
doc.text(doc.processArabic(text2), 500, 100, { align: "right" });
try {
  doc.text(text2, 500, 150, { align: "right", isRTL: true });
} catch(e) { console.error(e) }

fs.writeFileSync('d:\\rentcar\\test_rtl.pdf', Buffer.from(doc.output('arraybuffer')));
console.log("Done");
