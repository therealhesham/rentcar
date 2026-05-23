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
const text3 = "الإيجار (3 أيام) — Toyota Camry";

function fixMixed(str) {
  // Split by Arabic and non-Arabic chunks
  // We want to keep the LTR parts LTR, and RTL parts RTL.
  // Since jsPDF processArabic returns shaped Arabic but left-to-right visual order...
  return doc.processArabic(str);
}

console.log("text1", fixMixed(text1));
console.log("text2", fixMixed(text2));
console.log("text3", fixMixed(text3));
