import { Mail, Share2 } from "lucide-react";

export function FleetFooter() {
  return (
    <footer className="mt-auto w-full bg-[#F6F3F2] dark:bg-stone-900">
      <div className="mx-auto grid w-full max-w-screen-2xl grid-cols-1 gap-12 px-12 py-16 md:grid-cols-4">
        <div className="md:col-span-2">
          <div className="mb-6 text-xl font-bold text-primary">Rawaes</div>
          <p className="mb-8 max-w-xs leading-relaxed text-stone-500 dark:text-stone-400">
            نعيد تعريف تجربة التأجير الفاخر بعناية في الاختيار وخدمة لا تُضاهى منذ
            2024.
          </p>
          <div className="flex gap-4">
            <a
              className="editorial-shadow flex h-10 w-10 items-center justify-center rounded-full bg-white text-primary transition-transform hover:-translate-y-1 dark:bg-stone-800"
              href="#"
              aria-label="مشاركة"
            >
              <Share2 className="size-5" strokeWidth={1.75} aria-hidden />
            </a>
            <a
              className="editorial-shadow flex h-10 w-10 items-center justify-center rounded-full bg-white text-primary transition-transform hover:-translate-y-1 dark:bg-stone-800"
              href="#"
              aria-label="بريد"
            >
              <Mail className="size-5" strokeWidth={1.75} aria-hidden />
            </a>
          </div>
        </div>
        <div>
          <h4 className="mb-6 text-sm font-bold uppercase tracking-widest text-primary">
            دليل الأسطول
          </h4>
          <ul className="space-y-4">
            <li>
              <a
                className="text-stone-500 opacity-90 decoration-primary-container underline-offset-4 transition-opacity hover:opacity-100 hover:underline dark:text-stone-400"
                href="#"
              >
                مجموعة إكزوتيك
              </a>
            </li>
            <li>
              <a
                className="text-stone-500 opacity-90 decoration-primary-container underline-offset-4 transition-opacity hover:opacity-100 hover:underline dark:text-stone-400"
                href="#"
              >
                خدمة سائق
              </a>
            </li>
            <li>
              <a
                className="text-stone-500 opacity-90 decoration-primary-container underline-offset-4 transition-opacity hover:opacity-100 hover:underline dark:text-stone-400"
                href="#"
              >
                برنامج العضوية
              </a>
            </li>
            <li>
              <a
                className="text-stone-500 opacity-90 decoration-primary-container underline-offset-4 transition-opacity hover:opacity-100 hover:underline dark:text-stone-400"
                href="#"
              >
                الشروط والأحكام
              </a>
            </li>
          </ul>
        </div>
        <div>
          <h4 className="mb-6 text-sm font-bold uppercase tracking-widest text-primary">
            الدعم
          </h4>
          <ul className="space-y-4">
            <li>
              <a
                className="text-stone-500 opacity-90 decoration-primary-container underline-offset-4 transition-opacity hover:opacity-100 hover:underline dark:text-stone-400"
                href="#"
              >
                تواصل مع الدعم
              </a>
            </li>
            <li>
              <a
                className="text-stone-500 opacity-90 decoration-primary-container underline-offset-4 transition-opacity hover:opacity-100 hover:underline dark:text-stone-400"
                href="#"
              >
                سياسة الخصوصية
              </a>
            </li>
            <li>
              <a
                className="text-stone-500 opacity-90 decoration-primary-container underline-offset-4 transition-opacity hover:opacity-100 hover:underline dark:text-stone-400"
                href="#"
              >
                تأمين الأسطول
              </a>
            </li>
            <li>
              <a
                className="text-stone-500 opacity-90 decoration-primary-container underline-offset-4 transition-opacity hover:opacity-100 hover:underline dark:text-stone-400"
                href="#"
              >
                مواقعنا
              </a>
            </li>
          </ul>
        </div>
      </div>
      <div className="mx-auto max-w-screen-2xl border-t border-outline-variant/10 px-12 py-8">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-stone-400">
          © {new Date().getFullYear()} Rawaes. جميع الحقوق محفوظة.
        </p>
      </div>
    </footer>
  );
}
