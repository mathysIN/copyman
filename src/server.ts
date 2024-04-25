import { createServer } from "node:http";
import next from "next";
import { Server } from "socket.io";
import cookie from "cookie";
import {
  getSessionWithCookieString,
  getSessionWithCookies,
} from "~/utils/authenticate";

const dev = process.env.NODE_ENV !== "production";
const hostname = "localhost";
const port = 3000;
const app = next({ dev, hostname, port });
const handler = app.getRequestHandler();

export interface ServerToClientEvents {
  noArg: () => void;
  basicEmit: (a: number, b: string, c: Buffer) => void;
  withAck: (d: string, callback: (e: number) => void) => void;
}

export interface ClientToServerEvents {
  hello: () => void;
}

export interface InterServerEvents {
  ping: () => void;
}

export interface ConnectionStart {
  sessionId: string;
  password?: string;
}

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
    console.log(session);
    socket.id;
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
