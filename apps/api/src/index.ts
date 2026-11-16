import { createApp } from "./app";
import { createSecFetch, requireUserAgent } from "./sec";

let userAgent: string;
try {
  userAgent = requireUserAgent(Bun.env);
} catch (error) {
  console.error((error as Error).message);
  process.exit(1);
}

const app = createApp({ secFetch: createSecFetch({ userAgent }), now: Date.now }).listen(3000);

export type App = typeof app;

console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`
);
