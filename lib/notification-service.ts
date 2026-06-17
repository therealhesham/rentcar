import { prisma } from "@/lib/prisma";

type NotificationTarget = {
  branchId?: number | null;
};

export async function createNotification(
  target: NotificationTarget,
  title: string,
  message: string
) {
  try {
    // 1. Find eligible employee IDs (Superadmins + specific branch employees)
    const employees = await prisma.adminEmployee.findMany({
      where: {
        isActive: true,
        OR: [
          { isSuperAdmin: true },
          ...(target.branchId ? [{ branchId: target.branchId }] : []),
        ],
      },
      select: { id: true },
    });

    if (employees.length === 0) return;

    const employeeIds = employees.map((emp) => emp.id);

    // 2. Insert notifications
    const data = employeeIds.map((employeeId) => ({
      employeeId,
      title,
      message,
      isRead: false,
    }));

    await prisma.notification.createMany({ data });

    const wsTargets: (number | string)[] = [...employeeIds];
    // Always include the fallback superadmin so .env admins receive real-time updates
    if (!wsTargets.includes("superadmin")) {
      wsTargets.push("superadmin");
    }

    // 3. Send to WS server
    const wsServerUrl = process.env.NEXT_PUBLIC_WS_URL || "http://localhost:3001";
    // Convert ws:// or wss:// to http:// or https:// for HTTP POST
    const httpPublishUrl = wsServerUrl.replace(/^ws(s?):\/\//, "http$1://");

    await fetch(`${httpPublishUrl}/internal/publish`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        target: { employeeIds: wsTargets },
        notification: {
          event: "notification",
          data: {
            title,
            message,
            createdAt: new Date().toISOString(),
          },
        },
      }),
    });
  } catch (err) {
    console.error("[Notification Service] Error creating notification:", err);
  }
}
