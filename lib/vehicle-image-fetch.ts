import { SPACES_MAX_IMAGE_BYTES } from "@/lib/spaces-upload";

const USER_AGENT =
  "RawaesRentCar/1.0 (fleet image seed; +https://rawaes.com)";

export type FetchedVehicleImage = {
  buffer: Buffer;
  mime: string;
  sourceUrl: string;
  provider: "pexels" | "pixabay" | "wikimedia";
};

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** أسماء ماركات شائعة بالعربية → إنجليزي لنتائج بحث أفضل */
const BRAND_EN: Record<string, string> = {
  تويوتا: "Toyota",
  هيونداي: "Hyundai",
  هوندا: "Honda",
  نيسان: "Nissan",
  كيا: "Kia",
  مرسيدس: "Mercedes-Benz",
  "مرسيدس بنز": "Mercedes-Benz",
  بيمو: "BMW",
  bmw: "BMW",
  أودي: "Audi",
  لكزس: "Lexus",
  شيفروليه: "Chevrolet",
  شيفرولت: "Chevrolet",
  فورد: "Ford",
  جيب: "Jeep",
  لاندروفر: "Land Rover",
  "لاند روفر": "Land Rover",
  بورش: "Porsche",
  فولكسفاغن: "Volkswagen",
  مازدا: "Mazda",
  مitsubishi: "Mitsubishi",
  ميتسوبيشي: "Mitsubishi",
  سوزوكي: "Suzuki",
  جينيسيس: "Genesis",
  تسلا: "Tesla",
  شانجان: "Changan",
  جيلي: "Geely",
  شيري: "Chery",
  haval: "Haval",
  هافال: "Haval",
  mg: "MG",
  امجي: "MG",
};

const MODEL_EN: Record<string, string> = {
  رايز: "Raize",
  كامري: "Camry",
  يارس: "Yaris",
  كورولا: "Corolla",
  لاندكروزر: "Land Cruiser",
  "لاند كروزر": "Land Cruiser",
  هايلكس: "Hilux",
  توسان: "Tucson",
  سوناتا: "Sonata",
  اكسنت: "Accent",
  سيفيك: "Civic",
  اكورد: "Accord",
  باترول: "Patrol",
  التيما: "Altima",
  سنترا: "Sentra",
  سبورتاج: "Sportage",
  سورينتو: "Sorento",
};

function brandForSearch(brand: string): string {
  const t = brand.trim();
  const lower = t.toLowerCase();
  if (BRAND_EN[t]) return BRAND_EN[t]!;
  if (BRAND_EN[lower]) return BRAND_EN[lower]!;
  if (/^[a-z0-9\s-]+$/i.test(t)) return t;
  return t;
}

function modelForSearch(model: string): string {
  const t = model.trim();
  if (MODEL_EN[t]) return MODEL_EN[t]!;
  if (/^[a-z0-9\s.-]+$/i.test(t)) return t;
  return t;
}

function buildSearchQueries(brand: string, model: string, year: number): string[] {
  const b = brandForSearch(brand);
  const m = modelForSearch(model);
  const uniq = new Set<string>();
  const add = (q: string) => {
    const n = q.replace(/\s+/g, " ").trim();
    if (n.length > 3) uniq.add(n);
  };
  add(`${year} ${b} ${m} car`);
  add(`${b} ${m} ${year} automobile`);
  add(`${b} ${m} car`);
  add(`${year} ${b} ${m}`);
  return [...uniq];
}

async function downloadImage(
  url: string,
  provider: FetchedVehicleImage["provider"],
): Promise<FetchedVehicleImage | null> {
  const attempts = 3;
  for (let i = 0; i < attempts; i++) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 28_000);
      const res = await fetch(url, {
        headers: { "User-Agent": USER_AGENT, Accept: "image/*" },
        redirect: "follow",
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (!res.ok) continue;

      const mime = res.headers.get("content-type")?.split(";")[0]?.trim() ?? "";
      if (!mime.startsWith("image/")) continue;
      if (!["image/jpeg", "image/png", "image/webp", "image/gif"].includes(mime)) {
        continue;
      }

      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length < 8_000 || buf.length > SPACES_MAX_IMAGE_BYTES) continue;

      return { buffer: buf, mime, sourceUrl: url, provider };
    } catch {
      if (i < attempts - 1) await sleep(800 * (i + 1));
    }
  }
  return null;
}

