import { DurableObject } from "cloudflare:workers";

export type GameState = {
  board: string[];
  players: string[];
  turn: number;
  winner: string | null;
};

const MAX_USERS = 2;

export class Game extends DurableObject {
  private gameState: GameState;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
  }

  async init(): Promise<void> {
    this.gameState = {
      board: Array(9).fill(""),
      players: [],
      turn: 0,
      winner: null,
    };
    await this.saveState(this.gameState);
  }

  async saveState(state) {
    await this.ctx.storage.put("state", state);
  }

  async join(): Promise<string | undefined> {
    if (this.gameState.players.length >= MAX_USERS) {
      return undefined;
    }

    const playerId = crypto.randomUUID();
    this.gameState.players.push(playerId);

    await this.saveState(this.gameState);
    this.broadcastState();

    return playerId;
  }

  getState(): GameState {
    return this.gameState;
  }

  async move(index: number, playerId: string): Promise<GameState | undefined> {
    const { board, players, turn, winner } = this.gameState;

    if (winner || board[index] || players[turn] !== playerId) {
      return undefined;
    }

    board[index] = turn === 0 ? "X" : "O";

    const result = this.checkWinner();
    if (result) {
      this.gameState.winner = result;
    } else {
      this.gameState.turn = 1 - turn;
    }

    await this.saveState(this.gameState);
    this.broadcastState();

    return this.gameState;
  }

  async reset() {
    this.gameState = {
      board: Array(9).fill(""),
      players: this.gameState.players,
      turn: this.gameState.turn,
      winner: null,
    };
    await this.saveState(this.gameState);
  }

  async fetch(req: Request): Promise<Response> {
    await this.ctx.blockConcurrencyWhile(async () => {
      const stored = await this.ctx.storage.get<GameState>("state");
      if (stored) this.gameState = stored;
    });

    if (req.headers.get("upgrade")?.toLowerCase() === "websocket") {
      return this.createWebSocket();
    }

    return new Response("Not found", { status: 404 });
  }

  // Broadcast game state to all connected clients (players)
  private broadcastState() {
    const message = JSON.stringify({ type: "state", data: this.gameState });
    for (const ws of this.ctx.getWebSockets()) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(message);
      }
    }
  }

  private createWebSocket() {
    const webSocketPair = new WebSocketPair();
    const [client, server] = Object.values(webSocketPair);

    this.ctx.acceptWebSocket(server);

    const payload = JSON.stringify({ type: "state", data: this.gameState });

    setTimeout(() => {
      this.broadcastState();
    }, 0);

    // send initial state on the client side returned to caller
    // client.send(JSON.stringify({ type: "state", data: this.gameState }));

    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  }

  async webSocketMessage(ws: WebSocket, message: string) {
    const msg = JSON.parse(message);
    if (msg.type === "state") {
      this.gameState = msg.data;
      await this.saveState(msg.data);
    } else if (msg.type === "move") {
      await this.move(msg.index, msg.playerId);
    } else if (msg.type === "reset") {
      await this.reset();
    }
  }

  async webSocketClose(
    ws: WebSocket,
    code: number,
    reason: string,
    wasClean: boolean
  ) {
    // ws.close(code, "DO is lcosing WebSocket");
  }

  checkWinner(): string | null {
    const board = this.gameState.board;
    const wins = [
      [0, 1, 2],
      [3, 4, 5],
      [6, 7, 8],
      [0, 3, 6],
      [1, 4, 7],
      [2, 5, 8],
      [0, 4, 8],
      [2, 4, 6],
    ];
    for (let [a, b, c] of wins) {
      if (board[a] && board[a] === board[b] && board[a] === board[c])
        return board[a];
    }
    return board.every((cell) => cell) ? "draw" : null;
  }
}
