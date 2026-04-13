import type { NextConfig } from "next";

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
  images: {
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

export default nextConfig;
