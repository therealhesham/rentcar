import { parseCarLandingModelId } from "@/lib/car-landing-data";
import { CAR_OG_SIZE, renderCarOgImage } from "@/lib/car-og-image";

export const alt = "Rawaes Car Rental";
export const size = CAR_OG_SIZE;
export const contentType = "image/png";
// الأسعار تتغير؛ ساعة تكفي لتخفيف الضغط عند انتشار الرابط وتبقي الكارت حديثاً.
export const revalidate = 3600;

export default async function Image({
  params,
}: {
  params: Promise<{ locale: string; modelId: string }>;
}) {
  const { modelId } = await params;
  return renderCarOgImage(parseCarLandingModelId(modelId) ?? 0);
}
