import Image from "next/image";

const INTERIOR_IMG =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuD1DKyTl5GNHtr0zqEuHbS8SiKfOtIy1uifrNVHjcrX_Qcg_ur5GgZCnz3e_lbRKGUwmLx1pHPB1GpMV3QcTmmx0a_WzbNzN3RMBqARnsz4XIvXavPYBsLyIyilxb8X0ez-kkSQf1l0wQhEA2hdRVfhZvRMoLagctauKQHxyRNQpY7Ain3_EVI8YS0Vk0POo3Is5Vh065FePEukAJYZwszcufd7YddWf1ie9cWFPSbDmx6qcvM0FZx1TYHdf2RDKc4TxePhnItX0UnW";

export function FleetFeatured() {
  return (
    <div className="relative mt-32">
      <div className="grid grid-cols-1 items-center gap-8 lg:grid-cols-12">
        <div className="relative z-10 rounded-3xl bg-primary-container/10 p-12 lg:col-span-7 lg:p-24">
          <h2 className="mb-6 max-w-xl text-5xl font-extrabold leading-tight tracking-tighter">
            جودة السفر
            <br />
            بمعيار ذهبي.
          </h2>
          <p className="mb-10 max-w-lg text-lg text-on-surface-variant">
            خدمة الكونسيرج تمتد خارج السيارة: توصيل للمنزل، خطط سفر مخصّصة،
            ودعم أولوية على مدار الساعة في أنحاء المملكة.
          </p>
          <div className="flex flex-wrap gap-8">
            <div>
              <p className="text-4xl font-bold text-primary" dir="ltr">
                48h
              </p>
              <p className="text-xs font-bold uppercase tracking-widest text-stone-500">
                أقصى مدة إيجار
              </p>
            </div>
            <div>
              <p className="text-4xl font-bold text-primary" dir="ltr">
                150+
              </p>
              <p className="text-xs font-bold uppercase tracking-widest text-stone-500">
                مركبة في الأسطول
              </p>
            </div>
            <div>
              <p className="text-4xl font-bold text-primary" dir="ltr">
                12
              </p>
              <p className="text-xs font-bold uppercase tracking-widest text-stone-500">
                مركز خدمة
              </p>
            </div>
          </div>
        </div>
        <div className="lg:col-span-5">
          <div className="editorial-shadow aspect-video overflow-hidden rounded-2xl bg-surface shadow-2xl">
            <Image
              src={INTERIOR_IMG}
              alt="مقصورة سيارة فاخرة بجلد وبُرونز دافئ"
              width={1200}
              height={675}
              className="h-full w-full object-cover"
              sizes="(min-width: 1024px) 45vw, 100vw"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
