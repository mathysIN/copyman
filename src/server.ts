import "dotenv/config";
import { createServer } from "node:http";
import next from "next";
import { Server } from "socket.io";
import { getSessionWithCookieString } from "~/utils/authenticate";
import { ContentType } from "~/server/db/redis";

const dev = process.env.NODE_ENV !== "production";
const hostname = "localhost";
const port = 3000;
const app = next({ dev, hostname, port });
const handler = app.getRequestHandler();

export interface ServerToClientEvents {
  addContent: (content: ContentType) => void;
  deleteContent: (contentId: string) => void;
  updatedContent: (content: ContentType) => void;
  roomInsight: (room: RoomInsight) => void;
}

type RoomInsight = {
  connectedCount: number;
};

export interface ClientToServerEvents {
  hello: () => void;
  addContent: (content: ContentType) => void;
  deleteContent: (contentId: string) => void;
  updatedContent: (content: ContentType) => void;
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
    const sockets = rooms.get(session.sessionId);
    if (sockets) {
      sockets.add(socket.id);
      setTimeout(
        () =>
          io
            .to(socket.id)
            .emit("roomInsight", { connectedCount: sockets.size }),
        1000,
      ); // i cant make this work for some reason
      for (const id of sockets) {
        io.to(id).emit("roomInsight", { connectedCount: sockets.size });
      }
    }

    socket.on("disconnect", () => {
      const sockets = rooms.get(session.sessionId);
      if (sockets) {
        sockets.delete(socket.id);
        for (const id of sockets) {
          io.to(id).emit("roomInsight", { connectedCount: sockets.size });
        }
      }
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
      const sockets = rooms.get(session.sessionId);
      if (!sockets) return;
      for (const id of sockets) {
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
      const sockets = rooms.get(session.sessionId);
      if (!sockets) return;
      for (const id of sockets) {
        if (id === socket.id) continue;
        io.to(id).emit("deleteContent", contentId);
      }
    });

    socket.on("updatedContent", async (content) => {
      const session = await getSessionWithCookieString(
        socket.handshake.headers.cookie ?? "",
        true,
      );
      if (!session) return;
      const sockets = rooms.get(session.sessionId);
      if (!sockets) return;
      for (const id of sockets) {
        if (id === socket.id) continue;
        io.to(id).emit("updatedContent", content);
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
