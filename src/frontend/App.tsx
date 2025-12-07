import { useState, useEffect, useCallback } from "react";
import GameBoard from "./GameBoard";
import type { GameState } from "../game";

export default function App() {
  const [gameId, setGameId] = useState<string | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [gameState, setGameState] = useState<any>(null);
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [isFull, setFull] = useState<boolean | null>(null);

  // Read ?game=... from URL when the component loads
  useEffect(() => {
    const url = new URL(window.location.href);
    const gameIdFromURL = url.searchParams.get("game");
    if (gameIdFromURL) {
      setGameId(gameIdFromURL);
    }
  }, []);

  // If we have a gameId but not a playerId, auto-join
  useEffect(() => {
    if (gameId && !playerId) {
      joinGame();
    }
  }, [gameId]);

  // Connect to WebSocket when gameId is available
  useEffect(() => {
    if (!gameId) return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws/${gameId}`;
    const webSocket = new WebSocket(wsUrl);

    webSocket.addEventListener("open", () => {
      console.log("WebSocket connected");
      setWs(webSocket);
    });

    webSocket.addEventListener("message", (event) => {
      const state = JSON.parse(event.data);
      setGameState(state.data ?? state);
    });

    webSocket.addEventListener("close", () => {
      console.log("WebSocket disconnected");
      setWs(null);
    });

    webSocket.addEventListener("error", (error) => {
      console.error("WebSocket error:", error);
    });

    return () => {
      webSocket.close();
    };
  }, [gameId]);

  const createGame = async () => {
    const res = await fetch("/create", { method: "POST" });
    const data: { gameId: string } = await res.json();
    setGameId(data.gameId);
    window.history.replaceState({}, "", `?game=${data.gameId}`);
  };

  const joinGame = async () => {
    if (!gameId) return;
    const res = await fetch(`/join/${gameId}`, { method: "POST" });
    if (res.status === 403) {
      setFull(true);
      return;
    }
    const data: { playerId: string } = await res.json();
    setPlayerId(data.playerId);
  };

  const makeMove = async (index: number) => {
    if (!gameId || !playerId) return;
    await fetch(`/move/${gameId}`, {
      method: "POST",
      body: JSON.stringify({ index, playerId }),
      headers: { "Content-Type": "application/json" },
    });
  };

  const resetGame = async () => {
    if (!gameId || !playerId) return;
    const res = await fetch(`/reset/${gameId}`, { method: "POST" });
    const data: { gameId: string } = await res.json();
  };

  return (
    <div style={{ textAlign: "center", paddingTop: "2rem" }}>
      <h1>Tic Tac Toe Multiplayer</h1>

      {!gameId && <button onClick={createGame}>Create new game</button>}

      {gameId && !playerId && !isFull && <p>Joining game...</p>}
      {gameId && isFull && <p>Spectating game...</p>}
      {gameId && playerId && (
        <>
          <p>
            Share this link with another player: <br />
            <a href={`?game=${gameId}`}>
              {window.location.origin}?game={gameId}
            </a>
          </p>
          <button onClick={resetGame}>Reset Game</button>
        </>
      )}

      {gameState && (
        <>
          {playerId && (
            <p>
              <b>Player:</b> {gameState.players[0] === playerId ? "X" : "O"}
            </p>
          )}
          <GameBoard
            board={gameState.board}
            onClick={makeMove}
            disabled={
              !playerId ||
              gameState.players[gameState.turn] !== playerId ||
              gameState.winner
            }
          />
          {!gameState.winner && (
            <p>Turno de: {gameState.turn === 0 ? "X" : "O"}</p>
          )}
          {gameState.winner && (
            <p>
              <b>Resultado:</b> {gameState.winner}
            </p>
          )}
        </>
      )}
    </div>
  );
}
