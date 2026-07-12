/**
 * زرع الشروط والأحكام (عربي/إنجليزي) في جدول RentalTerm من مستندي الشروط المعتمدين.
 * تشغيل: npx tsx prisma/scripts/seed-rental-terms.ts
 * لإعادة الزرع فوق بيانات موجودة: npx tsx prisma/scripts/seed-rental-terms.ts --force
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const terms: {
  titleAr: string;
  titleEn: string;
  bodyAr: string;
  bodyEn: string;
}[] = [
  {
    titleAr: "مقدمة",
    titleEn: "Introduction",
    bodyAr:
      "عزيزي الزائر، إن استخدامك لهذا التطبيق أو الموقع، أو قيامك بإجراء أي حجز من خلاله، يعني موافقتك التامة والمطلقة على جميع الشروط والأحكام المذكورة أدناه. يُرجى قراءتها بعناية قبل إتمام أي عملية حجز.",
    bodyEn:
      "Dear visitor, your use of this application or website, or your completion of any booking through it, constitutes your full and unconditional acceptance of all the terms and conditions set out below. Please read them carefully before completing any booking.",
  },
  {
    titleAr: "التعريفات",
    titleEn: "Definitions",
    bodyAr:
      "• الشركة: شركة روائس لتأجير السيارات.\n" +
      "• المستأجر / العميل: الشخص الطبيعي أو الاعتباري الذي يقوم بحجز واستئجار المركبة عبر التطبيق أو الموقع.\n" +
      "• المركبة: السيارة المؤجرة ومشتملاتها من مفاتيح، إطارات احتياطية، وثائق، وأي ملحقات أخرى.\n" +
      "• التطبيق / الموقع: المنصة الإلكترونية التابعة لشركة روائس لتأجير السيارات.\n" +
      "• نظام «تم»: النظام المروري الإلكتروني المعتمد في المملكة العربية السعودية لإدارة أساطيل المركبات والتفويض.",
    bodyEn:
      "• The Company: Rawaes Car Rental Company.\n" +
      "• The Renter / Customer: the natural or legal person who books and rents a vehicle through the application or website.\n" +
      "• The Vehicle: the rented car and its contents, including keys, spare tires, documents, and any other accessories.\n" +
      "• The Application / Website: the electronic platform belonging to Rawaes Car Rental Company.\n" +
      "• \"Tamm\" System: the accredited electronic traffic system in the Kingdom of Saudi Arabia for managing vehicle fleets and driving authorizations.",
  },
  {
    titleAr: "شروط الاستئجار والوثائق المطلوبة",
    titleEn: "Rental Requirements and Required Documents",
    bodyAr:
      "يحق للشركة رفض تأجير أي مركبة في حال عدم استيفاء العميل للشروط التالية:\n" +
      "• العمر: يجب ألا يقل عمر المستأجر عن 21 عاماً للسيارات الصغيرة والمتوسطة والفارهة.\n" +
      "• الرخصة: وجود رخصة قيادة سارية المفعول محلية أو دولية معترف بها في المملكة.\n" +
      "• الهوية: هوية وطنية أو إقامة سارية المفعول، ويجب أن تكون مسجلة في نظام «أبشر».\n" +
      "• الحالة الأمنية: عدم وجود قيود أمنية أو مرورية تمنع من إصدار تفويض القيادة عبر نظام «تم» أو فتح العقد على منصة تأجير (نقل).",
    bodyEn:
      "The Company has the right to refuse to rent any vehicle if the customer does not meet the following conditions:\n" +
      "• Age: the renter must be at least 21 years old for small, mid-size, and luxury cars.\n" +
      "• Driving License: a valid local driving license, or an international license recognized in the Kingdom.\n" +
      "• Identification: a valid national ID or residence permit (Iqama), which must be registered in the \"Absher\" system.\n" +
      "• Security Status: no security or traffic restrictions preventing the issuance of a driving authorization through the \"Tamm\" system, or the opening of the contract on the \"Tajeer\" (Naql) platform.",
  },
  {
    titleAr: "الحجز والتعديل والإلغاء",
    titleEn: "Booking, Modification, and Cancellation",
    bodyAr:
      "• تأكيد الحجز: يُعتبر الحجز مؤكداً فقط بعد استلام العميل لرسالة التأكيد الإلكترونية ودفع المبلغ المطلوب أو العربون حسب سياسة الحجز.\n" +
      "• تعديل الحجز: يخضع أي تعديل على الحجز مثل تغيير نوع السيارة أو مدة الإيجار لتوفر المركبات، وقد يترتب عليه تغيير في السعر.\n" +
      "• الإلغاء (مدة الإلغاء والرسوم المترتبة):\n" +
      "– قبل أكثر من 48 ساعة من موعد الاستلام المحدد: إلغاء مجاني بالكامل دون تطبيق أي رسوم أو اقتطاعات مالية.\n" +
      "– خلال 24 إلى 48 ساعة قبل موعد الاستلام المحدد: خصم رسوم إدارية تعادل 25% من قيمة الحجز الإجمالية أو أجرة يوم واحد كحد أقصى.\n" +
      "– أقل من 24 ساعة من موعد الاستلام المحدد: خصم رسوم إدارية تعادل 50% من قيمة الحجز الإجمالية أو أجرة يوم واحد كحد أقصى.\n" +
      "– أقل من 6 ساعات من موعد الاستلام: خصم 100% من قيمة الحجز الإجمالية أو أجرة يومين كحد أقصى.\n" +
      "– عدم الحضور لاستلام السيارة في الموعد: يتم الاحتفاظ بالسيارة المحجوزة لمدة ساعتين من الموعد، وفي حال عدم الحضور يتم إلغاء الحجز وخصم قيمة الحجز بالكامل.\n" +
      "• حالة المركبة: يتم تسليم المركبة للعميل بحالة فنية وميكانيكية سليمة ونظيفة، ويجب على العميل فحص المركبة قبل الاستلام والتوقيع على نموذج الفحص.\n" +
      "• إعادة المركبة: يجب إعادة المركبة في التاريخ والوقت المحددين، وبنفس الحالة التي استُلمت بها.\n" +
      "• الوقود: يجب إعادة المركبة بنفس مستوى الوقود الذي كانت عليه عند الاستلام، وفي حال النقص يحق للشركة تحصيل تكلفة الوقود الناقص بالإضافة إلى رسوم غرامة إرجاع الوقود وتقدر بمبلغ 50 ريال فقط لا غير.\n" +
      "• التأخير في التسليم: يُسمح بفترة سماح لا تتجاوز ساعتين، وفي حال تجاوز فترة السماح سيتم احتساب يوم إيجار إضافي كامل بالأسعار اليومية المعتادة.",
    bodyEn:
      "• Booking Confirmation: a booking is considered confirmed only after the customer receives the electronic confirmation message and pays the required amount or deposit, in accordance with the booking policy.\n" +
      "• Booking Modification: any modification to a booking, such as changing the car type or the rental period, is subject to vehicle availability and may result in a change in price.\n" +
      "• Cancellation (periods and applicable fees):\n" +
      "– More than 48 hours before the scheduled pick-up time: fully free cancellation with no fees or financial deductions of any kind.\n" +
      "– Between 24 and 48 hours before the scheduled pick-up time: deduction of an administrative fee equal to 25% of the total booking value, or one day's rental charge, whichever is lower (as a maximum).\n" +
      "– Less than 24 hours before the scheduled pick-up time: deduction of an administrative fee equal to 50% of the total booking value, or one day's rental charge, whichever is lower (as a maximum).\n" +
      "– Less than 6 hours before the scheduled pick-up time: deduction of 100% of the total booking value, or two days' rental charge as a maximum.\n" +
      "– Failure to show up to collect the vehicle at the scheduled time: the reserved vehicle is held for two hours past the scheduled time; if the customer does not show up, the booking is cancelled and the full booking value is deducted.\n" +
      "• Vehicle Condition: the vehicle is delivered to the customer in sound technical and mechanical condition and clean. The customer must inspect the vehicle before taking delivery and sign the inspection form.\n" +
      "• Vehicle Return: the vehicle must be returned on the specified date and time, and in the same condition in which it was received.\n" +
      "• Fuel: the vehicle must be returned with the same fuel level as at the time of delivery. In the event of a shortage, the Company has the right to charge the cost of the missing fuel in addition to a fuel-return penalty fee of SAR 50 only.\n" +
      "• Late Return: a grace period not exceeding two hours is allowed. If the grace period is exceeded, one full additional rental day will be charged at the standard daily rates.",
  },
  {
    titleAr: "الأسعار والدفع والتفويض المالي",
    titleEn: "Prices, Payment, and Financial Authorization",
    bodyAr:
      "• طرق الدفع: تقبل الشركة الدفع عبر البطاقات الائتمانية، بطاقات مدى، أو التحويل البنكي عبر التطبيق. الدفع النقدي يخضع لسياسة الفروع.\n" +
      "• الضرائب: جميع الأسعار المعروضة تخضع لضريبة القيمة المضافة (VAT) بنسبة 15% المعمول بها في المملكة العربية السعودية.\n" +
      "• التفويض البنكي (المبلغ المحتجز): يحق للشركة حجز مبلغ مالي من بطاقة العميل الائتمانية كـ«تأمين مسترد» لتغطية أي مخالفات مرورية أو أضرار غير مشمولة بالتأمين، ويتم رد المبلغ بعد إرجاع السيارة بمدة تتراوح بين 14 إلى 21 يوم عمل.",
    bodyEn:
      "• Payment Methods: the Company accepts payment by credit card, mada cards, or bank transfer through the application. Cash payment is subject to branch policy.\n" +
      "• Taxes: all displayed prices are subject to Value Added Tax (VAT) at the rate of 15% applicable in the Kingdom of Saudi Arabia.\n" +
      "• Bank Authorization (Held Amount): the Company has the right to hold an amount on the customer's credit card as a \"refundable security deposit\" to cover any traffic violations or damages not covered by insurance. The amount is refunded within 14 to 21 business days after the vehicle is returned.",
  },
  {
    titleAr: "التأمين والحوادث",
    titleEn: "Insurance and Accidents",
    bodyAr:
      "• التأمين الشامل: جميع سيارات الشركة مغطاة بتأمين شامل مع نسبة تحمل يتحملها المستأجر في حال كان الحادث ضد مجهول أو كان المستأجر هو المخطئ في الحادث. وتختلف نسبة التحمل حسب فئة السيارة وموضحة في العقد.\n" +
      "• الإجراءات عند الحوادث: في حال وقوع حادث لا سمح الله، يجب على المستأجر:\n" +
      "1- عدم تحريك السيارة من موقع الحادث.\n" +
      "2- الاتصال فوراً بالمرور 993 أو شركة نجم 920000560 للحصول على تقرير الحادث.\n" +
      "3- إبلاغ خدمة العملاء – روائس لتأجير السيارات – فوراً.\n" +
      "• استثناءات التأمين: يسقط حق المستأجر في التغطية التأمينية ويتحمل التكاليف كاملة في الحالات التالية:\n" +
      "– القيادة تحت تأثير المسكرات أو المخدرات.\n" +
      "– قطع الإشارة الحمراء أو القيادة بعكس السير.\n" +
      "– السماح لشخص غير مفوض وغير مسجل في العقد بقيادة المركبة.\n" +
      "– استخدام المركبة في سباقات أو خارج الطرق المجهزة للقيادة.",
    bodyEn:
      "• Comprehensive Insurance: all of the Company's vehicles are covered by comprehensive insurance with a deductible (excess) borne by the renter in cases where the accident is against an unknown party or where the renter is at fault in the accident. The deductible varies according to the vehicle category and is specified in the contract.\n" +
      "• Procedures in the Event of an Accident: in the event of an accident (God forbid), the renter must:\n" +
      "1. Not move the vehicle from the accident site.\n" +
      "2. Immediately call Traffic Police at 993 or Najm at 920000560 to obtain the accident report.\n" +
      "3. Immediately notify Customer Service — Rawaes Car Rental.\n" +
      "• Insurance Exclusions: the renter forfeits the right to insurance coverage and bears the full costs in the following cases:\n" +
      "– Driving under the influence of alcohol or drugs.\n" +
      "– Running a red light or driving against the direction of traffic.\n" +
      "– Allowing an unauthorized person not registered in the contract to drive the vehicle.\n" +
      "– Using the vehicle in races or off roads not designed for driving.",
  },
  {
    titleAr: "المحظورات والقيود على الاستخدام",
    titleEn: "Prohibitions and Restrictions on Use",
    bodyAr:
      "يمنع منعاً باتاً استخدام المركبات في الأغراض الآتية:\n" +
      "• تأجير المركبة من الباطن لطرف ثالث.\n" +
      "• استخدام المركبة لأغراض تجارية غير مرخصة مثل نقل الركاب أو النقل العام أو تحميل بضائع ثقيلة.\n" +
      "• الخروج بالمركبة خارج الحدود الإقليمية للمملكة العربية السعودية دون الحصول على تفويض دولي مكتوب من الشركة ودفع الرسوم المقررة.\n" +
      "• نقل مواد قابلة للاشتعال، أو متفجرات، أو أي مواد يمنعها القانون السعودي.",
    bodyEn:
      "It is strictly prohibited to use the vehicles for the following purposes:\n" +
      "• Sub-renting the vehicle to a third party.\n" +
      "• Using the vehicle for unlicensed commercial purposes, such as passenger or public transport, or carrying heavy goods.\n" +
      "• Taking the vehicle outside the territorial borders of the Kingdom of Saudi Arabia without obtaining written international authorization from the Company and paying the prescribed fees.\n" +
      "• Transporting flammable materials, explosives, or any materials prohibited by Saudi law.",
  },
  {
    titleAr: "المخالفات المرورية",
    titleEn: "Traffic Violations",
    bodyAr:
      "بموجب التفويض الصادر عبر نظام «تم»، يتحمل المستأجر المسؤولية القانونية والمادية الكاملة عن كافة المخالفات المرورية التي سُجلت على المركبة خلال فترة العقد الفعلي وحتى استلام الشركة للمركبة.",
    bodyEn:
      "Under the authorization issued through the \"Tamm\" system, the renter bears full legal and financial responsibility for all traffic violations recorded against the vehicle during the actual contract period and until the Company takes back the vehicle.",
  },
  {
    titleAr: "الخصوصية وحماية البيانات",
    titleEn: "Privacy and Data Protection",
    bodyAr:
      "• تلتزم شركة روائس بحماية بياناتك الشخصية وفقاً لنظام حماية البيانات الشخصية في المملكة العربية السعودية.\n" +
      "• يتم استخدام بياناتك لأغراض إتمام الحجز، والتفويض المروري، وتحسين مستوى الخدمة فقط.",
    bodyEn:
      "• Rawaes Company is committed to protecting your personal data in accordance with the Personal Data Protection Law of the Kingdom of Saudi Arabia.\n" +
      "• Your data is used solely for the purposes of completing the booking, issuing the traffic authorization, and improving the level of service.",
  },
  {
    titleAr: "القانون المطبق وحل النزاعات",
    titleEn: "Governing Law and Dispute Resolution",
    bodyAr:
      "• تخضع هذه الشروط والأحكام للأنظمة والقوانين المعمول بها في المملكة العربية السعودية.\n" +
      "• في حال نشوء أي نزاع لا سمح الله حول تفسير أو تنفيذ هذه الشروط، يتم حله ودياً، وفي حال تعذر ذلك تختص المحاكم السعودية بمدينة المدينة المنورة بالنظر في هذا النزاع.",
    bodyEn:
      "• These terms and conditions are governed by the laws and regulations in force in the Kingdom of Saudi Arabia.\n" +
      "• In the event of any dispute (God forbid) concerning the interpretation or implementation of these terms, it shall be resolved amicably. If that is not possible, the Saudi courts in the city of Madinah (Al-Madinah Al-Munawwarah) shall have jurisdiction over the dispute.",
  },
  {
    titleAr: "إقرار العميل",
    titleEn: "Customer Acknowledgment",
    bodyAr:
      "باستخدامك للتطبيق والموافقة الإلكترونية عند إتمام الحجز، فإنك تقر بأنك قد قرأت هذه الشروط والأحكام وفهمتها، وتوافق على الالتزام التام بجميع بنودها.",
    bodyEn:
      "By using the application and giving your electronic consent when completing the booking, you acknowledge that you have read and understood these terms and conditions, and you agree to fully comply with all of their provisions.",
  },
];

async function main() {
  const force = process.argv.includes("--force");
  const existing = await prisma.rentalTerm.count();

  if (existing > 0 && !force) {
    console.log(
      `يوجد ${existing} بند مسجل بالفعل في جدول RentalTerm. أعد التشغيل مع --force لحذفها وإعادة الزرع.`,
    );
    return;
  }

  if (existing > 0) {
    await prisma.rentalTerm.deleteMany();
    console.log(`تم حذف ${existing} بند قديم.`);
  }

  await prisma.rentalTerm.createMany({
    data: terms.map((t, i) => ({ ...t, sortOrder: i, isActive: true })),
  });

  console.log(`تم زرع ${terms.length} بنداً من الشروط والأحكام (عربي/إنجليزي).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
