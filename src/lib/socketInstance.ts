import { type Server } from 'socket.io'
import { type CopymanSocket, type User } from '~/server';
import { type ContentOrder, type ContentType, type Session } from '~/server/db/redis';
import { createHashId } from './utils';

const globalForSocket = global as unknown as {
  io?: Server
  rooms?: Map<string, Map<string, User>>;
}

if (!globalForSocket.rooms) globalForSocket.rooms = new Map()

export const rooms = globalForSocket.rooms
export const io = globalForSocket.io
export const setIO = (serverIO: Server) => { globalForSocket.io = serverIO }

export function socketSendAddContent(
  session: Session,
  content: ContentType[],
  socketId?: string,
) {
  if (!globalForSocket.io) return;
  const room = rooms.get(session.sessionId);
  if (!room) return;
  console.log({ room })
  for (const keyVal of room) {
    const [id] = keyVal;
    if (socketId && id == socketId) continue;
    globalForSocket.io.to(id).emit("addContent", content);
  }
}

export function socketSendDeleteContent(
  session: Session,
  contentId: string,
  socket?: CopymanSocket,
) {
  if (!globalForSocket.io) return;
  const sockets = rooms.get(session.sessionId);
  if (!sockets) return;
  for (const keyVal of sockets) {
    const id = keyVal[0];
    globalForSocket.io.to(id).emit("deleteContent", contentId);
  }
}

export function socketSendUpdateContent(
  session: Session,
  content: ContentType,
  socket?: CopymanSocket,
) {
  if (!globalForSocket.io) return;
  const sockets = rooms.get(session.sessionId);
  if (!sockets) return;
  for (const keyVal of sockets) {
    const id = keyVal[0];
    if (id === socket?.id) continue;
    globalForSocket.io.to(id).emit("updatedContent", content);
  }
}

export function socketSendUpdateContentOrder(
  session: Session,
  contentOrder: ContentOrder,
  socket?: CopymanSocket,
) {
  if (!globalForSocket.io) return;
  const sockets = rooms.get(session.sessionId);
  if (!sockets) return;
  for (const keyVal of sockets) {
    const id = keyVal[0];
    if (id === socket?.id) continue;
    globalForSocket.io.to(id).emit("updatedContentOrder", contentOrder);
  }
  session.setContentOrder(contentOrder);
}

export function socketSendRoomInsight(
  session: Session,
  socket?: CopymanSocket,
) {
  //
  // if (!rooms.has(session.sessionId)) {
  //   rooms.set(session.sessionId, new Map());
  // }
  // const sockets = rooms.get(session.sessionId);
  // if (sockets) {
  //   const userAgent = socket.handshake.headers["user-agent"] ?? "Anonymous";
  //   const socketId = socket.id;
  //   const ip = socket.handshake.address;
  //   const commandId = `${userAgent}:${ip}`;
  //   sockets.set(socket.id, {
  //     userAgent: userAgent,
  //     id: socketId,
  //     commonId: await createHashId(commandId),
  //   });
  //   const users = Array.from(sockets.values());
  //   setTimeout(
  //     () =>
  //       io
  //         .to(socket.id)
  //         .emit("roomInsight", { connectedCount: sockets.size, users }),
  //     1000,
  //   ); // i cant make this work for some reason
  //   for (const keyVal of sockets) {
  //     const id = keyVal[0];
  //     io.to(id).emit("roomInsight", { connectedCount: sockets.size, users });
  //   }
}
