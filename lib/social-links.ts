export type SocialPlatformKey =
  | "instagram"
  | "tiktok"
  | "snapchat"
  | "whatsapp"
  | "twitter"
  | "facebook"
  | "youtube"
  | "linkedin";

export type SocialLinkItem = {
  platform: SocialPlatformKey;
  url: string;
  label: string;
  enabled: boolean;
};

export const SOCIAL_PLATFORM_LABELS: Record<SocialPlatformKey, string> = {
  instagram: "انستقرام",
  tiktok: "تيك توك",
  snapchat: "سناب شات",
  whatsapp: "واتساب",
  twitter: "إكس (تويتر)",
  facebook: "فيسبوك",
  youtube: "يوتيوب",
  linkedin: "لينكد إن",
};

export const DEFAULT_SOCIAL_LINKS: SocialLinkItem[] = [
  {
    platform: "instagram",
    url: "https://www.instagram.com/rentrawaes",
    label: "انستقرام — @rentrawaes",
    enabled: true,
  },
  {
    platform: "tiktok",
    url: "https://www.tiktok.com/@rentrawaes",
    label: "تيك توك — @rentrawaes",
    enabled: true,
  },
  {
    platform: "snapchat",
    url: "",
    label: "سناب شات",
    enabled: false,
  },
  {
    platform: "whatsapp",
    url: "",
    label: "واتساب",
    enabled: false,
  },
  {
    platform: "twitter",
    url: "",
    label: "إكس (تويتر)",
    enabled: false,
  },
  {
    platform: "youtube",
    url: "",
    label: "يوتيوب",
    enabled: false,
  },
  {
    platform: "facebook",
    url: "",
    label: "فيسبوك",
    enabled: false,
  },
  {
    platform: "linkedin",
    url: "",
    label: "لينكد إن",
    enabled: false,
  },
];

export function parseSocialLinksJson(rawJson: string | null | undefined): SocialLinkItem[] {
  if (!rawJson?.trim()) {
    return DEFAULT_SOCIAL_LINKS;
  }
  try {
    const parsed = JSON.parse(rawJson);
    if (!Array.isArray(parsed)) return DEFAULT_SOCIAL_LINKS;

    const parsedMap = new Map<string, any>();
    for (const item of parsed) {
      if (item && typeof item === "object" && typeof item.platform === "string") {
        parsedMap.set(item.platform, item);
      }
    }

    return DEFAULT_SOCIAL_LINKS.map((def) => {
      const found = parsedMap.get(def.platform);
      if (!found) return def;
      return {
        platform: def.platform,
        url: typeof found.url === "string" ? found.url.trim() : def.url,
        label: typeof found.label === "string" && found.label.trim() ? found.label.trim() : def.label,
        enabled: typeof found.enabled === "boolean" ? found.enabled : Boolean(found.url?.trim()),
      };
    });
  } catch {
    return DEFAULT_SOCIAL_LINKS;
  }
}
