import Image from "next/image";

const HERO_IMG =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuCC7BGmOQu6wEwffgi-w7tuNpumBPfWCfugfXBj8pKMFnnAoQJ6X1fhNDVy7gySKbj1ZhSVM6NQe39B6Y7rh9RyT1KbK6_7p3W3Ov3twmGSRcITTq6ogFG_YL8b3rF7QrQFwAVEwxVWXn1pDEq4h5nhR98e-5Shj7fdY4jK_BiYpYPPPaYH36ANqNo0T9dEQJOTqcbspHUPlCUcwTT2l3ozNqhprZIP2GKmut-SwT9pFFkY40v4f-TZRu-xTAnOdqFPiHPsTxcsZvF6";

export function FleetHero() {
  return (
    <header className="relative mx-auto max-w-screen-2xl overflow-hidden px-8 pb-20 pt-32">
      <div className="grid grid-cols-1 items-end gap-8 lg:grid-cols-12">
        <div className="lg:col-span-7">
          <p className="mb-4 text-xs font-bold uppercase tracking-[0.2em] text-primary">
            أداء استثنائي
          </p>
          <h1 className="text-6xl font-extrabold leading-[0.9] tracking-tighter text-on-surface md:text-8xl">
            المجموعة
            <br />
            <span className="text-primary-container">المختارة</span>
          </h1>
          <p className="mt-8 max-w-md text-lg leading-relaxed text-on-surface-variant">
            تشكيلة مختارة من أرقى السيارات في العالم، تُصان بأعلى المعايير لمن
            يبحث عن تجربة لا تُضاهى.
          </p>
        </div>
        <div className="relative lg:col-span-5">
          <div className="editorial-shadow relative aspect-[4/5] rotate-2 overflow-hidden rounded-2xl bg-surface-container-low">
            <Image
              src={HERO_IMG}
              alt="سيارة رياضية فاخرة بزاوية جانبية"
              width={800}
              height={1000}
              className="h-full w-full object-cover"
              sizes="(min-width: 1024px) 40vw, 100vw"
              priority
            />
          </div>
          <div className="absolute -bottom-6 hidden rounded-xl bg-surface-container-lowest p-6 editorial-shadow md:block md:start-6">
            <p className="text-sm font-bold tracking-widest text-primary">
              تأسست 2024
            </p>
            <p className="mt-1 text-xs text-on-surface-variant">
              تميّز كونسيرج على مستوى عالمي
            </p>
          </div>
        </div>
      </div>
    </header>
  );
}
