# Containerized WebSocket Notification Server

This folder contains the standalone, dockerized real-time WebSocket server used to handle and push live notifications.

## Build and Run with Docker

### 1. Build the Docker Image

Navigate to the `wssocket` folder and build the image:
```bash
docker build -t rawaes-ws-server .
```

### 2. Run the Container

Run the container, binding port `3001` (or your preferred port) and passing the Next.js app URL:

```bash
docker run -d \
  -p 3001:3001 \
  -e PORT=3001 \
  -e NEXT_PUBLIC_APP_URL=http://your-nextjs-app-url:3000 \
  --name rawaes-notifications \
  rawaes-ws-server
```

*Replace `http://your-nextjs-app-url:3000` with the actual internal URL of your Next.js application (which the WebSocket container can reach).*

## Environment Variables

| Variable | Default | Description |
| :--- | :--- | :--- |
| `PORT` | `3001` | The port the WebSocket server will listen on inside the container. |
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` | The Next.js API server base URL used to authorize incoming client connections. |
