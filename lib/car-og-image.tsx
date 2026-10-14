import { ImageResponse } from "next/og";
import { prisma } from "@/lib/prisma";
import { getFleetCarMapByModelIds } from "@/lib/fleet-data";
import { getSiteUrl } from "@/lib/seo";

export const CAR_OG_SIZE = { width: 1200, height: 630 } as const;

const NAVY = "#003749";
const GOLD = "#dbb878";

/**
 * Satori (محرك ImageResponse) لا يشكّل الحروف العربية ولا يحمّل خطاً عربياً هنا، فنص
 * الكارت لاتيني فقط — أي اسم عربي يُحذف بدل أن يظهر مقطّعاً أو مربعات.
 */
function latinOnly(s: string | null | undefined): string {
  const t = s?.trim() ?? "";
  return /^[\x20-\x7EÀ-ɏ]+$/.test(t) ? t : "";
}

function sniffMime(b: Uint8Array): "image/png" | "image/jpeg" | "image/gif" | null {
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "image/png";
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) return "image/gif";
  return null;
}

/**
 * يجلب صورة السيارة كـ data URI. Satori يفهم PNG/JPEG/GIF فقط، وصور الأسطول قد تكون
 * WebP/AVIF، لذا نمرّرها على sharp (موجود مع Next) فنحصل على PNG مصغّر وسريع الرسم.
 * أي فشل → null والكارت يُرسم بلا صورة بدل أن يفشل كله.
 */
async function loadCarImage(src: string): Promise<string | null> {
  try {
    const url = src.startsWith("/") ? `${getSiteUrl()}${src}` : src;
    const res = await fetch(url, { signal: AbortSignal.timeout(7000) });
    if (!res.ok) return null;
    let bytes: Uint8Array = new Uint8Array(await res.arrayBuffer());

    try {
      const sharp = (await import("sharp")).default;
      bytes = await sharp(bytes)
        .resize({ width: 1100, height: 700, fit: "inside", withoutEnlargement: true })
        .png()
        .toBuffer();
    } catch {
      // sharp غير متاح: نقبل الصيغ التي يفهمها Satori كما هي ونتجاهل غيرها.
    }

    const mime = sniffMime(bytes);
    if (!mime) return null;
    return `data:${mime};base64,${Buffer.from(bytes).toString("base64")}`;
  } catch {
    return null;
  }
}

