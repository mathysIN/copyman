import { Redis, RedisConfigNodejs } from "@upstash/redis";
import { UUID, randomUUID } from "crypto";
import { RequestCookies } from "next/dist/compiled/@edge-runtime/cookies";
import { ReadonlyRequestCookies } from "next/dist/server/web/spec-extension/adapters/request-cookies";
import { env } from "~/env";
import { hashPassword, validatePassword } from "~/utils/password";
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
    const exist = await this.hgetall(key);
    if (!exist) {
      return this.client.hmset(`${this.prefix}:${key}`, value);
    }
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
  backgroundImageURL?: string;
  createdAt: string;
  rawContentOrder?: string;
};

export class Session {
  sessionId: string;
  password?: string;
  createdAt: string;
  rawContentOrder?: string;
  imageBackground?: URL;
  constructor(props: SessionType) {
    this.sessionId = props.sessionId;
    this.password = props.password;
    this.createdAt = props.createdAt;
    this.rawContentOrder = props.rawContentOrder;
    try {
      this.imageBackground = new URL(props.backgroundImageURL ?? "");
    } catch {}
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
    } satisfies NoteType;
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
    } satisfies AttachmentType;
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
    return (
      await contents.getall(this.withSessionKey(REDIS_CONTENT_PREFIX, "*"))
    ).sort((a, b) => {
      return parseInt(b.createdAt) - parseInt(a.createdAt);
    });
  }

  private isValidUUID(str: string) {
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(str);
  }

  private rawContentOrderToUUIDArray(rawContentOrder: string): ContentOrder {
    const orderContent = rawContentOrder.split(";");
    for (const content of orderContent) {
      if (!this.isValidUUID(content)) {
        return [];
      }
    }
    return orderContent as ContentOrder;
  }

  private contentOrderToRaw(contentOrder: ContentOrder): string {
    return contentOrder.join(";");
  }

  async getContentOrder() {
    return this.rawContentOrder
      ? this.rawContentOrderToUUIDArray(this.rawContentOrder)
      : [];
  }

  async setContentOrder(contentOrder: ContentOrder) {
    return sessions.hmset(this.sessionId, {
      rawContentOrder: this.contentOrderToRaw(contentOrder),
    });
  }

  async setPassword(password?: string) {
    if (!password) return sessions.hdel(this.sessionId, "password");

    return sessions.hmset(this.sessionId, {
      password: hashPassword(password),
    });
  }

  async verifyPassword(password?: string) {
    if (!this.password) {
      if (!password) return true;
      else return false;
    } else {
      if (!password) return false;
      return validatePassword(password, this.password);
    }
  }

  hasPassword() {
    return !!this.password;
  }

  async verifyPasswordFromCookie(
    cookie: RequestCookies | ReadonlyRequestCookies,
  ) {
    return this.verifyPassword(cookie.get("password")?.value);
  }

  async setBackgroundImageURL(backgroundImageURL?: string) {
    if (!backgroundImageURL)
      return sessions.hdel(this.sessionId, "backgroundImageURL");

    return sessions.hmset(this.sessionId, {
      backgroundImageURL: backgroundImageURL,
    });
  }

  toJSON(): SessionType {
    return {
      sessionId: this.sessionId,
      createdAt: this.createdAt,
      rawContentOrder: this.rawContentOrder,
      backgroundImageURL: this.imageBackground?.href,
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

const REDIS_CONTENT_PREFIX = "content";
const REDIS_KEY_CONTENT = toFullRedisKey([
  REDIS_KEY_PREFIX,
  REDIS_CONTENT_PREFIX,
]);

export type NewAttachmentType = Omit<
  AttachmentType,
  "id" | "createdAt" | "updatedAt"
>;

export type NoteType = BaseContentType & {
  type: "note";
  content: string;
};

export type AttachmentType = BaseContentType & {
  type: "attachment";
  attachmentURL: string;
  attachmentPath: string;
  fileKey: string;
};

export type ContentType = NoteType | AttachmentType;

export type ContentOrder = UUID[];

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
