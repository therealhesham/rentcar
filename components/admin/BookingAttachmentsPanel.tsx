import { ExternalLink } from "lucide-react";

export type BookingKycAttachmentInput = {
  idDocumentKind: string | null;
  nationalIdNumber: string | null;
  passportNumber: string | null;
  licenseNumber: string | null;
  licenseExpiryDate: string | null;
  idCardImageUrl: string | null;
  driverLicenseImageUrl: string | null;
};

function idDocumentKindLabelAr(kind: string | null | undefined): string | null {
  if (!kind) return null;
  switch (kind) {
    case "CITIZEN":
      return "مواطن";
    case "RESIDENT":
      return "مقيم";
    case "VISITOR":
      return "زائر";
    case "RESIDENT_VISITOR":
      return "مقيم / زائر (سجل قديم)";
    default:
      return kind;
  }
}

function hasKycMeta(k: BookingKycAttachmentInput): boolean {
  return Boolean(
    k.idDocumentKind ||
      k.nationalIdNumber ||
      k.passportNumber ||
      k.licenseNumber ||
      k.licenseExpiryDate ||
      k.idCardImageUrl ||
      k.driverLicenseImageUrl,
  );
}

function AttachmentCard({
  title,
  url,
  large,
}: {
  title: string;
  url: string;
  large?: boolean;
}) {
  return (
    <article className="overflow-hidden rounded-xl border border-outline-variant/30 bg-surface-container-low">
      <div className="flex items-center justify-between gap-2 border-b border-outline-variant/20 px-3 py-2">
        <h3 className="text-sm font-bold text-on-surface">{title}</h3>
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline"
        >
          فتح
          <ExternalLink className="h-3.5 w-3.5" aria-hidden />
        </a>
      </div>
      <a href={url} target="_blank" rel="noreferrer" className="block bg-neutral-100">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt={title}
          className={[
            "mx-auto w-full object-contain",
            large ? "max-h-[min(420px,50vh)]" : "max-h-48",
          ].join(" ")}
          loading="lazy"
        />
      </a>
    </article>
  );
}

type Props = BookingKycAttachmentInput & {
  /** عرض أكبر للمعاينة — صفحة التفاصيل */
  largePreview?: boolean;
};

export function BookingAttachmentsPanel({
  idDocumentKind,
  nationalIdNumber,
  passportNumber,
  licenseNumber,
  licenseExpiryDate,
  idCardImageUrl,
  driverLicenseImageUrl,
  largePreview = false,
}: Props) {
  if (!hasKycMeta({
    idDocumentKind,
    nationalIdNumber,
    passportNumber,
    licenseNumber,
    licenseExpiryDate,
    idCardImageUrl,
    driverLicenseImageUrl,
  })) {
    return (
      <p className="rounded-xl border border-dashed border-outline-variant/40 bg-surface-container-low px-4 py-6 text-sm text-on-surface-variant">
        لا توجد مرفقات (هوية / رخصة) مسجّلة لهذا الحجز.
      </p>
    );
  }

  const idCardTitle =
    idDocumentKind === "VISITOR" || passportNumber
      ? "صورة الجواز / الهوية"
      : "صورة الهوية / الإقامة";

  return (
    <div className="space-y-4">
      <dl className="grid gap-2 rounded-xl border border-outline-variant/30 bg-surface-container-low px-4 py-3 text-sm sm:grid-cols-2">
        {idDocumentKind ? (
          <div>
            <dt className="text-xs font-bold text-on-surface-variant">نوع المستند</dt>
            <dd className="mt-0.5 font-medium">{idDocumentKindLabelAr(idDocumentKind)}</dd>
          </div>
        ) : null}
        {nationalIdNumber ? (
          <div>
            <dt className="text-xs font-bold text-on-surface-variant">
              {idDocumentKind === "RESIDENT" ? "رقم الإقامة" : "رقم الهوية"}
            </dt>
            <dd className="mt-0.5 font-mono tabular-nums" dir="ltr">
              {nationalIdNumber}
            </dd>
          </div>
        ) : null}
        {passportNumber ? (
          <div>
            <dt className="text-xs font-bold text-on-surface-variant">رقم الجواز</dt>
            <dd className="mt-0.5 font-mono tabular-nums" dir="ltr">
              {passportNumber}
            </dd>
          </div>
        ) : null}
        {licenseNumber ? (
          <div>
            <dt className="text-xs font-bold text-on-surface-variant">رقم الرخصة</dt>
            <dd className="mt-0.5 font-mono tabular-nums" dir="ltr">
              {licenseNumber}
            </dd>
          </div>
        ) : null}
        {licenseExpiryDate ? (
          <div>
            <dt className="text-xs font-bold text-on-surface-variant">انتهاء الرخصة</dt>
            <dd className="mt-0.5 font-mono tabular-nums" dir="ltr">
              {licenseExpiryDate}
            </dd>
          </div>
        ) : null}
      </dl>

      {(idCardImageUrl || driverLicenseImageUrl) && (
        <div
          className={[
            "grid gap-4",
            largePreview ? "md:grid-cols-2" : "grid-cols-1",
          ].join(" ")}
        >
          {idCardImageUrl ? (
            <AttachmentCard title={idCardTitle} url={idCardImageUrl} large={largePreview} />
          ) : null}
          {driverLicenseImageUrl ? (
            <AttachmentCard
              title="صورة رخصة القيادة"
              url={driverLicenseImageUrl}
              large={largePreview}
            />
          ) : null}
        </div>
      )}
    </div>
  );
}
