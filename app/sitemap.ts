import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";
import { absoluteUrl, getSiteUrl, PUBLIC_STATIC_PATHS } from "@/lib/seo";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = getSiteUrl();
  const now = new Date();

  const staticEntries: MetadataRoute.Sitemap = PUBLIC_STATIC_PATHS.map((path) => ({
    url: absoluteUrl(path),
    lastModified: now,
    changeFrequency: path === "/" ? "daily" : path === "/fleet" ? "daily" : "weekly",
    priority: path === "/" ? 1 : path === "/fleet" ? 0.9 : 0.7,
  }));

  let planEntries: MetadataRoute.Sitemap = [];
  try {
    const plans = await prisma.subscriptionPlan.findMany({
      where: { isActive: true },
      select: { slug: true, updatedAt: true },
      orderBy: { sortOrder: "asc" },
    });
    planEntries = plans.map((p) => ({
      url: `${base}/subscriptions/${encodeURIComponent(p.slug)}`,
      lastModified: p.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.6,
    }));
  } catch {
    planEntries = [];
  }

  return [...staticEntries, ...planEntries];
}
