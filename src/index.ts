import { Game } from './game';

export { Game };

export default {
  async fetch(req: Request, env: any) {
    try{
    const url = new URL(req.url);
    const pathname = url.pathname;

    if (req.method === "POST" && pathname === "/create") {
      const id = crypto.randomUUID();
      const stub = env.GAME.get(env.GAME.idFromName(id));

      // Trigger creation: forces the Durable Object to be created and initialized
      // Prevents that a client tries to create a game before the Durable Object is ready
      await stub.fetch(new Request("https://fake/init", { method: "POST" }));

      return Response.json({ gameId: id });
    }

    const match = pathname.match(/^\/(join|move|reset|state)\/([\w-]+)$/);
    if (match) {
      const [_, action, id] = match;
      const stub = env.GAME.get(env.GAME.idFromName(id));
      const path = "/" + action;
      return stub.fetch(new Request(new URL(path, req.url), req));
    }

    if (env.ASSETS && typeof env.ASSETS.fetch === "function") {
      return env.ASSETS.fetch(req);
    }

    return new Response("Not found", { status: 404 });

    } catch (err) {
      return new Response("Internal Server Error", { status: 500 });
    }
  }
};
