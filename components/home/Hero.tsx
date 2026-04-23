import Image from "next/image";
import { BookingWidget } from "./BookingWidget";

export type HeroProps = {
  leftImageUrl: string;
  leftImageAlt: string;
  rightImageUrl: string;
  rightImageAlt: string;
};

export function Hero({ leftImageUrl, leftImageAlt, rightImageUrl, rightImageAlt }: HeroProps) {
  return (
    <header className="relative flex flex-col overflow-x-hidden pt-24 md:pt-28">
      <div
        className="grid w-full grid-cols-1 md:min-h-[min(45vh,22rem)] md:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)_minmax(0,1fr)]"
        dir="ltr"
      >
        <div className="relative aspect-[5/3] w-full md:aspect-auto md:min-h-[min(52vh,28rem)]">
          <Image
            src={leftImageUrl}
            alt={leftImageAlt}
            fill
            priority
            className="object-cover"
            sizes="(min-width: 768px) 35vw, 100vw"
          />
        </div>

        <div
          dir="rtl"
          className="flex min-h-[12rem] flex-col items-center justify-center bg-surface-container-lowest px-6 py-10 text-center md:min-h-0 md:py-8"
        >
          <h1 className="text-balance text-2xl font-extrabold leading-snug tracking-tight text-[#0f3d47] md:text-3xl lg:text-4xl">
            روانس لتأجير السيارات
          </h1>
          <p className="mt-4 max-w-md text-pretty text-sm font-medium leading-relaxed text-[#0f3d47]/90 md:text-base">
            نقدم مجموعة واسعة من السيارات لتلبية احتياجات العملاء بمختلف الفئات والميزانيات.
          </p>
        </div>

        <div className="relative aspect-[5/3] w-full md:aspect-auto md:min-h-[min(52vh,28rem)]">
          <Image
            src={rightImageUrl}
            alt={rightImageAlt}
            fill
            priority
            className="object-cover"
            sizes="(min-width: 768px) 35vw, 100vw"
          />
        </div>
      </div>

      <div className="h-1.5 w-full shrink-0 bg-[#ebe4d9]" aria-hidden />

      <div className="relative z-10 mx-auto w-full max-w-6xl px-4 pb-10 pt-8 sm:px-6 lg:px-8">
        <BookingWidget />
      </div>
    </header>
  );
}
