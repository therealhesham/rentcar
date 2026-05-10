import { NextResponse } from "next/server";
import { getCustomerSessionUserId } from "@/lib/customer-auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const uid = await getCustomerSessionUserId();
  if (!uid) {
    return NextResponse.json({ user: null });
  }
  const user = await prisma.user.findUnique({
    where: { id: uid },
    select: { email: true, name: true },
  });
  return NextResponse.json({ user: user ?? null });
}