async function findPixabayImageUrl(query: string): Promise<string | null> {
  const key = process.env.PIXABAY_API_KEY?.trim();
  if (!key) return null;

  const url = new URL("https://pixabay.com/api/");
  url.searchParams.set("key", key);
  url.searchParams.set("q", query);
  url.searchParams.set("image_type", "photo");
  url.searchParams.set("category", "transportation");
  url.searchParams.set("per_page", "8");
  url.searchParams.set("safesearch", "true");

  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) return null;

  const data = (await res.json()) as {
    hits?: { largeImageURL?: string; webformatURL?: string }[];
  };

  for (const hit of data.hits ?? []) {
    const u = hit.largeImageURL || hit.webformatURL;
    if (u) return u;
  }
  return null;
}

async function findPexelsImageUrl(query: string): Promise<string | null> {
  const key = process.env.PEXELS_API_KEY?.trim();
  if (!key) return null;

  const url = new URL("https://api.pexels.com/v1/search");
  url.searchParams.set("query", query);
  url.searchParams.set("per_page", "5");
  url.searchParams.set("orientation", "landscape");

  const res = await fetch(url, {
    headers: { Authorization: key, "User-Agent": USER_AGENT },
  });
  if (!res.ok) return null;

  const data = (await res.json()) as {
    photos?: { src?: { large2x?: string; large?: string } }[];
  };

  for (const photo of data.photos ?? []) {
    const u = photo.src?.large2x || photo.src?.large;
    if (u) return u;
  }
  return null;
}

async function findWikimediaImageUrl(query: string): Promise<string | null> {
  const params = new URLSearchParams({
    action: "query",
    format: "json",
    origin: "*",
    generator: "search",
    gsrsearch: query,
    gsrlimit: "12",
    gsrnamespace: "6",
    prop: "imageinfo",
    iiprop: "url|mime|size|thumburl",
    iiurlwidth: "1280",
  });

  const res = await fetch(`https://commons.wikimedia.org/w/api.php?${params}`, {
    headers: { "User-Agent": USER_AGENT },
  });
  if (!res.ok) return null;

  const data = (await res.json()) as {
    query?: {
      pages?: Record<
        string,
        { imageinfo?: { url?: string; mime?: string; size?: number }[] }
      >;
    };
  };

  const pages = data.query?.pages;
  if (!pages) return null;

  type WikiCandidate = { url: string; score: number };
  const candidates: WikiCandidate[] = [];

  for (const page of Object.values(pages)) {
    const info = page.imageinfo?.[0] as
      | { url?: string; thumburl?: string; mime?: string; size?: number }
      | undefined;
    if (!info) continue;
    const mime = info.mime ?? "";
    if (!mime.startsWith("image/")) continue;
    if (mime === "image/svg+xml") continue;

    const fullSize = info.size ?? 0;
    const url =
      fullSize <= SPACES_MAX_IMAGE_BYTES && info.url
        ? info.url
        : info.thumburl || (fullSize <= SPACES_MAX_IMAGE_BYTES ? info.url : null);
    if (!url) continue;

    const title = (page as { title?: string }).title?.toLowerCase() ?? "";
    let score = 10;
    if (title.includes("front")) score += 8;
    if (title.includes("rear") || title.includes("back")) score -= 3;
    if (query.toLowerCase().split(/\s+/).some((w) => w.length > 2 && title.includes(w))) {
      score += 6;
    }

    candidates.push({ url, score });
  }

  candidates.sort((a, b) => b.score - a.score);
  return candidates[0]?.url ?? null;
}

async function tryFetchFromQuery(query: string): Promise<FetchedVehicleImage | null> {
  const providers: {
    find: (q: string) => Promise<string | null>;
    name: FetchedVehicleImage["provider"];
  }[] = [
    { find: findPexelsImageUrl, name: "pexels" },
    { find: findPixabayImageUrl, name: "pixabay" },
    { find: findWikimediaImageUrl, name: "wikimedia" },
  ];

  for (const { find, name } of providers) {
    const imageUrl = await find(query);
    if (!imageUrl) continue;
    await sleep(300);
    const img = await downloadImage(imageUrl, name);
    if (img) return img;
  }

  return null;
}

/**
 * يبحث عن صورة سيارة (Pexels إن وُجد المفتاح، ثم Wikimedia Commons).
 */
export async function fetchVehicleImageFromWeb(
  brand: string,
  model: string,
  year: number,
): Promise<FetchedVehicleImage | null> {
  const queries = buildSearchQueries(brand, model, year);

  for (const query of queries) {
    const result = await tryFetchFromQuery(query);
    if (result) return result;
    await sleep(250);
  }

  return null;
}

export function vehicleImageFileBaseName(
  brand: string,
  model: string,
  year: number,
): string {
  const slug = (s: string) =>
    s
      .trim()
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "car";

  return `${slug(brand)}-${slug(model)}-${year}`;
}
