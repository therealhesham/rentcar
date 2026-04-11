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
      className="bg-surface-bright py-24 text-on-surface"
      aria-labelledby="fleet-categories-heading"
    >
      <div className="mx-auto max-w-7xl px-8">
        <h2
          id="fleet-categories-heading"
          className="mb-16 text-center text-3xl font-extrabold tracking-tight text-primary sm:text-4xl"
        >
          فئات أسطولنا
        </h2>

        <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((cat) => (
            <article
              key={cat.id}
              className="flex flex-col border border-outline-variant/25 bg-surface-container-lowest/80 p-6 shadow-[0_8px_30px_rgba(119,89,39,0.06)] transition-shadow hover:shadow-[0_12px_40px_rgba(119,89,39,0.1)]"
            >
              <h3 className="mb-5 text-center text-lg font-bold text-on-surface">
                {cat.title}
              </h3>
              <div className="relative mb-5 aspect-[16/11] w-full overflow-hidden rounded-xl bg-surface-container">
                <Image
                  src={cat.image}
                  alt={cat.alt?.trim() || cat.title}
                  fill
                  className="object-cover object-center"
                  sizes="(min-width: 1024px) 22vw, (min-width: 640px) 45vw, 100vw"
                />
              </div>
              <p className="mb-6 flex-1 text-start text-sm leading-relaxed text-on-surface-variant">
                {cat.description}
              </p>
              <Link
                href={`/fleet?category=${encodeURIComponent(cat.slug)}`}
                className="mt-auto text-start text-sm font-bold text-primary underline-offset-4 transition-colors hover:text-on-primary-container hover:underline"
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
