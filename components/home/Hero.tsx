import Image from "next/image";
import { BookingWidget } from "./BookingWidget";

const HERO_IMAGE =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuD_wHp6ORrYsBkgi0UyOM9QPOZM5bDcBfhhiqFUAWIi_pRppfkX3yuO9YkH7lRHPQn0zMBLvBo77J3n-avrqC22bLvZ71W4X4QAFO6YqbuEJtNyFdOIgtj8yWTFS5AkpYAADSaZIePszEqX3bSF4-QdK92ONP57oeRSrrsiQ_SQu0Z0EXEoRFknm0KQUTN9WyJSd9H9sm_nfmeIVaY9ud5JaTpCFqXlwGaNLIvs-RFTOJcu-EAu_w31N9dPlt3mVhqd6YyUdFRk3Y6M";

export function Hero() {
  return (
    <header className="relative flex min-h-screen items-center overflow-hidden pt-20">
      <div className="absolute inset-0 z-0">
        <Image
          src={HERO_IMAGE}
          alt="سيارة بورش فاخرة على طريق ساحلي عند غروب الشمس"
          fill
          priority
          className="object-cover"
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-gradient-to-l from-background via-background/40 to-transparent" />
      </div>
      <div className="relative z-10 mx-auto w-full max-w-7xl px-8">
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
