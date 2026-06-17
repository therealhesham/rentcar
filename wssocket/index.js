const { WebSocketServer } = require("ws");
const http = require("http");

const WS_PORT = process.env.PORT || 3001;
const NEXTJS_API_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

// Map<employeeId, Set<WebSocket>>
const connectedUsers = new Map();

// HTTP server handles both the WebSocket upgrade and internal POST requests
const server = http.createServer((req, res) => {
  if (req.method === "POST" && req.url === "/internal/publish") {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk.toString();
    });
    req.on("end", () => {
      try {
        const payload = JSON.parse(body);
        const { target, notification } = payload;
        
        let sentCount = 0;

        if (target.employeeIds && Array.isArray(target.employeeIds)) {
          for (const empId of target.employeeIds) {
            const sockets = connectedUsers.get(empId);
            if (sockets) {
              for (const ws of sockets) {
                if (ws.readyState === 1 /* OPEN */) {
                  ws.send(JSON.stringify(notification));
                  sentCount++;
                }
              }
            }
          }
        }

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true, sentCount }));
      } catch (err) {
        console.error("[WS] Error parsing payload", err);
        res.writeHead(400);
        res.end(JSON.stringify({ ok: false, error: "Bad request" }));
      }
    });
  } else {
    res.writeHead(404);
    res.end("Not Found");
  }
});

const wss = new WebSocketServer({ noServer: true });

server.on("upgrade", async (request, socket, head) => {
  const url = new URL(request.url, `http://${request.headers.host}`);
  const token = url.searchParams.get("token");

  if (!token) {
    socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
    socket.destroy();
    return;
  }

  try {
    // Authenticate via Next.js API
    const authRes = await fetch(`${NEXTJS_API_URL}/api/admin/ws-auth?token=${token}`);
    
    if (!authRes.ok) {
      socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
      socket.destroy();
      return;
    }

    const { employeeId, isSuperAdmin } = await authRes.json();

    const effectiveId = employeeId ?? (isSuperAdmin ? "superadmin" : null);

    if (effectiveId === null) {
      socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
      socket.destroy();
      return;
    }

    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit("connection", ws, request, effectiveId);
    });
  } catch (error) {
    console.error("[WS] Auth error", error);
    socket.write("HTTP/1.1 500 Internal Server Error\r\n\r\n");
    socket.destroy();
  }
});

wss.on("connection", (ws, request, employeeId) => {
  console.log(`[WS] Client connected. Employee ID: ${employeeId}`);

  if (!connectedUsers.has(employeeId)) {
    connectedUsers.set(employeeId, new Set());
  }
  connectedUsers.get(employeeId).add(ws);

  ws.on("close", () => {
    console.log(`[WS] Client disconnected. Employee ID: ${employeeId}`);
    const userSockets = connectedUsers.get(employeeId);
    if (userSockets) {
      userSockets.delete(ws);
      if (userSockets.size === 0) {
        connectedUsers.delete(employeeId);
      }
    }
  });
});

server.listen(WS_PORT, () => {
  console.log(`[WS] WebSocket server running on port ${WS_PORT}`);
});
