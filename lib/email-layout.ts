/**
 * ستايل مشترك لقوالب البريد — يكدّس أعمدة الجداول فوق بعضها على شاشات الموبايل
 * ويصغّر الحشو والخطوط. يُحقن جوّه وسم <style> في <head> بجانب استيراد الخطوط.
 *
 * الكلاسات تُوضع على العناصر جنب الـ inline styles (اللي تفضل هي الأساس):
 * - `em-outer`  على <body>
 * - `em-card`   على جدول البطاقة الرئيسي
 * - `em-head`   / `em-body` على خلايا الهيدر والمحتوى
 * - `em-brand`  / `em-title` على اسم الشركة والعنوان الكبير
 * - `em-col`    على كل <td width="50%"> عشان تبقى صف كامل على الموبايل
 * - `em-cell`   / `em-val` على خلايا جدول المبالغ، و`em-total` / `em-total-val` على صف الإجمالي
 *
 * عملاء البريد اللي ما بتدعمش media queries (أوتلوك ديسكتوب) هتتجاهل الكتلة دي
 * وتفضل على تخطيط العمودين الأصلي — وده المطلوب على الشاشات الكبيرة أصلاً.
 */
export const EMAIL_RESPONSIVE_CSS = `
    body { -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%; }
    table { border-collapse:collapse; }
    img { max-width:100%; height:auto; }
    @media only screen and (max-width:620px) {
      .em-outer { padding:16px 10px !important; }
      .em-card { border-radius:16px !important; }
      .em-head { padding:32px 20px !important; }
      .em-body { padding:28px 20px !important; }
      .em-foot { padding:20px 16px !important; }
      .em-brand { font-size:22px !important; }
      .em-title { font-size:24px !important; line-height:1.3 !important; }
      .em-col {
        display:block !important;
        width:100% !important;
        max-width:100% !important;
        box-sizing:border-box !important;
        padding-left:0 !important;
        padding-right:0 !important;
        padding-bottom:18px !important;
      }
      .em-cell { padding:12px 14px !important; font-size:13px !important; }
      .em-val { padding:12px 14px !important; font-size:14px !important; white-space:nowrap !important; }
      .em-total { padding:16px 14px !important; font-size:15px !important; }
      .em-total-val { padding:16px 14px !important; font-size:18px !important; white-space:nowrap !important; }
    }
`;
