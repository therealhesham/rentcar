import { ExternalLink, FileImage, IdCard, ScrollText } from "lucide-react";

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

function MetaChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-outline-variant/20 bg-surface-container-low/60 px-3 py-2.5">
      <p className="text-[11px] font-bold uppercase tracking-wide text-on-surface-variant">
        {label}
      </p>
      <p className="mt-1 font-mono text-sm font-semibold tabular-nums text-on-surface" dir="ltr">
        {value}
      </p>
    </div>
  );
}

function AttachmentCard({
  title,
  url,
  icon: Icon,
  large,
}: {
  title: string;
  url: string;
  icon: typeof IdCard;
  large?: boolean;
}) {
  return (
    <article className="group overflow-hidden rounded-2xl border border-outline-variant/25 bg-white shadow-sm ring-1 ring-outline-variant/10 transition-shadow hover:shadow-md">
      <div className="flex items-center justify-between gap-2 border-b border-outline-variant/15 px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-container/40 text-primary">
            <Icon className="h-4 w-4" aria-hidden />
          </span>
          <h3 className="truncate text-sm font-bold text-on-surface">{title}</h3>
        </div>
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary transition-colors hover:bg-primary/15"
        >
          فتح بالحجم الكامل
          <ExternalLink className="h-3.5 w-3.5" aria-hidden />
        </a>
      </div>
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className="relative block overflow-hidden bg-gradient-to-b from-neutral-50 to-neutral-100"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt={title}
          className={[
            "mx-auto w-full object-contain transition-transform duration-300 group-hover:scale-[1.02]",
            large ? "max-h-[min(440px,55vh)]" : "max-h-52",
          ].join(" ")}
          loading="lazy"
        />
      </a>
    </article>
  );
}

type Props = BookingKycAttachmentInput & {
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
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-outline-variant/35 bg-surface-container-low/50 px-6 py-14 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-container-high text-on-surface-variant">
          <FileImage className="h-7 w-7" aria-hidden />
        </span>
        <p className="mt-4 text-sm font-bold text-on-surface">لا توجد مرفقات</p>
        <p className="mt-1 max-w-xs text-xs leading-relaxed text-on-surface-variant">
          لم يُرفَع بعد صور الهوية أو الرخصة عند إتمام هذا الحجز.
        </p>
      </div>
    );
  }

  const idCardTitle =
    idDocumentKind === "VISITOR" || passportNumber
      ? "الجواز / الهوية"
      : "الهوية / الإقامة";

  const meta: { label: string; value: string }[] = [];
  const kindLabel = idDocumentKindLabelAr(idDocumentKind);
  if (kindLabel) meta.push({ label: "نوع المستند", value: kindLabel });
  if (nationalIdNumber) {
    meta.push({
      label: idDocumentKind === "RESIDENT" ? "رقم الإقامة" : "رقم الهوية",
      value: nationalIdNumber,
    });
  }
  if (passportNumber) meta.push({ label: "رقم الجواز", value: passportNumber });
  if (licenseNumber) meta.push({ label: "رقم الرخصة", value: licenseNumber });
  if (licenseExpiryDate) meta.push({ label: "انتهاء الرخصة", value: licenseExpiryDate });

  return (
    <div className="space-y-5">
      {meta.length > 0 ? (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {meta.map((m) => (
            <MetaChip key={m.label} label={m.label} value={m.value} />
          ))}
        </div>
      ) : null}

      {(idCardImageUrl || driverLicenseImageUrl) && (
        <div
          className={[
            "grid gap-5",
            largePreview && idCardImageUrl && driverLicenseImageUrl
              ? "lg:grid-cols-2"
              : "grid-cols-1",
          ].join(" ")}
        >
          {idCardImageUrl ? (
            <AttachmentCard
              title={idCardTitle}
              url={idCardImageUrl}
              icon={IdCard}
              large={largePreview}
            />
          ) : null}
          {driverLicenseImageUrl ? (
            <AttachmentCard
              title="رخصة القيادة"
              url={driverLicenseImageUrl}
              icon={ScrollText}
              large={largePreview}
            />
          ) : null}
        </div>
      )}
    </div>
  );
}
