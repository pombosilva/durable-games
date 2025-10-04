import { Game } from "./game";
import { Hono } from "hono";

export { Game };

const app = new Hono<{ Bindings: Env }>();

app.post("/create", async (c) => {
  const id = crypto.randomUUID();
  const stub = c.env.GAME.get(c.env.GAME.idFromName(id));

  // Trigger creation: forces the Durable Object to be created and initialized
  // Prevents that a client tries to create a game before the Durable Object is ready
  await stub.fetch(new Request("https://fake/init", { method: "POST" }));

  return c.json({ gameId: id });
});

// Matches /join/:id, /move/:id, /reset/:id, /state/:id
app.all("/:action{join|move|reset|state}/:id", async (c) => {
  const { action, id } = c.req.param();

  const stub = c.env.GAME.get(c.env.GAME.idFromName(id));
  const path = "/" + action;

  // Forward the original request (method/headers/body) to the DO
  const res = await stub.fetch(
    new Request(new URL(path, c.req.url), c.req.raw)
  );
  return res;
});

// Serve static assets
app.all("*", async (c) => {
  if (c.env.ASSETS && typeof c.env.ASSETS.fetch === "function") {
    return c.env.ASSETS.fetch(c.req.raw);
  }
  return c.notFound();
});

export default app;