/** بطاقة المشاركة 1200×630 للسيارة (واتساب/فيسبوك/إكس/لينكدإن/تيليجرام). */
export async function renderCarOgImage(modelId: number): Promise<ImageResponse> {
  const [model, fleetMap] = await Promise.all([
    Number.isInteger(modelId) && modelId > 0
      ? prisma.carModel.findUnique({
          where: { id: modelId },
          include: { brand: true, category: true },
        })
      : null,
    getFleetCarMapByModelIds([modelId], undefined, { locale: "en" }),
  ]);

  const brand = latinOnly(model?.brand.nameEn) || latinOnly(model?.brand.name);
  const name = latinOnly(model?.nameEn) || latinOnly(model?.name);
  const category = latinOnly(model?.category.titleEn) || latinOnly(model?.category.title);
  const year = model?.year ?? null;
  const price = fleetMap.get(modelId)?.priceUi ?? null;
  const image = model?.image?.trim() ? await loadCarImage(model.image.trim()) : null;
  const host = new URL(getSiteUrl()).host;

  const priceNow = price ? Math.ceil(Number(price.primaryAmount.replace(/,/g, ""))) : null;
  const priceWas = price?.originalPrimaryAmount
    ? Math.ceil(Number(price.originalPrimaryAmount.replace(/,/g, "")))
    : null;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          position: "relative",
          background: `linear-gradient(135deg, #00222e 0%, ${NAVY} 55%, #005a6e 100%)`,
          color: "white",
          fontFamily: "sans-serif",
        }}
      >
        {/* هالة ذهبية خلف السيارة */}
        <div
          style={{
            position: "absolute",
            right: -80,
            top: -40,
            width: 900,
            height: 760,
            display: "flex",
            background: "radial-gradient(closest-side, rgba(219,184,120,0.30), rgba(219,184,120,0))",
          }}
        />
        {/* خط ذهبي علوي */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 8,
            display: "flex",
            background: `linear-gradient(90deg, ${GOLD}, rgba(219,184,120,0.15))`,
          }}
        />

        {/* ظل أرضي */}
        <div
          style={{
            position: "absolute",
            right: 90,
            bottom: 96,
            width: 620,
            height: 60,
            display: "flex",
            background: "radial-gradient(closest-side, rgba(0,0,0,0.55), rgba(0,0,0,0))",
          }}
        />
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
          <img
            src={image}
            width={720}
            height={440}
            style={{
              position: "absolute",
              right: 30,
              top: 120,
              width: 720,
              height: 440,
              objectFit: "contain",
            }}
          />
        ) : null}

        {/* العمود النصي */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            padding: "56px 64px",
            width: 520,
            height: "100%",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div
              style={{
                display: "flex",
                fontSize: 30,
                fontWeight: 800,
                letterSpacing: 10,
                color: GOLD,
              }}
            >
              RAWAES
            </div>
            <div
              style={{
                display: "flex",
                marginTop: 6,
                fontSize: 15,
                letterSpacing: 6,
                color: "rgba(255,255,255,0.6)",
              }}
            >
              CAR RENTAL
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column" }}>
            {category ? (
              <div
                style={{
                  display: "flex",
                  alignSelf: "flex-start",
                  padding: "6px 16px",
                  borderRadius: 999,
                  background: "rgba(219,184,120,0.18)",
                  border: "1px solid rgba(219,184,120,0.5)",
                  color: GOLD,
                  fontSize: 18,
                  fontWeight: 700,
                  letterSpacing: 2,
                  textTransform: "uppercase",
                }}
              >
                {category}
              </div>
            ) : null}
            {brand ? (
              <div
                style={{
                  display: "flex",
                  marginTop: 20,
                  fontSize: 30,
                  fontWeight: 600,
                  letterSpacing: 4,
                  color: "rgba(255,255,255,0.75)",
                  textTransform: "uppercase",
                }}
              >
                {brand}
              </div>
            ) : null}
            {name ? (
              <div
                style={{
                  display: "flex",
                  marginTop: 4,
                  fontSize: name.length > 12 ? 54 : 72,
                  fontWeight: 800,
                  lineHeight: 1.05,
                  letterSpacing: -1,
                }}
              >
                {name}
                {year ? (
                  <span style={{ display: "flex", marginLeft: 16, color: "rgba(255,255,255,0.45)" }}>
                    {year}
                  </span>
                ) : null}
              </div>
            ) : null}
          </div>

          <div style={{ display: "flex", flexDirection: "column" }}>
            {priceNow != null ? (
              <div style={{ display: "flex", flexDirection: "column" }}>
                <div
                  style={{
                    display: "flex",
                    fontSize: 16,
                    letterSpacing: 4,
                    color: "rgba(255,255,255,0.6)",
                    textTransform: "uppercase",
                  }}
                >
                  From
                </div>
                <div style={{ display: "flex", alignItems: "baseline", marginTop: 2 }}>
                  <div style={{ display: "flex", fontSize: 76, fontWeight: 900, color: GOLD, lineHeight: 1 }}>
                    {priceNow}
                  </div>
                  <div style={{ display: "flex", marginLeft: 12, fontSize: 28, fontWeight: 700, color: "white" }}>
                    SAR
                  </div>
                  <div style={{ display: "flex", marginLeft: 8, fontSize: 22, color: "rgba(255,255,255,0.6)" }}>
                    / day
                  </div>
                  {priceWas ? (
                    <div
                      style={{
                        display: "flex",
                        marginLeft: 18,
                        fontSize: 24,
                        color: "rgba(255,255,255,0.45)",
                        textDecoration: "line-through",
                      }}
                    >
                      {priceWas}
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}
            <div
              style={{
                display: "flex",
                marginTop: 22,
                fontSize: 20,
                letterSpacing: 1,
                color: "rgba(255,255,255,0.55)",
              }}
            >
              {host}
            </div>
          </div>
        </div>
      </div>
    ),
    { ...CAR_OG_SIZE },
  );
}
