import { getPromoBannerSlides } from "@/lib/site-settings";
import { Reveal } from "./HomeMotion";
import { PromoBannerCarousel } from "./PromoBannerCarousel";

export async function PromoBanner() {
  const slides = await getPromoBannerSlides();
  if (slides.length === 0) return null;

  return (
    <section aria-label="العروض الترويجية" className="bg-white py-6 sm:py-8">
      <Reveal>
        <div className="px-4 sm:px-6 lg:px-8">
          <PromoBannerCarousel slides={slides} />
        </div>
      </Reveal>
    </section>
  );
}
