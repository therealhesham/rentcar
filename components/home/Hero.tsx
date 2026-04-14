import Image from "next/image";
import { BookingWidget } from "./BookingWidget";

export type HeroProps = {
  imageUrl: string;
  imageAlt: string;
};

export function Hero({ imageUrl, imageAlt }: HeroProps) {
  return (
    <header className="relative flex min-h-screen items-start justify-center overflow-x-hidden pt-28 md:pt-32">
      <div className="absolute inset-0 z-0 overflow-hidden">
        <Image
          src={imageUrl}
          alt={imageAlt}
          fill
          priority
          className="object-cover"
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-gradient-to-l from-background via-background/40 to-transparent" />
      </div>
      <div className="relative z-10 mx-auto w-full max-w-7xl px-8 pb-[min(28rem,45vh)]">
        <div className="max-w-2xl text-start">
          <span className="mb-4 block text-xs font-bold tracking-[0.2em] text-primary">
            التميّز في الحركة
          </span>
          <h1 className="mb-8 text-[3.5rem] font-extrabold leading-[1.15] tracking-tight text-on-surface">
            رحلتك، <br />
            <span className="text-primary">بأسلوبٍ راقٍ</span>
          </h1>
          <p className="mb-12 max-w-md text-lg leading-relaxed text-on-surface-variant">
            اختبر قمة الفخامة في تأجير السيارات: أسطول مختار، خدمة كونسيرج
            مخصّصة، وحرية الطريق المفتوح أمامك.
          </p>
        </div>
      </div>
      <BookingWidget />
    </header>
  );
}
