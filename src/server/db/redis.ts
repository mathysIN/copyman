import { Redis, RedisConfigNodejs } from "@upstash/redis";
import { UUID, randomUUID } from "crypto";
import { O } from "node_modules/@upstash/redis/zmscore-07021e27";
import { env } from "~/env";
import { ExcludeMatchingProperties } from "~/utils/types";

const globalForDb = globalThis as unknown as {
  conn: Redis | undefined;
};

const redis =
  globalForDb.conn ??
  new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  } as RedisConfigNodejs);
if (env.NODE_ENV !== "production") globalForDb.conn = redis;

type DropFirst<T extends unknown[]> = T extends [any, ...infer U] ? U : never;

class RedisWithPrefix<T extends {}> {
  prefix: string;
  client: Redis;
  constructor(redisClient: Redis, prefix: string) {
    this.client = redisClient;
    this.prefix = prefix;
  }

  async del(key: string) {
    return this.client.del(`${this.prefix}:${key}`);
  }
  async hdel(key: string, ...args: DropFirst<Parameters<typeof redis.hdel>>) {
    return this.client.hdel(`${this.prefix}:${key}`, ...args);
  }
  async hgetall(key: string) {
    return this.client.hgetall<T>(`${this.prefix}:${key}`);
  }
  async getall(pattern = "*") {
    const keys = await this.keys(pattern);
    const pipeline = this.client.pipeline();
    for (const key of keys) {
      pipeline.hgetall(key);
    }
    if (keys.length === 0) return [];
    return await pipeline.exec<T[]>();
  }

  async hmnew(key: string, value: NonNullable<T>) {
    if (!(await this.hgetall(key)))
      return this.client.hmset(`${this.prefix}:${key}`, value);
  }

  async hmset(key: string, kv: Partial<T>) {
    return this.client.hmset(`${this.prefix}:${key}`, kv);
  }
  async keys(pattern: string) {
    return this.client.keys(`${this.prefix}:${pattern}`);
  }

  async exists(...keys: string[]) {
    const _keys = keys.map((k) => `${this.prefix}:${k}`);
    return this.client.exists(..._keys);
  }
}

export function toFullRedisKey(elements: string[]) {
  return elements.join(":");
}

const REDIS_KEY_MAIN_PREFIX = "copyman";
const ENVIRONMENT = "production";

const REDIS_KEY_PREFIX = toFullRedisKey([REDIS_KEY_MAIN_PREFIX, ENVIRONMENT]);

export type SessionType = {
  sessionId: string;
  password?: string;
  createdAt: string;
};

export class Session {
  sessionId: string;
  password?: string;
  createdAt: string;
  constructor(props: SessionType) {
    this.sessionId = props.sessionId;
    this.password = props.password;
    this.createdAt = props.createdAt;
  }

  withSessionKey(...strings: string[]) {
    return withSessionKey(this, ...strings);
  }

  generatePreContent() {
    const id = randomUUID();
    return {
      key: this.withSessionKey(REDIS_CONTENT_PREFIX, id),
      preContent: {
        id,
        updatedAt: Date.now().toString(),
        sessionId: this.sessionId,
        createdAt: Date.now().toString(),
      },
    };
  }

  async createNewNote(
    note: Omit<
      NoteType,
      "id" | "createdAt" | "updatedAt" | "sessionId" | "type"
    >,
  ) {
    const { key, preContent } = this.generatePreContent();
    const newContent = {
      ...preContent,
      ...note,
      type: "note",
    } as NoteType;
    return contents
      .hmnew(key, newContent)
      .then(() => newContent)
      .catch(() => null);
  }

  async createNewAttachment(
    attachment: Omit<
      AttachmentType,
      "id" | "createdAt" | "updatedAt" | "sessionId" | "type"
    >,
  ) {
    const { key, preContent } = this.generatePreContent();
    const newContent = {
      ...preContent,
      ...attachment,
      type: "attachment",
    } as AttachmentType;
    return contents
      .hmnew(key, newContent)
      .then(() => newContent)
      .catch(() => null);
  }

  async updateNote(
    id: string,
    note: Partial<
      ExcludeMatchingProperties<NoteType, "id" | "createdAt" | "sessionId">
    >,
  ) {
    return contents.hmset(this.withSessionKey(REDIS_CONTENT_PREFIX, id), note);
  }

  async updateAttachment(
    id: string,
    attachment: Partial<
      ExcludeMatchingProperties<
        AttachmentType,
        "id" | "createdAt" | "sessionId"
      >
    >,
  ) {
    return contents.hmset(
      this.withSessionKey(REDIS_CONTENT_PREFIX, id),
      attachment,
    );
  }

  async deleteContent(id: string) {
    return contents.del(this.withSessionKey(REDIS_CONTENT_PREFIX, id));
  }

  async getContent(id: string) {
    return contents.hgetall(this.withSessionKey(REDIS_CONTENT_PREFIX, id));
  }

  async getAllContent() {
    return contents.getall(this.withSessionKey(REDIS_CONTENT_PREFIX, "*"));
  }

  toJSON(): SessionType {
    return {
      sessionId: this.sessionId,
      password: this.password,
      createdAt: this.createdAt,
    };
  }
}

const REDIS_SESSION_PREFIX = "session";
const REDIS_KEY_SESSION = toFullRedisKey([
  REDIS_KEY_PREFIX,
  REDIS_SESSION_PREFIX,
]);

export type BaseContentType = {
  id: UUID;
  createdAt: string;
  updatedAt: string;
  sessionId: string;
};

export type NoteType = BaseContentType & {
  content: string;
  type: "note";
};

export type NewNoteType = Omit<NoteType, "id" | "createdAt" | "updatedAt">;
export type NewAttachmentType = Omit<
  AttachmentType,
  "id" | "createdAt" | "updatedAt"
>;

export type AttachmentType = BaseContentType & {
  type: "attachment";
  attachmentURL: string;
  attachmentPath: string;
  fileKey: string;
};

export type ContentType = NoteType | AttachmentType;

const REDIS_CONTENT_PREFIX = "content";
const REDIS_KEY_CONTENT = toFullRedisKey([
  REDIS_KEY_PREFIX,
  REDIS_CONTENT_PREFIX,
]);

export const sessions = new RedisWithPrefix<SessionType>(
  redis,
  REDIS_KEY_SESSION,
);
export const contents = new RedisWithPrefix<ContentType>(
  redis,
  REDIS_KEY_CONTENT,
);

export function withSessionKey(session: SessionType, ...elements: string[]) {
  return toFullRedisKey([REDIS_SESSION_PREFIX, session.sessionId, ...elements]);
}
