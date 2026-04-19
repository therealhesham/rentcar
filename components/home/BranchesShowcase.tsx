import Image from "next/image";
import { branchImageUrl, getNewBranchesForHome } from "@/lib/branch-data";

export async function BranchesShowcase() {
  const branches = await getNewBranchesForHome();

  if (branches.length === 0) {
    return null;
  }

  return (
    <section id="branches-new" className="bg-surface-container-low py-24">
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
          {branches.map((b, index) => (
            <div
              key={b.id}
              className={`group relative h-[400px] overflow-hidden rounded-xl ${index % 2 === 1 ? "md:mt-12" : ""}`}
            >
              <Image
                src={branchImageUrl(b.image)}
                alt={b.alt?.trim() || b.name}
                fill
                className="object-cover transition-transform duration-700 group-hover:scale-110"
                sizes="(min-width: 768px) 25vw, 100vw"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-on-surface/90 to-transparent" />
              <div className="absolute bottom-6 start-6 text-start">
                <h3 className="mb-1 text-xl font-bold text-white">{b.name}</h3>
                {b.tagline ? (
                  <p className="text-sm font-medium text-primary-container">
                    {b.tagline}
                  </p>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
