"use server";

import { requireAdminPage } from "@/lib/admin-page";
import { getAdminSession, createAdminSessionToken } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function getUnreadNotifications() {
  const session = await requireAdminPage();

  const notifications = await prisma.notification.findMany({
    where: {
      isRead: false,
      ...(session.employeeId
        ? { employeeId: session.employeeId }
        : { employee: { isSuperAdmin: true } }),
    },
    orderBy: { createdAt: "desc" },
    take: 50, // limit to 50 for MVP
  });

  return notifications;
}

export async function getAllNotifications() {
  const session = await requireAdminPage();

  const notifications = await prisma.notification.findMany({
    where: {
      ...(session.employeeId
        ? { employeeId: session.employeeId }
        : { employee: { isSuperAdmin: true } }),
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return notifications;
}

export async function markNotificationAsRead(id: number) {
  const session = await requireAdminPage();

  await prisma.notification.updateMany({
    where: {
      id,
      ...(session.employeeId
        ? { employeeId: session.employeeId }
        : { employee: { isSuperAdmin: true } }),
    },
    data: {
      isRead: true,
    },
  });

  // Not revalidating whole admin path here, frontend will handle local state to be snappy
  return { ok: true };
}

export async function markAllNotificationsAsRead() {
  const session = await requireAdminPage();

  await prisma.notification.updateMany({
    where: {
      isRead: false,
      ...(session.employeeId
        ? { employeeId: session.employeeId }
        : { employee: { isSuperAdmin: true } }),
    },
    data: {
      isRead: true,
    },
  });

  return { ok: true };
}

export async function getWsToken() {
  const session = await getAdminSession();
  if (!session) return null;
  return createAdminSessionToken(session);
}
