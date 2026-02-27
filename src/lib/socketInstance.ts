import { type Server } from "socket.io";
import { type Room, type CopymanSocket, type User } from "~/server";
import {
  type ContentOrder,
  type ContentType,
  type Session,
} from "~/server/db/redis";
import { createHashId } from "./utils";

const globalForSocket = global as unknown as {
  io?: Server;
  rooms?: Map<string, Room>;
};

if (!globalForSocket.rooms) globalForSocket.rooms = new Map();

export const rooms = globalForSocket.rooms;
export const io = globalForSocket.io;
export const setIO = (serverIO: Server) => {
  globalForSocket.io = serverIO;
};

export function socketSendToRoom(sessionId: string, event: string, data: any) {
  if (!globalForSocket.io) return;
  globalForSocket.io.to(sessionId).emit(event, data);
}

export function socketSendAddContent(
  session: Session,
  content: ContentType[],
  senderSocketId?: string,
) {
  if (!globalForSocket.io) return;
  const room = rooms.get(session.sessionId);
  if (!room) return;
  for (const keyVal of room) {
    const [id] = keyVal;
    if (senderSocketId && id == senderSocketId) continue;
    globalForSocket.io.to(id).emit("addContent", content);
  }
}

export function socketSendDeleteContent(
  session: Session,
  contentId: string,
  senderSocketId?: string,
) {
  if (!globalForSocket.io) return;
  const room = rooms.get(session.sessionId);
  if (!room) return;
  for (const keyVal of room) {
    const [id] = keyVal;
    if (senderSocketId && id === senderSocketId) continue;
    globalForSocket.io.to(id).emit("deleteContent", contentId);
  }
}

export function socketSendUpdateContent(
  session: Session,
  content: ContentType,
  senderSocketId?: string,
) {
  if (!globalForSocket.io) return;
  const room = rooms.get(session.sessionId);
  if (!room) return;
  for (const keyVal of room) {
    const [id] = keyVal;
    if (senderSocketId && id === senderSocketId) continue;
    globalForSocket.io.to(id).emit("updatedContent", content);
  }
}

export function socketSendUpdateContentOrder(
  session: Session,
  contentOrder: ContentOrder,
  senderSocketId: string,
) {
  if (!globalForSocket.io) return;
  const room = rooms.get(session.sessionId);
  if (!room) return;
  for (const keyVal of room) {
    const [id] = keyVal;
    if (id === senderSocketId) continue;
    globalForSocket.io.to(id).emit("updatedContentOrder", contentOrder);
  }
  session.setContentOrder(contentOrder);
}

export function socketSendRoomInsight(room: Room) {
  if (!globalForSocket.io) return;
  const users = Array.from(room.values());
  for (const keyVal of room) {
    const [id] = keyVal;
    const insight = { connectedCount: room.size, users };
    globalForSocket.io.to(id).emit("roomInsight", insight);
  }
}

export function socketSendEncryptionState(
  sessionId: string,
  isEncrypted: boolean,
  senderSocketId?: string,
) {
  if (!globalForSocket.io) return;
  const room = rooms.get(sessionId);
  if (!room) {
    globalForSocket.io
      .to(sessionId)
      .emit("encryptionStateChanged", isEncrypted);
    return;
  }
  for (const keyVal of room) {
    const [id] = keyVal;
    if (senderSocketId && id === senderSocketId) continue;
    globalForSocket.io.to(id).emit("encryptionStateChanged", isEncrypted);
  }
}

export function socketSendPasswordChanged(
  sessionId: string,
  senderSocketId?: string,
) {
  if (!globalForSocket.io) return;
  const room = rooms.get(sessionId);
  if (!room) {
    globalForSocket.io.to(sessionId).emit("passwordChanged");
    return;
  }
  for (const keyVal of room) {
    const [id] = keyVal;
    if (senderSocketId && id === senderSocketId) continue;
    globalForSocket.io.to(id).emit("passwordChanged");
  }
}
