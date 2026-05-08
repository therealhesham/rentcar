import Image from "next/image";
import Link from "next/link";
import { getFleetCategoriesForHome } from "@/lib/fleet-category-data";

export async function FleetCategories() {
  const categories = await getFleetCategoriesForHome().catch(() => []);

  if (categories.length === 0) {
    return null;
  }

  return (
    <section
      id="fleet-categories"
      className="bg-surface-bright py-20 text-on-surface sm:py-24"
      aria-labelledby="fleet-categories-heading"
    >
      <div className="mx-auto max-w-screen-xl px-4 sm:px-8">
        <h2
          id="fleet-categories-heading"
          className="mb-14 text-center text-3xl font-extrabold tracking-tight text-[#dbb878] sm:text-4xl"
        >
          فئات أسطولنا
        </h2>

        <div className="grid grid-cols-1 gap-x-10 gap-y-12 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {categories.map((cat, index) => (
            <article
              key={cat.id}
              className={`flex flex-col ${index === 4 ? "xl:col-start-4" : ""}`}
            >
              <h3 className="mb-2 text-center text-2xl font-extrabold text-[#003749]">
                {cat.title}
              </h3>
              <div className="relative mx-auto mb-4 aspect-[16/9] w-full max-w-[280px]">
                <Image
                  src={cat.image}
                  alt={cat.alt?.trim() || cat.title}
                  fill
                  className="object-contain object-center"
                  sizes="(min-width: 1280px) 200px, (min-width: 1024px) 22vw, (min-width: 640px) 45vw, 85vw"
                />
              </div>
              <p className="mb-4 flex-1 text-sm leading-7 text-on-surface-variant">
                {cat.description}
              </p>
              <Link
                href={`/fleet?category=${encodeURIComponent(cat.slug)}`}
                className="mt-auto text-sm font-semibold text-on-surface/80 underline-offset-4 transition-colors hover:text-primary hover:underline"
              >
                اكتشف المزيد
              </Link>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
