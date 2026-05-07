import type { Metadata } from "next";
import Image from "next/image";
import { SiteNav } from "@/components/shared/SiteNav";
import { SiteFooter } from "@/components/home/SiteFooter";

export const metadata: Metadata = {
  title: "من نحن | روائس لتأجير السيارات",
  description:
    "تعرف على رؤية روائس لتأجير السيارات ورسالتها وقيمها وميادين عملها.",
};

const pillars = [
  {
    key: "vision",
    title: "رؤيتنا",
    body: "نكون رواد بلادنا في قطاع التأجير وتقديم الخدمات المبتكرة، بنظرة للأفق من كل متشوق للمزيد.",
    icon: (
      <svg viewBox="0 0 40 40" fill="none" className="h-10 w-10" aria-hidden>
        <circle cx="20" cy="20" r="19" stroke="#003749" strokeWidth="2" />
        <circle cx="20" cy="20" r="10" stroke="#dbb878" strokeWidth="2" />
        <circle cx="20" cy="20" r="3" fill="#003749" />
      </svg>
    ),
  },
  {
    key: "mission",
    title: "رسالتنا",
    body: "نصنع الفارق بجودة عالمية والتزام بالمبادئ والأخلاق المهنية، ونعمل على رفع مستوى الأصول وندعم الكفاءة العالية.",
    icon: (
      <svg viewBox="0 0 40 40" fill="none" className="h-10 w-10" aria-hidden>
        <path
          d="M20 4L24.5 15H36L26.7 21.8L30.5 33L20 26.5L9.5 33L13.3 21.8L4 15H15.5L20 4Z"
          stroke="#003749"
          strokeWidth="2"
          fill="none"
        />
        <circle cx="20" cy="19" r="4" fill="#dbb878" />
      </svg>
    ),
  },
  {
    key: "values",
    title: "قيمنا",
    body: "وضع المبادئ والنزاهة في مقدمة كل ما نقوم به، وتقديم خدمة العميل المتميز والسعي نحو أفضل معايير الجودة والأداء.",
    icon: (
      <svg viewBox="0 0 40 40" fill="none" className="h-10 w-10" aria-hidden>
        <rect x="4" y="4" width="32" height="32" rx="8" stroke="#003749" strokeWidth="2" />
        <path d="M13 20l5 5 9-10" stroke="#dbb878" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    key: "fields",
    title: "مبادئنا",
    body: "التعامل بدقة ونزاهة وشفافية وسلوك مهني في جميع الامتيازات، وتلبية طموح العميل بأعلى معايير الجودة المتطورة والتطوير المستمر.",
    icon: (
      <svg viewBox="0 0 40 40" fill="none" className="h-10 w-10" aria-hidden>
        <path d="M8 32 L8 20 L16 20 L16 32" stroke="#003749" strokeWidth="2" strokeLinecap="round" />
        <path d="M18 32 L18 14 L26 14 L26 32" stroke="#dbb878" strokeWidth="2" strokeLinecap="round" />
        <path d="M28 32 L28 8 L36 8 L36 32" stroke="#003749" strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),
  },
];

export default function AboutPage() {
  return (
    <div className="flex min-h-screen flex-col bg-surface text-on-surface">
      <SiteNav active="about" />

      {/* ─── Hero ─── */}
      <header className="relative flex min-h-[40vh] items-center justify-center overflow-hidden pt-16 sm:min-h-[50vh] sm:pt-20">
        <Image
          src="https://images.unsplash.com/photo-1489821584143-984f940e1256?auto=format&fit=crop&w=1600&q=80"
          alt="معرض سيارات"
          fill
          priority
          className="object-cover"
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-[#003749]" />
        <div className="relative z-10 px-4 text-center">
          <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl lg:text-5xl">
            تأجير السيارات
          </h1>
          <p className="mt-3 text-sm font-medium text-white/80 sm:text-base">
            روائس لتأجير السيارات، خدمات التأجير والرفاهية
          </p>
        </div>
        {/* شريط ذهبي سفلي */}
        <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-[#dbb878]" aria-hidden />
      </header>

      {/* ─── أعمدة الهوية (رؤية / رسالة / قيم / ميادين) ─── */}
      <section className="mx-auto w-full max-w-screen-xl px-4 py-14 sm:px-8 sm:py-20">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {pillars.map((p) => (
            <div
              key={p.key}
              className="flex flex-col gap-4 rounded-2xl border border-[#dbb878]/40 bg-white p-6 shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-[#003749]/5">
                {p.icon}
              </div>
              <h2 className="text-lg font-extrabold text-[#003749]">{p.title}</h2>
              <p className="text-sm leading-relaxed text-on-surface-variant">{p.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ─── هدفنا ─── */}
      <section className="bg-surface-container-low px-4 py-14 sm:px-8 sm:py-20">
        <div className="mx-auto flex w-full max-w-5xl flex-col items-center gap-10 md:flex-row md:items-start md:gap-16">
          {/* النص + الرسم البياني */}
          <div className="order-2 flex flex-1 flex-col gap-6 text-center md:order-1 md:text-right">
            <h2 className="text-3xl font-extrabold text-[#003749] sm:text-4xl">هدفنا</h2>
            <p className="text-sm leading-loose text-on-surface-variant sm:text-base">
              تقديم خدمات استثنائية وتعزيز الابتكار وتحسين عروضنا باستمرار للبقاء في
              المقدمة والتكيف مع الإتجاهات والتقنيات لتحقيق النمو المستدام والربحية مع
              الحفاظ على الممارسات التجارية الأخلاقية.
            </p>
            <p className="text-sm leading-loose text-on-surface-variant sm:text-base">
              مع تهيئة بيئة عمل إيجابية وشاملة تعزز التعاون والنمو الشخصي وإحداث تأثير
              إيجابي على المجتمع والمساهمة مع المجتمعات التي نعمل فيها.
            </p>

            {/* رسم بياني */}
            <div className="mt-4 flex justify-center md:justify-start" aria-hidden>
              <svg
                viewBox="0 0 120 80"
                className="h-20 w-32 sm:h-24 sm:w-40"
                fill="#003749"
              >
                <rect x="6" y="50" width="14" height="26" rx="2" />
                <rect x="28" y="38" width="14" height="38" rx="2" />
                <rect x="50" y="22" width="14" height="54" rx="2" />
                <rect x="72" y="6" width="14" height="70" rx="2" />
                <line
                  x1="0"
                  y1="78"
                  x2="120"
                  y2="78"
                  stroke="#003749"
                  strokeWidth="1.5"
                />
              </svg>
            </div>
          </div>

          {/* رسم الهدف من ملف target.png */}
          <div className="order-1 flex shrink-0 items-center justify-center md:order-2" aria-hidden>
            <Image
              src="/target.png"
              alt=""
              width={360}
              height={360}
              className="h-56 w-56 object-contain sm:h-72 sm:w-72 md:h-80 md:w-80 lg:h-[22rem] lg:w-[22rem]"
            />
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
