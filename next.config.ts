import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin();

function spacesImageHostname(): string | undefined {
  const raw = process.env.SPACES_PUBLIC_URL;
  if (raw) {
    try {
      return new URL(raw).hostname;
    } catch {
      /* fall through */
    }
  }
  const region = process.env.SPACES_REGION;
  const bucket = process.env.SPACES_BUCKET;
  if (region && bucket) {
    return `${bucket}.${region}.digitaloceanspaces.com`;
  }
  return undefined;
}

const spacesHost = spacesImageHostname();

const nextConfig: NextConfig = {
  /** مطلوب لبناء صورة Docker التي تنسخ `.next/standalone` */
  output: "standalone",
  /**
   * ملف توثيق نطاق Apple Pay يُقدَّم من `public/.well-known/` كنص صريح — بدون هذا
   * تُرسله Next كـ application/octet-stream فتعامله بعض أدوات التحقق كملف تنزيل.
   * ملاحظة: المسار يتخطى وسيط next-intl تلقائياً لاحتوائه على نقطة (مُطابِق middleware).
   */
  async headers() {
    return [
      {
        source: "/.well-known/apple-developer-merchantid-domain-association",
        headers: [{ key: "Content-Type", value: "text/plain; charset=utf-8" }],
      },
    ];
  },
  /** يسمح بموارد التطوير عبر أنفاق cloudflared (اختبار webhook جيديا محلياً) — لا أثر له في الإنتاج. */
  allowedDevOrigins: ["*.trycloudflare.com"],
  images: {
    dangerouslyAllowSVG: true,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
    remotePatterns: [
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
        pathname: "/**",
      },
      ...(spacesHost
        ? [
            {
              protocol: "https" as const,
              hostname: spacesHost,
              pathname: "/**",
            },
          ]
        : []),
    ],
  },
};

export default withNextIntl(nextConfig);
