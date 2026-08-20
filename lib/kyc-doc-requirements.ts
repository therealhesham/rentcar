/**
 * حالة حقلَي صورة الهوية/الجواز وصورة رخصة القيادة في نموذج إتمام الحجز — يضبطها
 * السوبر أدمن من `SiteSetting`. القيمة الافتراضية تطابق السلوك السابق قبل هذا
 * الإعداد: صورة الهوية اختيارية وصورة الرخصة إلزامية.
 */
export type KycDocRequirementLevel = "REQUIRED" | "OPTIONAL" | "HIDDEN";

export type KycDocRequirements = {
  idImage: KycDocRequirementLevel;
  licenseImage: KycDocRequirementLevel;
};

export const DEFAULT_KYC_DOC_REQUIREMENTS: KycDocRequirements = {
  idImage: "OPTIONAL",
  licenseImage: "REQUIRED",
};

const KYC_DOC_REQUIREMENT_LEVELS = new Set<KycDocRequirementLevel>([
  "REQUIRED",
  "OPTIONAL",
  "HIDDEN",
]);

function asKycDocRequirementLevel(
  v: unknown,
  fallback: KycDocRequirementLevel,
): KycDocRequirementLevel {
  const s = typeof v === "string" ? v.trim().toUpperCase() : "";
  return KYC_DOC_REQUIREMENT_LEVELS.has(s as KycDocRequirementLevel)
    ? (s as KycDocRequirementLevel)
    : fallback;
}

export function normalizeKycDocRequirements(raw: unknown): KycDocRequirements {
  const o =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};
  return {
    idImage: asKycDocRequirementLevel(o.idImage, DEFAULT_KYC_DOC_REQUIREMENTS.idImage),
    licenseImage: asKycDocRequirementLevel(
      o.licenseImage,
      DEFAULT_KYC_DOC_REQUIREMENTS.licenseImage,
    ),
  };
}
