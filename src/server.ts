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
import { socketSendAddContent, rooms, setIO, socketSendUpdateContentOrder } from "./lib/socketInstance";

const dev = process.env.NODE_ENV !== "production";
const hostname = "localhost";
const port = 3000;
const app = next({ dev, hostname, port });
const handler = app.getRequestHandler();

export interface ServerToClientEvents {
  addContent: (content: ContentType[]) => void;
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
  addContent: (content: ContentType[]) => void;
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

export type CopymanSocket = Socket<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  ConnectionStart
>;

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => (data += chunk));
    req.on("end", () => resolve(data));
    req.on("error", (err) => reject(err));
  });
}

export async function createCustomRequest(req: IncomingMessage) {
  const bodyText = await readBody(req);
  return {
    method: req.method,
    url: req.url,
    headers: req.headers,
    json: async () => JSON.parse(bodyText),
    text: async () => bodyText,
    cookies: parseCookie(req.headers.cookie || ""),
  };
}

app.prepare().then(() => {
  const server = express();
  const httpServer = createServer(server);

  server.get("/api/notes", async (req, res) => {
    console.log("ayo");
    const data = await req.body;
    const cookies = req.cookies;

    const session = await getSessionWithRecord(cookies);
    if (!session) {
      res.writeHead(401, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ message: "Unauthorized" }));
      return;
    }
    const { content } = data;
    const newNote = { content };
    const response = await session.createNewNote(newNote).catch(() => { });

    if (response) {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(response));
    } else {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ message: "Failed to create" }));
    }
    return;
  });

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

    socket.on("deleteContent", async (contentId) => {
      // const session = await getSessionWithCookieString(
      //   socket.handshake.headers.cookie ?? "",
      //   true,
      // );
      // if (!session) return;
      // const sockets = rooms.get(session.sessionId);
      // if (!sockets) return;
      // for (const keyVal of sockets) {
      //   const id = keyVal[0];
      //   if (id === socket.id) continue;
      //   io.to(id).emit("deleteContent", contentId);
      // }
    });

    socket.on("updatedContent", async (content) => {
      // const session = await getSessionWithCookieString(
      //   socket.handshake.headers.cookie ?? "",
      //   true,
      // );
      // if (!session) return;
      // const sockets = rooms.get(session.sessionId);
      // if (!sockets) return;
      // for (const keyVal of sockets) {
      //   const id = keyVal[0];
      //   if (id === socket.id) continue;
      //   io.to(id).emit("updatedContent", content);
      // }
    });

    socket.on("updatedContentOrder", async (contentOrder) => {
      const session = await getSessionWithCookieString(
        socket.handshake.headers.cookie ?? "",
        true,
      );
      if (!session) return;
      socketSendUpdateContentOrder(session, contentOrder);
    });
  });
  httpServer.listen(port, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
  });
});

