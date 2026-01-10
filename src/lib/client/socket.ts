"use client";

import { io, Socket } from "socket.io-client";
import {
  ClientToServerEvents,
  ConnectionStart,
  InterServerEvents,
  ServerToClientEvents,
} from "~/server";

// Ensure a single client socket instance across HMR/reloads
const globalForClientSocket = globalThis as unknown as {
  __copyman_client_socket__?: Socket<
    ServerToClientEvents,
    ClientToServerEvents
  >;
};

export const socket: Socket<ServerToClientEvents, ClientToServerEvents> =
  globalForClientSocket.__copyman_client_socket__ ??
  (globalForClientSocket.__copyman_client_socket__ = io());
