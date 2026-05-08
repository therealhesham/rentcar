import {
  CalendarDays,
  CalendarRange,
  CarFront,
  Handshake,
  Truck,
} from "lucide-react";

type ServiceItem = {
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
};

const services: ServiceItem[] = [
  {
    title: "التأجير اليومي",
    description:
      "نقدم خدمة تأجير السيارات اليومية لتلبية احتياجاتك في الحركة والتنقل. سواء كنت ترغب في رحلة يومية أو تحتاج إلى سيارة لفترة مؤقتة، ستجد لدينا الحل الأمثل بأسعار تنافسية.",
    icon: CalendarDays,
  },
  {
    title: "التأجير الأسبوعي",
    description:
      "سواء كنت تبحث عن سيارة عملية أو فخمة، نوفر لك خيار التأجير الأسبوعي مع باقة متنوعة من السيارات وأسعار مناسبة وخدمة احترافية تضمن راحتك.",
    icon: CalendarRange,
  },
  {
    title: "تأجير طويل الأجل",
    description:
      "نقدم برامج تأجير طويلة الأجل للشركات والأفراد مع مرونة عالية وخيارات متعددة تناسب احتياجاتك طوال العام.",
    icon: CarFront,
  },
  {
    title: "التوصيل والاستلام",
    description:
      "يمكنك طلب توصيل السيارة إلى موقعك واستلامها في أي وقت يناسبك. نحن هنا لتسهيل تجربتك وتوفير وقتك.",
    icon: Handshake,
  },
  {
    title: "الدعم على الطريق",
    description:
      "نوفر خدمة دعم على الطريق لضمان راحتك أثناء القيادة، مع استجابة سريعة في الحالات الطارئة حتى تعود لرحلتك بأمان.",
    icon: Truck,
  },
];

export function ServicesSection() {
  return (
    <section className="bg-surface px-4 py-14 sm:px-8 sm:py-20">
      <div className="mx-auto max-w-screen-xl">
        <h2 className="mb-10 text-center text-4xl font-extrabold tracking-tight text-[#003749]">
          خدماتنا
        </h2>

        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 xl:grid-cols-6">
          {services.map((service, index) => {
            const colSpanClass =
              index < 3 ? "xl:col-span-2" : "xl:col-span-3";
            const Icon = service.icon;

            return (
              <article
                key={service.title}
                className={`relative rounded-[1.75rem] bg-white px-5 pb-6 pt-10 shadow-[0_10px_30px_rgba(20,20,20,0.08)] ${colSpanClass}`}
              >
                <div className="absolute right-5 top-0 flex h-20 w-20 -translate-y-1/2 items-center justify-center rounded-2xl border border-[#003749]/15 bg-[#dce4ea] shadow-md">
                  <Icon className="h-11 w-11 text-[#24475b]" />
                </div>

                <h3 className="mb-3 text-center text-3xl font-bold text-[#0f4a61] md:text-4xl">
                  {service.title}
                </h3>
                <p className="text-base leading-9 text-[#1f1f1f]">
                  {service.description}
                </p>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
