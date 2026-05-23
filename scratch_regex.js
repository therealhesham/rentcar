const text1 = "طلب حجز رقم #123";
const text2 = "المركبة: Toyota Camry";
const text3 = "ضريبة القيمة المضافة (15%)";
const text4 = "2024-05-23 10:30";
const text5 = "المجموع غير شامل الضريبة";
const text6 = "التوصيل: الرياض، شارع التحلية";

function shape(shaped) {
  const ltrRegex = /([a-zA-Z0-9$#%()\-:]+(?:\s+[a-zA-Z0-9$#%()\-:]+)*)/g;
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

console.log("text1:", shape(text1));
console.log("text2:", shape(text2));
console.log("text3:", shape(text3));
console.log("text4:", shape(text4));
console.log("text5:", shape(text5));
console.log("text6:", shape(text6));
