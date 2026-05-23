const fs = require('fs');
const { jsPDF } = require('jspdf');

const doc = new jsPDF({ orientation: "p", unit: "pt", format: "a4" });
let fontPath = 'd:\\rentcar\\lib\\fonts\\Amiri-Regular.ttf';
let fontBase64 = fs.readFileSync(fontPath).toString('base64');
doc.addFileToVFS('Amiri.ttf', fontBase64);
doc.addFont('Amiri.ttf', 'Amiri', 'normal');
doc.setFont('Amiri', 'normal');

function fixArabic(text) {
  // First, shape the Arabic characters
  const shaped = doc.processArabic(text);

  // Split into LTR blocks (English letters, numbers, punctuation) and RTL blocks
  const ltrRegex = /([a-zA-Z0-9$#%()\-:.,]+(?:\s+[a-zA-Z0-9$#%()\-:.,]+)*)/g;
  const tokens = [];
  let lastIndex = 0;
  
  shaped.replace(ltrRegex, (match, p1, offset) => {
    if (offset > lastIndex) {
      const rtlPart = shaped.substring(lastIndex, offset);
      tokens.push(rtlPart.split('').reverse().join(''));
    }
    tokens.push(match);
    lastIndex = offset + match.length;
    return match;
  });
  
  if (lastIndex < shaped.length) {
    const rtlPart = shaped.substring(lastIndex);
    tokens.push(rtlPart.split('').reverse().join(''));
  }
  
  return tokens.reverse().join('');
}

doc.text(fixArabic("طلب حجز رقم #123"), 500, 100, { align: "right" });
doc.text(fixArabic("المركبة: Toyota Camry"), 500, 150, { align: "right" });
doc.text(fixArabic("ضريبة القيمة المضافة (15%)"), 500, 200, { align: "right" });
doc.text(fixArabic("الإيجار (3 أيام) — Toyota Camry"), 500, 250, { align: "right" });
doc.text(fixArabic("التوصيل: الرياض، شارع التحلية"), 500, 300, { align: "right" });

fs.writeFileSync('d:\\rentcar\\test_final.pdf', Buffer.from(doc.output('arraybuffer')));
console.log("Done test_final.pdf");
