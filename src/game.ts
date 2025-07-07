export interface GameState {
  board: string[];
  players: string[];
  turn: number;
  winner: string | null;
}

export class Game {
  state: DurableObjectState;
  gameState: GameState;

  constructor(state: DurableObjectState) {
    this.state = state;
    this.gameState = {
      board: Array(9).fill(""),
      players: [],
      turn: 0,
      winner: null
    };
  }

  async fetch(req: Request): Promise<Response> {
    await this.state.blockConcurrencyWhile(async () => {
      const stored = await this.state.storage.get<GameState>("state");
      if (stored) this.gameState = stored;
    });

    const url = new URL(req.url);
    const pathname = url.pathname;

    if (req.method === "POST" && pathname === "/init") {
      await this.save();
      return new Response("Initialized");
    }

    if (req.method === "POST" && pathname === "/join") {
      if (this.gameState.players.length >= 2) {
        return new Response("Game full", { status: 403 });
      }
      const playerId = crypto.randomUUID();
      this.gameState.players.push(playerId);
      await this.save();
      return Response.json({ playerId });
    }

    if (req.method === "POST" && pathname === "/move") {
      const { index, playerId } = await req.json() as { index: number; playerId: string };
      const { board, players, turn, winner } = this.gameState;

      if (winner || board[index] || players[turn] !== playerId) {
        return new Response("Invalid move", { status: 400 });
      }

      board[index] = turn === 0 ? "X" : "O";

      const result = this.checkWinner();
      if (result) {
        this.gameState.winner = result;
      } else {
        this.gameState.turn = 1 - turn;
      }

      await this.save();
      return Response.json(this.gameState);
    }

    if (req.method === "POST" && pathname === "/reset") {
      this.gameState = {
        board: Array(9).fill(""),
        players: [],
        turn: 0,
        winner: null
      };
      await this.save();
      return new Response("Reset", { status: 200 });
    }

    if (req.method === "GET" && pathname === "/state") {
      return Response.json(this.gameState);
    }

    return new Response("Not found", { status: 404 });
  }

  async save() {
    await this.state.storage.put("state", this.gameState);
  }

  checkWinner(): string | null {
    const b = this.gameState.board;
    const wins = [
      [0,1,2], [3,4,5], [6,7,8],
      [0,3,6], [1,4,7], [2,5,8],
      [0,4,8], [2,4,6]
    ];
    for (let [a,b1,c] of wins) {
      if (b[a] && b[a] === b[b1] && b[a] === b[c]) return b[a];
    }
    return b.every(cell => cell) ? "draw" : null;
  }
}

export default { fetch: (req: Request, env: any, ctx: ExecutionContext) => env.GAME.fetch(req) };
