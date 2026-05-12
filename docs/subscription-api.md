### Subscription REST & automation — Rawaes

Base URL النسبي هو نفس المنشور (site origin). المصادقة:

- عميل مسجَّل عبر Cookie `customer_session` (مسارات اشتراكي).
- إداري عبر لوحة تحكم؛ إجراءات الحالة الثقيلة تكون Server Actions أساسًا.

### جداول Prisma الأساسية

- `SubscriptionPlan` — مخطط أسعار ومزايا.
- `UserSubscription` — نسخة محددة لكل عميل.
- `SubscriptionPayment` — دفع أولى / تجديد / زيادة مسافة.
- `SubscriptionDocument` — رخصة / هوية.

### GET `/api/subscriptions/plans`

- قوائم عامة (صفحة `page`, `limit`).

### GET `/api/subscriptions/plans/[slug]`

- تفاصيل خطة لصفحة المنتج.

### POST `/api/subscriptions`

- جسم JSON: `{ planSlug, durationMonths (1 | 3 | 6), autoRenew?, startDate }` حيث `startDate` بصيغة `YYYY-MM-DD` (يوم بدء الباقة؛ تُشتق `endAt` تلقائياً عند التفعيل وتطابق الطول التقويمي بعد عدد الأشهر).
- يتطلّب جلسة عميل.
- يخزّن `plannedStartDate` وينشئ اشتراك `PENDING` + دفعة `INITIAL` بحالة `PENDING`.

### GET `/api/subscriptions`

- قائمة اشتراكات المستخدم الحالي.

### GET `/api/subscriptions/[id]`

- اشتراك واحد مملوك للمستخدم الحالي (يشمل الدفعات والمستندات والخطة)، مناسب للتطبيقات الخارجية أو التكامل.

### POST `/api/subscriptions/[id]/mileage`

- جسم JSON: `{ mileageUsedKm: number }`.
- مسموح للحالات `ACTIVE` أو `SUSPENDED`؛ تُقيَّد القيمة بما لا يتجاوز `mileageAllowanceKm` لتفادي الزيادة الظرفية قبل الفوترة.

### POST `/api/subscriptions/[id]/pay`

- يحوّل أحدث دفعة `PENDING` إلى `PAID` (تجريبي).
- إذا كانت حزمة `RENEWAL:*` يمدّد الاشتراك منطقياً من `endAt`.

### POST `/api/subscriptions/[id]/documents`

- `multipart/form-data` يحتوي `kind` (`DRIVERS_LICENSE` | `NATIONAL_ID` | `OTHER`) + `file`.
- حد أقصى 5MB، أنواع: JPEG/PNG/WebP/PDF.

### GET `/api/subscriptions/[id]/documents/[docId]`

- تنزيل آمن للمالك.

### POST `/api/subscriptions/[id]/cancel`

- JSON `{ reason? }` — ممنوح للحالات `PENDING` أو `ACTIVE` فقط وفق المنطق الحالي.

### POST `/api/subscriptions/[id]/renew`

- `{ durationMonths }` تولّد معاملة `RENEWAL:<n>`.

### POST `/api/webhooks/subscription-payment`

- ترويسة `X-Signature`: `hex(HMAC_SHA256(secret, rawBody))`.
- جسم `{ subscriptionId, paymentId, externalRef? }`.

### POST `/api/cron/subscriptions`

- `Authorization: Bearer <CRON_SECRET>`.
- ينادي `runSubscriptionCronJobs()` لتواريخ الانتهاء، التعليق الآلي، ومُطالبة التذكير.

### متغيّرات بيئة موصى بها

- `SUBSCRIPTION_WEBHOOK_SECRET`
- `CRON_SECRET`

### ملحقية

رفع الوثائق يُكتب ضمن `./subscription-uploads/` (مجلّد gitignored).

