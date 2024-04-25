"use client";

import { io, Socket } from "socket.io-client";
import {
  ClientToServerEvents,
  ConnectionStart,
  InterServerEvents,
  ServerToClientEvents,
} from "~/server";

export const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io(
  "ws://localhost:3000",
);
