import "dotenv/config";
import { createServer, type IncomingMessage } from "node:http";
import next from "next";
import { Server, type Socket } from "socket.io";
import {
  getSessionWithCookieString,
  getSessionWithRecord,
} from "~/utils/authenticate";
import { type ContentOrder, type ContentType, type Session } from "~/server/db/redis";
import { createHashId } from "~/lib/utils";
import { parse as parseCookie } from "cookie";
import express from "express";
import { socketSendAddContent, rooms, setIO, socketSendUpdateContentOrder, socketSendRoomInsight } from "./lib/socketInstance";

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
}

export type ClientToServerEvents = {
  hello: () => void;
  addContent: (content: ContentType[]) => void;
  deleteContent: (contentId: string) => void;
  updatedContent: (content: ContentType) => void;
  updatedContentOrder: (content: ContentOrder) => void;
}

export type InterServerEvents = {
  ping: () => void;
}

export type ConnectionStart = {
  sessionId: string;
  password?: string;
}

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

    socket.on("hello", () => {
      const room = rooms.get(session.sessionId);
      if (!room) return;
      socket.emit("welcome", socketId);
      socketSendRoomInsight(room);
    });

    socket.on("disconnect", () => {
      const room = rooms.get(session.sessionId);
      if (!room) return;
      room.delete(socket.id);
      socketSendRoomInsight(room)
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
});

