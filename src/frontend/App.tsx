import { useState, useEffect } from "react";
import GameBoard from "./GameBoard";

export default function App() {
  const [gameId, setGameId] = useState<string | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [gameState, setGameState] = useState<any>(null);

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

  // Poll for game state
  useEffect(() => {
    if (!gameId) return;
    const interval = setInterval(fetchGameState, 1000);
    return () => clearInterval(interval);
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
    const data: { playerId: string } = await res.json();
    setPlayerId(data.playerId);
  };

  const makeMove = async (index: number) => {
    if (!gameId || !playerId) return;
    await fetch(`/move/${gameId}`, {
      method: "POST",
      body: JSON.stringify({ index, playerId }),
      headers: { "Content-Type": "application/json" }
    });
    fetchGameState();
  };

  const fetchGameState = async () => {
    if (!gameId) return;
    const res = await fetch(`/state/${gameId}`);
    const data = await res.json();
    setGameState(data);
  };

  return (
    <div style={{ textAlign: "center", paddingTop: "2rem" }}>
      <h1>Tic Tac Toe Multiplayer</h1>

      {!gameId && <button onClick={createGame}>Create new game</button>}

      {gameId && !playerId && <p>Joining game...</p>}
      {gameId && playerId && (
        <>
          <p><b>Game ID:</b> {gameId}</p>
          <p><b>Player:</b> {playerId.slice(0, 5)}...</p>
          <p>
            Share this link with another player: <br />
            <a href={`?game=${gameId}`}>
              {window.location.origin}?game={gameId}
            </a>
          </p>
        </>
      )}

      {gameState && (
        <>
          <GameBoard
            board={gameState.board}
            onClick={makeMove}
            disabled={
              !playerId ||
              gameState.players[gameState.turn] !== playerId ||
              gameState.winner
            }
          />
          <p>Turno de: {gameState.turn === 0 ? "X" : "O"}</p>
          {gameState.winner && <p><b>Resultado:</b> {gameState.winner}</p>}
        </>
      )}
    </div>
  );
}
