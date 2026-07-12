"use client";

import {
  CalendarDays,
  CalendarRange,
  CarFront,
  Handshake,
  Truck,
} from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";

import { useTranslations, useLocale } from "next-intl";

type ServiceItem = {
  id: string;
  icon: React.ComponentType<{ className?: string }>;
};

const ease = [0.22, 1, 0.36, 1] as const;

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.45, ease },
  },
};

const gridStagger = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.08 },
  },
};

const services: ServiceItem[] = [
  {
    id: "dailyRental",
    icon: CalendarDays,
  },
  {
    id: "weeklyRental",
    icon: CalendarRange,
  },
  {
    id: "longTermRental",
    icon: CarFront,
  },
  {
    id: "deliveryAndCollection",
    icon: Handshake,
  },
  {
    id: "supportAndAssistance",
    icon: Truck,
  },
];

export function ServicesSection() {
  const reduced = useReducedMotion();
  const t = useTranslations("Services");
  const locale = useLocale();

  const articles = services.map((service, index) => {
    const colSpanClass = index < 3 ? "xl:col-span-2" : "xl:col-span-3";
    const Icon = service.icon;
    const title = t(`items.${service.id}.title`);
    const description = t(`items.${service.id}.description`);

    const card = (
      <>
        <div className="absolute inset-x-0 top-0 h-1 origin-left scale-x-0 bg-gradient-to-r from-[#dbb878] to-[#c9a356] transition-transform duration-500 ease-out group-hover:scale-x-100" />

        <div className="mb-5 flex items-center justify-between sm:mb-8">
          <div className="relative flex size-12 items-center justify-center rounded-xl bg-[#fdfbf6] shadow-sm ring-1 ring-[#ebe4d3] transition-all duration-500 group-hover:scale-110 group-hover:shadow-md sm:size-16 sm:rounded-2xl">
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-[#dbb878]/10 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
            <Icon className="relative z-10 size-6 text-[#003749] transition-colors duration-300 group-hover:text-[#dbb878] sm:size-7" />
          </div>
          <div className="text-3xl font-black text-[#003749]/[0.03] transition-colors duration-500 group-hover:text-[#dbb878]/10 sm:text-4xl">
            0{index + 1}
          </div>
        </div>

        <div className="flex-1">
          <h3 className="mb-3 text-lg font-extrabold text-[#003749] transition-colors duration-300 group-hover:text-[#6b5a3b] sm:mb-4 sm:text-xl">
            {title}
          </h3>
          <p className="text-[14.5px] font-medium leading-[1.8] text-[#8a7752]">
            {description}
          </p>
        </div>
      </>
    );

    const baseClass = `group relative flex flex-col overflow-hidden rounded-2xl border border-[#ebe4d3]/60 bg-white/80 p-5 shadow-[0_8px_24px_-12px_rgba(15,61,71,0.08)] backdrop-blur-md transition-all duration-500 hover:-translate-y-1.5 hover:border-[#dbb878]/40 hover:bg-white hover:shadow-[0_20px_40px_-12px_rgba(219,184,120,0.15)] sm:rounded-[2rem] sm:p-8 ${colSpanClass}`;

    if (reduced) {
      return (
        <article key={service.id} className={baseClass}>
          {card}
        </article>
      );
    }

    return (
      <motion.article
        key={service.id}
        className={baseClass}
        variants={fadeUp}
      >
        {card}
      </motion.article>
    );
  });

  const header = (
    <div className="mb-10 flex flex-col items-center justify-center px-1 text-center sm:mb-16">
      <div className="mb-4 flex items-center justify-center gap-3">
        <span className="h-[1.5px] w-12 rounded-full bg-gradient-to-l from-[#dbb878] to-transparent" />
        <span className="text-[12px] font-bold uppercase tracking-[0.2em] text-[#dbb878]">
          {t("addedValue")}
        </span>
        <span className="h-[1.5px] w-12 rounded-full bg-gradient-to-r from-[#dbb878] to-transparent" />
      </div>
      <h2 className="text-2xl font-extrabold tracking-tight text-[#003749] sm:text-4xl lg:text-5xl">
        {t("title")}
      </h2>
      <p className="mt-5 max-w-2xl text-pretty text-base font-medium leading-relaxed text-[#003749]/70 sm:text-lg">
        {t("description")}
      </p>
    </div>
  );

  const inner = reduced ? (
    <div className="relative mx-auto max-w-screen-xl">
      {header}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-6 xl:gap-8">
        {articles}
      </div>
    </div>
  ) : (
    <motion.div
      className="relative mx-auto max-w-screen-xl"
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-72px 0px" }}
      variants={{
        hidden: {},
        visible: {
          transition: { staggerChildren: 0.11, delayChildren: 0.04 },
        },
      }}
    >
      <motion.div variants={fadeUp}>{header}</motion.div>

      <motion.div
        className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-6 xl:gap-8"
        variants={gridStagger}
      >
        {articles}
      </motion.div>
    </motion.div>
  );

  return (
    <section className="relative overflow-hidden bg-[#fdfbf6] px-4 py-12 sm:px-8 sm:py-28" dir={locale === 'ar' ? 'rtl' : 'ltr'}>
      <div
        className="absolute inset-0 opacity-[0.02]"
        style={{
          backgroundImage:
            "radial-gradient(circle, #003749 1.5px, transparent 1.5px)",
          backgroundSize: "24px 24px",
        }}
      />
      <div className="absolute -start-[20rem] top-0 h-[40rem] w-[40rem] rounded-full bg-gradient-to-tr from-[#dbb878]/10 to-transparent blur-3xl" />
      <div className="absolute -end-[20rem] bottom-0 h-[40rem] w-[40rem] rounded-full bg-gradient-to-bl from-[#003749]/5 to-transparent blur-3xl" />

      {inner}
    </section>
  );
}
