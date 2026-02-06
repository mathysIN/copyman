import "dotenv/config";
import { createServer } from "node:http";
import next from "next";
import { Server, type Socket } from "socket.io";
import { getSessionWithCookieString } from "~/utils/authenticate";
import {
  type ContentOrder,
  type ContentType,
  sessions,
  deleteSession,
} from "~/server/db/redis";
import { createHashId } from "~/lib/utils";
import express from "express";
import {
  rooms,
  setIO,
  socketSendUpdateContentOrder,
  socketSendRoomInsight,
  socketSendToRoom,
} from "./lib/socketInstance";

const dev = process.env.NODE_ENV !== "production";
const hostname = "localhost";
const port = 3000;
const app = next({ dev, hostname, port });
const handler = app.getRequestHandler();

export type Room = Map<string, User>;

export type ServerToClientEvents = {
  welcome: (commonId: string) => void;
  addContent: (content: ContentType[]) => void;
  deleteContent: (contentId: string) => void;
  updatedContent: (content: ContentType) => void;
  updatedContentOrder: (content: ContentOrder) => void;
  roomInsight: (room: RoomInsight) => void;
  sessionWarning: (expiresAt: number) => void;
  sessionDeleted: () => void;
};

export type ClientToServerEvents = {
  hello: () => void;
  addContent: (content: ContentType[]) => void;
  deleteContent: (contentId: string) => void;
  updatedContent: (content: ContentType) => void;
  updatedContentOrder: (content: ContentOrder) => void;
};

export type InterServerEvents = {
  ping: () => void;
};

export type ConnectionStart = {
  sessionId: string;
  password?: string;
};

export type RoomInsight = {
  connectedCount: number;
  users: User[];
};

export type User = {
  id: string;
  commonId: string;
  userAgent: string;
};

export type CopymanSocket = Socket<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  ConnectionStart
>;

app.prepare().then(() => {
  const server = express();
  const httpServer = createServer(server);

  server.all("*", (req, res) => {
    return handler(req, res);
  });

  const io = new Server<
    ClientToServerEvents,
    ServerToClientEvents,
    InterServerEvents,
    ConnectionStart
  >(httpServer);

  setIO(io);

  io.on("connection", async (socket) => {
    const session = await getSessionWithCookieString(
      socket.handshake.headers.cookie ?? "",
      true,
    );
    if (!session) return;

    socket.join(session.sessionId);

    if (session.isExpired()) {
      socket.emit("sessionDeleted");
      socket.leave(session.sessionId);
      socket.disconnect();
      return;
    }

    if (!rooms.has(session.sessionId)) {
      rooms.set(session.sessionId, new Map());
    }
    const room = rooms.get(session.sessionId);
    if (!room) return;
    const userAgent = socket.handshake.headers["user-agent"] ?? "Anonymous";
    const socketId = socket.id;
    const ip = socket.handshake.address;
    const commandId = `${userAgent}:${ip}`;
    room.set(socket.id, {
      userAgent: userAgent,
      id: socketId,
      commonId: await createHashId(commandId),
    });

    console.log(`${socketId} hello in ${session.sessionId}!`);
    if (!room) return;

    socket.emit("welcome", socketId);

    if (session.isTemporarySession()) {
      const expiresAt = session.getExpiresAt();
      if (expiresAt && session.shouldSendWarning()) {
        socket.emit("sessionWarning", expiresAt);
      }
    }

    socket.on("hello", async () => {
      const allContent = await session.getAllContent();
      if (allContent.length > 0) {
        socket.emit("addContent", allContent);
      }

      const contentOrder = await session.getContentOrder();
      if (contentOrder.length > 0) {
        socket.emit("updatedContentOrder", contentOrder);
      }
      socketSendRoomInsight(room);
    });

    socket.on("disconnect", () => {
      console.log(`${socketId} disconnected!`);
      const room = rooms.get(session.sessionId);
      if (!room) return;
      room.delete(socket.id);
      socketSendRoomInsight(room);
    });

    socket.on("updatedContentOrder", async (contentOrder) => {
      // TODO: move this to HTTP
      const session = await getSessionWithCookieString(
        socket.handshake.headers.cookie ?? "",
        true,
      );
      if (!session) return;
      socketSendUpdateContentOrder(session, contentOrder, socket.id);
    });
  });
  httpServer.listen(port, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
  });

  async function cleanupExpiredSessions() {
    try {
      const allSessionKeys = await sessions.keys("*");
      for (const key of allSessionKeys) {
        const sessionId = key.split(":").pop();
        if (!sessionId) continue;
        const sessionData = await sessions.hgetall(sessionId);
        if (!sessionData) continue;

        const isTemp = sessionData.isTemporary === "true";
        const expiresAt = sessionData.expiresAt
          ? parseInt(sessionData.expiresAt)
          : null;
        const now = Date.now();
        const warningThreshold = 60 * 60 * 1000;

        if (isTemp && expiresAt) {
          if (now > expiresAt) {
            console.log(`Deleting expired temporary session: ${sessionId}`);
            socketSendToRoom(sessionId, "sessionDeleted", null);
            await deleteSession(sessionId);
          } else if (now >= expiresAt - warningThreshold && now < expiresAt) {
            console.log(
              `Sending warning for expiring temporary session: ${sessionId}`,
            );
            socketSendToRoom(sessionId, "sessionWarning", expiresAt);
          }
        }
      }
    } catch (error) {
      console.error("Error cleaning up expired sessions:", error);
    }
  }

  setInterval(cleanupExpiredSessions, 60 * 60 * 1000);
  cleanupExpiredSessions();
});
