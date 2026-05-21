import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  const base = getSiteUrl();

  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/about", "/fleet", "/subscriptions"],
        disallow: [
          "/admin",
          "/account",
          "/api",
          "/fleet/checkout",
          "/fleet/payment",
        ],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
