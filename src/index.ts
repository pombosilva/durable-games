import { Game } from "./game";
import { Hono } from "hono";

export { Game };

const app = new Hono<{ Bindings: Env }>();

app.post("/create", async (c) => {
  const id = crypto.randomUUID();
  const stubId = c.env.GAME.idFromName(id);
  const stub = c.env.GAME.get(stubId);

  await stub.init();
  return c.json({ gameId: id });
});

app.post("/join/:id", async (c) => {
  const id = c.req.param("id");
  const stubId = c.env.GAME.idFromName(id);
  const stub = c.env.GAME.get(stubId);

  const playerId = await stub.join();
  if (playerId === undefined) {
    return new Response("Game full", { status: 403 });
  }
  return Response.json({ playerId });
});

app.get("/state/:id", async (c) => {
  const id = c.req.param("id");
  const stubId = c.env.GAME.idFromName(id);
  const stub = c.env.GAME.get(stubId);

  const state = await stub.getState();
  return Response.json({ state });
});

app.post("/move/:id", async (c) => {
  const id = c.req.param("id");
  const stubId = c.env.GAME.idFromName(id);
  const stub = c.env.GAME.get(stubId);

  const { index, playerId } = (await c.req.json()) as {
    index: number;
    playerId: string;
  };

  const state = await stub.move(index, playerId);
  if (state === undefined) {
    return new Response("Invalid move", { status: 400 });
  }

  return Response.json(state);
});

app.post("/reset/:id", async (c) => {
  const id = c.req.param("id");
  const stubId = c.env.GAME.idFromName(id);
  const stub = c.env.GAME.get(stubId);

  await stub.reset();
  return Response.json("reset");
});

// Serve static assets
app.all("*", async (c) => {
  if (c.env.ASSETS && typeof c.env.ASSETS.fetch === "function") {
    return c.env.ASSETS.fetch(c.req.raw);
  }
  return c.notFound();
});

export default app;
