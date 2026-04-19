import { prisma } from "@/lib/prisma";

const PLACEHOLDER_BRANCH_IMG =
  "https://images.unsplash.com/photo-1449824913935-59a10b8d2000?w=1200&q=80";

/** فروع مفعّلة ومعلّمة كجديدة لقسم الصفحة الرئيسية */
export async function getNewBranchesForHome() {
  try {
    return await prisma.branch.findMany({
      where: { isActive: true, isNew: true },
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    });
  } catch {
    // جدول Branch غير منشأ بعد أو خطأ اتصال — لا نكسر الصفحة الرئيسية
    return [];
  }
}

export function branchImageUrl(image: string | null | undefined): string {
  const u = image?.trim();
  return u || PLACEHOLDER_BRANCH_IMG;
}
