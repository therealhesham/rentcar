const fs = require('fs');
const { jsPDF } = require('jspdf');

const doc = new jsPDF();
let fontPath = 'd:\\rentcar\\lib\\fonts\\Amiri-Regular.ttf';
let fontBase64 = fs.readFileSync(fontPath).toString('base64');
doc.addFileToVFS('Amiri.ttf', fontBase64);
doc.addFont('Amiri.ttf', 'Amiri', 'normal');
doc.setFont('Amiri', 'normal');

const text1 = "طلب حجز رقم #123";
const text2 = "المركبة: Toyota Camry";
const text3 = "طريقة الدفع: Apple Pay";

console.log("Original 1:", text1);
console.log("Processed 1:", doc.processArabic(text1));

console.log("Original 2:", text2);
console.log("Processed 2:", doc.processArabic(text2));

console.log("Original 3:", text3);
console.log("Processed 3:", doc.processArabic(text3));
