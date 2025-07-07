type Props = {
  board: string[];
  onClick: (index: number) => void;
  disabled: boolean;
};

export default function GameBoard({ board, onClick, disabled }: Props) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 100px)", gap: "5px", justifyContent: "center", margin: "2rem auto" }}>
      {board.map((cell, i) => (
        <button
          key={i}
          onClick={() => onClick(i)}
          disabled={cell !== "" || disabled}
          style={{ width: 100, height: 100, fontSize: "2rem" }}
        >
          {cell}
        </button>
      ))}
    </div>
  );
}
