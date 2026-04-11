import Image from "next/image";

const branches = [
  {
    name: "جدة",
    tagline: "فخامة ساحلية",
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuAzm2JkCED8sfjUMvUmqs3-vhDFaNUc9etAJZMXbq5BLLatryCVXi23Uc6WTEF3-Tz2fWYc6-2WVqw1sCJ2Ypc-qY1JoSh19yxY0zFIGogZJB0Elm2lEXYamt6GWActJ9WGcJ_aLowD6irWKXnGAAs_Z7ZzRDq8s-JsCxstS_d7231qovW-UeBsFZUAEPsIoclXQnT83j1GCON7NeYtd_zeC1JQZ4pq0IA2Jiwlup-bKlhp3nLPn058BkawWU8HNZDaUWDkXHzNkJrF",
    alt: "أبراج وواجهة بحرية في جدة عند الغروب",
    offsetMd: false,
  },
  {
    name: "المدينة المنورة",
    tagline: "أناقة روحانية",
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuCQwIQfdf8UfapHji6VjH9usVAe0glK5JJzo9mX7mrAVJDsIuvAOGKnZ0GK72ADHdxE6mf_ima0o9c-fZICYpLn0F438qzo-vO4tBcTEOVMe5NFv5ZE4_hj8iwxvNh2ermQgd5nBkDvsAV7gZHBD1pgZcRuShkkWpREb45O_a49Y0cZF7fL8RyhLPNXfc1RrcyR1W1gvfV4aJR6QAkeXnR-7Tuqi_q1p2akTgxfJBbnHiah1StnuxTn4rEsTMgy1gw2drfyHGdwFq3n",
    alt: "إضاءة معمارية هادئة في المدينة المنورة",
    offsetMd: true,
  },
  {
    name: "تبوك",
    tagline: "بوابة الشمال",
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuBg5rLeNXdT23WVqioYdldgIzHfEJGbfyuMAT8x4GOEdCw7Dt91LRd7565w8cP0bNcHL1a1_Su9iyhgkT3sj20zTAyRWFK_hV6QLjrqcPzYvM3iqNHEg39HwZpVhtpj9F4EehjxCo8LSwu9DfgtukaONxvS6A5I9xFm7JMauFIksqgKxIOASd9Rh63UuH0bI3TBJtnx57Nl6wTFuZMvSDZbY5r94OBIYnfI5wCytrIgUEc05X78Sb8B8JNUy8UGK-n9sx8Mh6ZLqALV",
    alt: "مشهد صحراوي في تبوك عند الذهبي",
    offsetMd: false,
  },
  {
    name: "المجاويد",
    tagline: "قلب حضري",
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuD_bx3X-8zX1QmFnnUXc-LGCL810-l339nU9SrBYYM8d5E99VCK9XaArJ6WrS5YvDpSmhWCEkJIFx8xkz8m22VD5gJRdpOHOdw9U9ulBY55FRw_vyBj5tFYz9EHCG39QDLg_hnmPSghp9poR0_CZ9T78Hg8eCODSLtUyxy76fqHIgJUAtkkvoPVnicOZbF0xHGkgA7RPooD7oiPdmsb1o_PA4RT65GTnVhdtsH5HkS0exao_dDX7Nc329k915ImtVPp43kRliJxVo8W",
    alt: "أضواء مدينة فاخرة ليلاً",
    offsetMd: true,
  },
] as const;

export function BranchesShowcase() {
  return (
    <section id="branches" className="bg-surface-container-low py-24">
      <div className="mx-auto max-w-7xl px-8">
        <div className="mb-16 flex flex-col items-end justify-between gap-8 md:flex-row">
          <div className="text-start">
            <span className="mb-4 block text-xs font-bold tracking-[0.15em] text-primary">
              نوسّع دائرة التميّز
            </span>
            <h2 className="text-4xl font-extrabold tracking-tight">
              فروعنا الجديدة
            </h2>
          </div>
          <p className="max-w-md border-s-2 border-primary-container ps-6 italic leading-relaxed text-on-surface-variant">
            نعيد تعريف سفر الفخامة في أنحاء المملكة. زرنا في أحدث مواقعنا
            المميزة.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-4">
          {branches.map((b) => (
            <div
              key={b.name}
              className={`group relative h-[400px] overflow-hidden rounded-xl ${b.offsetMd ? "md:mt-12" : ""}`}
            >
              <Image
                src={b.image}
                alt={b.alt}
                fill
                className="object-cover transition-transform duration-700 group-hover:scale-110"
                sizes="(min-width: 768px) 25vw, 100vw"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-on-surface/90 to-transparent" />
              <div className="absolute bottom-6 start-6 text-start">
                <h3 className="mb-1 text-xl font-bold text-white">{b.name}</h3>
                <p className="text-sm font-medium text-primary-container">
                  {b.tagline}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
