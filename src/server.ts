import { createServer } from "node:http";
import next from "next";
import { Server } from "socket.io";
import cookie from "cookie";
import {
  getSessionWithCookieString,
  getSessionWithCookies,
} from "~/utils/authenticate";
import { ContentType } from "~/server/db/redis";
import { Roboto_Mono } from "next/font/google";
import "dotenv/config";

const dev = process.env.NODE_ENV !== "production";
const hostname = "localhost";
const port = 3000;
const app = next({ dev, hostname, port });
const handler = app.getRequestHandler();

export interface ServerToClientEvents {
  addContent: (content: ContentType) => void;
  deleteContent: (contentId: string) => void;
}

export interface ClientToServerEvents {
  hello: () => void;
  addContent: (content: ContentType) => void;
  deleteContent: (contentId: string) => void;
}

export interface InterServerEvents {
  ping: () => void;
}

export interface ConnectionStart {
  sessionId: string;
  password?: string;
}

const rooms = new Map<string, Set<string>>();

app.prepare().then(() => {
  const httpServer = createServer(handler);

  const io = new Server<
    ClientToServerEvents,
    ServerToClientEvents,
    InterServerEvents,
    ConnectionStart
  >(httpServer);

  io.on("connection", async (socket) => {
    const session = await getSessionWithCookieString(
      socket.handshake.headers.cookie ?? "",
      true,
    );
    if (!session) return;
    if (!rooms.has(session.sessionId)) {
      rooms.set(session.sessionId, new Set());
    }
    rooms.get(session.sessionId)?.add(socket.id);

    socket.on("disconnect", () => {
      rooms.get(session.sessionId)?.delete(socket.id);
      for (const room of rooms) {
        room[1]?.delete(socket.id);
      }
    });

    socket.on("addContent", async (content) => {
      const session = await getSessionWithCookieString(
        socket.handshake.headers.cookie ?? "",
        true,
      );
      if (!session) return;
      const room = rooms.get(session.sessionId);
      if (!room) return;
      for (const id of room) {
        if (id === socket.id) continue;
        io.to(id).emit("addContent", content);
      }
    });

    socket.on("deleteContent", async (contentId) => {
      const session = await getSessionWithCookieString(
        socket.handshake.headers.cookie ?? "",
        true,
      );
      if (!session) return;
      const room = rooms.get(session.sessionId);
      if (!room) return;
      for (const id of room) {
        if (id === socket.id) continue;
        io.to(id).emit("deleteContent", contentId);
      }
    });
  });

  httpServer
    .once("error", (err) => {
      console.error(err);
      process.exit(1);
    })
    .listen(port, () => {
      console.log(`> Ready on http://${hostname}:${port}`);
    });
});
