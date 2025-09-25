import { NextResponse, type NextRequest } from "next/server";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { env } from "~/env";

const globalForRatelimit = globalThis as unknown as {
  ratelimit?: Ratelimit;
};

const redis = new Redis({
  url: env.UPSTASH_REDIS_REST_URL,
  token: env.UPSTASH_REDIS_REST_TOKEN,
});

const ratelimit =
  globalForRatelimit.ratelimit ??
  new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(90, "60 s"),
    analytics: true,
    prefix: "copyman:middleware",
  });

if (process.env.NODE_ENV !== "production") {
  globalForRatelimit.ratelimit = ratelimit;
}

export async function middleware(request: NextRequest) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  const ip = forwardedFor?.split(",")[0]?.trim() || request.ip || "127.0.0.1";

  const { success, limit, remaining, reset } = await ratelimit.limit(ip);

  console.log(success, limit, remaining, reset);
  const response = success
    ? NextResponse.next()
    : new NextResponse("Too Many Requests", { status: 429 });

  response.headers.set("X-RateLimit-Limit", limit.toString());
  response.headers.set(
    "X-RateLimit-Remaining",
    Math.max(0, remaining).toString(),
  );
  response.headers.set("X-RateLimit-Reset", reset.toString());

  return response;
}

export const config = {
  matcher: ["/api/:path*", "/content/:path*"],
};
