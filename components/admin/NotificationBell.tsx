"use client";

import { useEffect, useState, useRef } from "react";
import { Bell, Check, Info } from "lucide-react";
import {
  getWsToken,
  getUnreadNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
} from "@/app/admin/notification-actions";

type NotificationRow = {
  id: number;
  title: string;
  message: string;
  createdAt: string;
  isRead: boolean;
};

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [token, setToken] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<{ title: string; message: string } | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  // Fetch token and initial unread list
  useEffect(() => {
    async function init() {
      const t = await getWsToken();
      if (t) setToken(t);

      const unread = await getUnreadNotifications();
      // Map raw dates to strings so it matches WS format
      const formatted = unread.map((u: any) => ({
        ...u,
        createdAt: new Date(u.createdAt).toISOString(),
      }));
      setNotifications(formatted);
      setUnreadCount(formatted.length);
    }
    init();
  }, []);

  // Connect WebSocket
  useEffect(() => {
    if (!token) return;

    let baseUrl = process.env.NEXT_PUBLIC_WS_URL;
    if (!baseUrl) {
      if (typeof window !== "undefined") {
        const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
        baseUrl = `${protocol}//${window.location.hostname}:3001`;
      } else {
        baseUrl = "ws://localhost:3001";
      }
    }
    const wsUrl = `${baseUrl}?token=${token}`;
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log("[WS] Connected to Notification Server");
    };

    ws.onmessage = async (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.event === "notification") {
          // Show toast
          setToastMsg({ title: payload.data.title, message: payload.data.message });
          setTimeout(() => setToastMsg(null), 5000);

          // Fetch the actual notifications from DB to get the real database IDs!
          const unread = await getUnreadNotifications();
          const formatted = unread.map((u: any) => ({
            ...u,
            createdAt: new Date(u.createdAt).toISOString(),
          }));
          setNotifications(formatted);
          setUnreadCount(formatted.length);
        }
      } catch (err) {
        console.error("WS parsing error:", err);
      }
    };

    ws.onclose = () => {
      console.log("[WS] Disconnected");
      // Optional: implement reconnect logic
    };

    wsRef.current = ws;

    return () => {
      ws.close();
    };
  }, [token]);

  const handleMarkAsRead = async (id: number) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    setUnreadCount((c) => Math.max(0, c - 1));
    await markNotificationAsRead(id);
  };

  const handleMarkAllRead = async () => {
    setNotifications([]);
    setUnreadCount(0);
    await markAllNotificationsAsRead();
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="relative flex size-10 items-center justify-center rounded-xl bg-surface-container-low text-on-surface-variant transition-colors hover:bg-surface-container hover:text-on-surface"
      >
        <Bell className="size-5" />
        {unreadCount > 0 && (
          <span className="absolute right-2 top-2 flex size-3 items-center justify-center rounded-full bg-error text-[8px] font-bold text-on-error">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 mt-2 w-80 z-50 overflow-hidden rounded-2xl border border-outline-variant/20 bg-white shadow-lg">
            <div className="flex items-center justify-between border-b border-outline-variant/15 bg-surface-container-low/30 px-4 py-3">
              <h3 className="font-bold text-on-surface">الإشعارات</h3>
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  className="text-xs font-semibold text-primary hover:underline"
                >
                  تحديد الكل كمقروء
                </button>
              )}
            </div>
            <div className="max-h-[60vh] overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-on-surface-variant">
                  لا توجد إشعارات حالياً.
                </div>
              ) : (
                <ul className="divide-y divide-outline-variant/10">
                  {notifications.map((n) => (
                    <li
                      key={n.id}
                      className={`px-4 py-3 transition-colors ${
                        n.isRead ? "bg-white" : "bg-primary/5"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 rounded-full bg-primary/10 p-1.5 text-primary">
                          <Info className="size-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-on-surface">{n.title}</p>
                          <p className="mt-0.5 text-xs text-on-surface-variant line-clamp-2">
                            {n.message}
                          </p>
                          <p className="mt-1 text-[10px] text-on-surface-variant/70">
                            {new Date(n.createdAt).toLocaleString("ar-SA")}
                          </p>
                        </div>
                        {!n.isRead && (
                          <button
                            onClick={() => handleMarkAsRead(n.id)}
                            className="shrink-0 p-1 text-primary hover:bg-primary/10 rounded-full"
                            title="تحديد كمقروء"
                          >
                            <Check className="size-4" />
                          </button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </>
      )}

      {toastMsg && (
        <div className="fixed bottom-4 right-4 z-50 flex items-start gap-3 rounded-xl border border-primary/20 bg-white p-4 shadow-xl animate-in slide-in-from-bottom-5">
          <div className="mt-0.5 rounded-full bg-primary/10 p-1.5 text-primary">
            <Bell className="size-5" />
          </div>
          <div>
            <p className="font-bold text-on-surface">{toastMsg.title}</p>
            <p className="text-sm text-on-surface-variant">{toastMsg.message}</p>
          </div>
        </div>
      )}
    </div>
  );
}
