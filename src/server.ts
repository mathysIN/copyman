import "dotenv/config";
import { createServer } from "node:http";
import next from "next";
import { Server } from "socket.io";
import { getSessionWithCookieString } from "~/utils/authenticate";
import { ContentOrder, ContentType } from "~/server/db/redis";
import { createHashId } from "~/lib/utils";

const dev = process.env.NODE_ENV !== "production";
const hostname = "localhost";
const port = 3000;
const app = next({ dev, hostname, port });
const handler = app.getRequestHandler();

export interface ServerToClientEvents {
  addContent: (content: ContentType) => void;
  deleteContent: (contentId: string) => void;
  updatedContent: (content: ContentType) => void;
  updatedContentOrder: (content: ContentOrder) => void;
  roomInsight: (room: RoomInsight) => void;
}

type RoomInsight = {
  connectedCount: number;
  users: User[];
};

export interface ClientToServerEvents {
  hello: () => void;
  addContent: (content: ContentType) => void;
  deleteContent: (contentId: string) => void;
  updatedContent: (content: ContentType) => void;
  updatedContentOrder: (content: ContentOrder) => void;
}

export interface InterServerEvents {
  ping: () => void;
}

export interface ConnectionStart {
  sessionId: string;
  password?: string;
}

export type User = {
  id: string;
  commonId: string;
  userAgent: string;
};

const rooms = new Map<string, Map<string, User>>();

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
      rooms.set(session.sessionId, new Map());
    }
    const sockets = rooms.get(session.sessionId);
    if (sockets) {
      const userAgent = socket.handshake.headers["user-agent"] ?? "Anonymous";
      const socketId = socket.id;
      const ip = socket.handshake.address;
      const commandId = `${userAgent}:${ip}`;
      sockets.set(socket.id, {
        userAgent: userAgent,
        id: socketId,
        commonId: await createHashId(commandId),
      });
      const users = Array.from(sockets.values());
      setTimeout(
        () =>
          io
            .to(socket.id)
            .emit("roomInsight", { connectedCount: sockets.size, users }),
        1000,
      ); // i cant make this work for some reason
      for (const keyVal of sockets) {
        const id = keyVal[0];
        io.to(id).emit("roomInsight", { connectedCount: sockets.size, users });
      }
    }

    socket.on("disconnect", () => {
      const sockets = rooms.get(session.sessionId);
      if (sockets) {
        sockets.delete(socket.id);
        const users = Array.from(sockets.values());
        for (const keyVal of sockets) {
          const id = keyVal[0];
          io.to(id).emit("roomInsight", {
            connectedCount: sockets.size,
            users,
          });
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
      for (const keyVal of sockets) {
        const id = keyVal[0];
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
      for (const keyVal of sockets) {
        const id = keyVal[0];
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
      for (const keyVal of sockets) {
        const id = keyVal[0];
        if (id === socket.id) continue;
        io.to(id).emit("updatedContent", content);
      }
    });

    socket.on("updatedContentOrder", async (contentOrder) => {
      const session = await getSessionWithCookieString(
        socket.handshake.headers.cookie ?? "",
        true,
      );
      if (!session) return;
      const sockets = rooms.get(session.sessionId);
      if (!sockets) return;

      for (const keyVal of sockets) {
        const id = keyVal[0];
        if (id === socket.id) continue;
        io.to(id).emit("updatedContentOrder", contentOrder);
      }
      session.setContentOrder(contentOrder);
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
