import { DurableObject } from "cloudflare:workers";

export type GameState = {
  board: string[];
  players: string[];
  turn: number;
  winner: string | null;
};

const MAX_USERS = 2;

export class Game extends DurableObject {
  gameState: GameState;

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
    await this.save();
  }

  async save() {
    await this.ctx.storage.put("state", this.gameState);
  }

  async join(): Promise<string | undefined> {
    if (this.gameState.players.length >= MAX_USERS) {
      return undefined;
    }
    const playerId = crypto.randomUUID();
    this.gameState.players.push(playerId);
    await this.save();
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

    await this.save();
    return this.gameState;
  }

  async reset() {
    this.gameState = {
      board: Array(9).fill(""),
      players: this.gameState.players,
      turn: this.gameState.turn,
      winner: null,
    };
    await this.save();
  }

  async fetch(req: Request): Promise<Response> {
    await this.ctx.blockConcurrencyWhile(async () => {
      const stored = await this.ctx.storage.get<GameState>("state");
      if (stored) this.gameState = stored;
    });

    const url = new URL(req.url);
    const pathname = url.pathname;

    if (req.method === "POST" && pathname === "/reset") {
      this.gameState = {
        board: Array(9).fill(""),
        players: [],
        turn: 0,
        winner: null,
      };
      await this.save();
      return new Response("Reset", { status: 200 });
    }

    return new Response("Not found", { status: 404 });
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
