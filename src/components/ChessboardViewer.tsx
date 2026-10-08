import React, { useEffect, useMemo, useState } from 'react';
import {
  ChevronFirst,
  ChevronLast,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
} from 'lucide-react';

type PieceType = 'P' | 'N' | 'B' | 'R' | 'Q' | 'K';
type PieceColor = 'w' | 'b';

interface Piece {
  type: PieceType;
  color: PieceColor;
}

type BoardState = (Piece | null)[][];

function createInitialBoard(): BoardState {
  const board: BoardState = Array.from({ length: 8 }, () => Array(8).fill(null));
  const backRank: PieceType[] = ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R'];

  for (let c = 0; c < 8; c++) {
    board[0][c] = { type: backRank[c], color: 'b' };
    board[1][c] = { type: 'P', color: 'b' };
    board[6][c] = { type: 'P', color: 'w' };
    board[7][c] = { type: backRank[c], color: 'w' };
  }
  return board;
}

function cloneBoard(board: BoardState): BoardState {
  return board.map((row) => row.map((cell) => (cell ? { ...cell } : null)));
}

function fileToCol(file: string): number {
  return file.charCodeAt(0) - 'a'.charCodeAt(0);
}

function rankToRow(rank: string): number {
  return 8 - parseInt(rank, 10);
}

function canPieceReach(
  board: BoardState,
  fromR: number,
  fromC: number,
  toR: number,
  toC: number,
  piece: Piece,
  isCapture: boolean
): boolean {
  const dr = toR - fromR;
  const dc = toC - fromC;
  const absR = Math.abs(dr);
  const absC = Math.abs(dc);

  switch (piece.type) {
    case 'P': {
      const dir = piece.color === 'w' ? -1 : 1;
      const startRow = piece.color === 'w' ? 6 : 1;
      if (isCapture) {
        return dr === dir && absC === 1;
      }
      if (dc !== 0) return false;
      if (dr === dir && !board[toR][toC]) return true;
      if (fromR === startRow && dr === 2 * dir && !board[fromR + dir][fromC] && !board[toR][toC]) {
        return true;
      }
      return false;
    }
    case 'N':
      return (absR === 2 && absC === 1) || (absR === 1 && absC === 2);
    case 'K':
      return absR <= 1 && absC <= 1;
    case 'B':
      if (absR !== absC || absR === 0) return false;
      return isPathClear(board, fromR, fromC, toR, toC);
    case 'R':
      if (dr !== 0 && dc !== 0) return false;
      return isPathClear(board, fromR, fromC, toR, toC);
    case 'Q':
      if (dr !== 0 && dc !== 0 && absR !== absC) return false;
      return isPathClear(board, fromR, fromC, toR, toC);
  }
}

function isPathClear(
  board: BoardState,
  fromR: number,
  fromC: number,
  toR: number,
  toC: number
): boolean {
  const stepR = Math.sign(toR - fromR);
  const stepC = Math.sign(toC - fromC);
  let r = fromR + stepR;
  let c = fromC + stepC;
  while (r !== toR || c !== toC) {
    if (board[r][c] !== null) return false;
    r += stepR;
    c += stepC;
  }
  return true;
}

function applySanMove(board: BoardState, sanRaw: string, turn: PieceColor): BoardState {
  const next = cloneBoard(board);
  const san = sanRaw.replace(/[+#!?]+$/g, '').trim();

  if (san === 'O-O' || san === '0-0') {
    const r = turn === 'w' ? 7 : 0;
    next[r][6] = next[r][4];
    next[r][5] = next[r][7];
    next[r][4] = null;
    next[r][7] = null;
    return next;
  }

  if (san === 'O-O-O' || san === '0-0-0') {
    const r = turn === 'w' ? 7 : 0;
    next[r][2] = next[r][4];
    next[r][3] = next[r][0];
    next[r][4] = null;
    next[r][0] = null;
    return next;
  }

  let promoType: PieceType | null = null;
  let clean = san;
  const promoMatch = clean.match(/=([QRBN])$/);
  if (promoMatch) {
    promoType = promoMatch[1] as PieceType;
    clean = clean.slice(0, -2);
  }

  const destMatch = clean.match(/([a-h][1-8])$/);
  if (!destMatch) return next;

  const toC = fileToCol(destMatch[1][0]);
  const toR = rankToRow(destMatch[1][1]);
  const prefix = clean.slice(0, -2);
  const isCapture = prefix.includes('x');
  const cleanPrefix = prefix.replace('x', '');

  let pieceType: PieceType = 'P';
  let disambig = cleanPrefix;

  if (/^[KQRBN]/.test(cleanPrefix)) {
    pieceType = cleanPrefix[0] as PieceType;
    disambig = cleanPrefix.slice(1);
  }

  let disambigCol: number | null = null;
  let disambigRow: number | null = null;

  for (const ch of disambig) {
    if (ch >= 'a' && ch <= 'h') disambigCol = fileToCol(ch);
    if (ch >= '1' && ch <= '8') disambigRow = rankToRow(ch);
  }

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = next[r][c];
      if (!p || p.color !== turn || p.type !== pieceType) continue;
      if (disambigCol !== null && c !== disambigCol) continue;
      if (disambigRow !== null && r !== disambigRow) continue;

      if (canPieceReach(next, r, c, toR, toC, p, isCapture)) {
        // Handle en-passant capture if pawn moves diagonally to empty square
        if (pieceType === 'P' && isCapture && !next[toR][toC]) {
          next[r][toC] = null;
        }
        next[toR][toC] = {
          type: promoType || pieceType,
          color: turn,
        };
        next[r][c] = null;
        return next;
      }
    }
  }

  return next;
}

export function extractPgnMoves(pgn: string): string[] {
  if (!pgn.trim()) return [];
  const withoutHeaders = pgn
    .replace(/\[.*?\]/g, ' ')
    .replace(/\{.*?\}/g, ' ')
    .replace(/\b(1-0|0-1|1\/2-1\/2|\*)\s*$/g, ' ');
  const tokens = withoutHeaders
    .split(/\s+/)
    .map((t) => t.replace(/^[0-9]+\.+/g, '').trim())
    .filter((t) => t.length > 0 && !/^[0-9]+$/.test(t));
  return tokens;
}

const PIECE_UNICODE: Record<string, string> = {
  wK: '♔',
  wQ: '♕',
  wR: '♖',
  wB: '♗',
  wN: '♘',
  wP: '♙',
  bK: '♚',
  bQ: '♛',
  bR: '♜',
  bB: '♝',
  bN: '♞',
  bP: '♟',
};

interface ChessboardViewerProps {
  pgn: string;
  initialOrientation?: 'White' | 'Black';
  compact?: boolean;
}

export const ChessboardViewer: React.FC<ChessboardViewerProps> = ({
  pgn,
  initialOrientation = 'White',
  compact = false,
}) => {
  const [flipped, setFlipped] = useState(initialOrientation === 'Black');
  const moves = useMemo(() => extractPgnMoves(pgn), [pgn]);
  const [step, setStep] = useState(moves.length);

  useEffect(() => {
    setFlipped(initialOrientation === 'Black');
  }, [initialOrientation]);

  useEffect(() => {
    setStep(moves.length);
  }, [moves.length, pgn]);

  const positions = useMemo(() => {
    const history: BoardState[] = [createInitialBoard()];
    let current = history[0];
    moves.forEach((move, idx) => {
      const turn: PieceColor = idx % 2 === 0 ? 'w' : 'b';
      current = applySanMove(current, move, turn);
      history.push(current);
    });
    return history;
  }, [moves]);

  const currentBoard = positions[Math.min(step, positions.length - 1)] || positions[0];
  const rows = flipped ? [7, 6, 5, 4, 3, 2, 1, 0] : [0, 1, 2, 3, 4, 5, 6, 7];
  const cols = flipped ? [7, 6, 5, 4, 3, 2, 1, 0] : [0, 1, 2, 3, 4, 5, 6, 7];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between text-xs text-slate-600">
        <span className="font-mono tabular-nums">
          Coup {Math.ceil(step / 2)} / {Math.ceil(moves.length / 2)}{' '}
          {step > 0 && moves[step - 1] ? `(${step % 2 === 1 ? 'Blancs' : 'Noirs'} : ${moves[step - 1]})` : '(Position initiale)'}
        </span>
        <button
          type="button"
          onClick={() => setFlipped((f) => !f)}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded transition-colors whitespace-nowrap"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Vue {flipped ? 'Noirs' : 'Blancs'}
        </button>
      </div>

      {/* 8x8 Board */}
      <div
        className={`grid grid-cols-8 border border-slate-300 rounded overflow-hidden select-none ${
          compact ? 'w-56 h-56' : 'w-full max-w-[320px] aspect-square mx-auto'
        }`}
      >
        {rows.map((r, rIdx) =>
          cols.map((c, cIdx) => {
            const isLight = (r + c) % 2 === 0;
            const piece = currentBoard[r][c];
            const fileLabel = String.fromCharCode('a'.charCodeAt(0) + c);
            const rankLabel = String(8 - r);

            return (
              <div
                key={`${r}-${c}`}
                className={`relative flex items-center justify-center ${
                  isLight ? 'bg-[#ebe7df]' : 'bg-[#8c7a6b]'
                }`}
              >
                {cIdx === 0 && (
                  <span
                    className={`absolute top-0.5 left-1 text-[9px] font-mono leading-none ${
                      isLight ? 'text-[#8c7a6b]' : 'text-[#ebe7df]'
                    }`}
                  >
                    {rankLabel}
                  </span>
                )}
                {rIdx === 7 && (
                  <span
                    className={`absolute bottom-0.5 right-1 text-[9px] font-mono leading-none ${
                      isLight ? 'text-[#8c7a6b]' : 'text-[#ebe7df]'
                    }`}
                  >
                    {fileLabel}
                  </span>
                )}
                {piece && (
                  <span
                    className={`text-2xl sm:text-3xl leading-none ${
                      piece.color === 'w'
                        ? 'text-white drop-shadow-[0_1px_2px_rgba(15,23,42,0.85)]'
                        : 'text-slate-950 drop-shadow-[0_1px_1px_rgba(255,255,255,0.4)]'
                    }`}
                  >
                    {PIECE_UNICODE[`${piece.color}${piece.type}`]}
                  </span>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Controls */}
      {moves.length > 0 && (
        <>
          <div className="flex items-center justify-center gap-1.5">
            <button
              type="button"
              onClick={() => setStep(0)}
              disabled={step === 0}
              className="p-1.5 rounded bg-slate-100 hover:bg-slate-200 disabled:opacity-40 text-slate-700 transition-colors"
              title="Début de partie"
            >
              <ChevronFirst className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              disabled={step === 0}
              className="p-1.5 rounded bg-slate-100 hover:bg-slate-200 disabled:opacity-40 text-slate-700 transition-colors"
              title="Coup précédent"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setStep((s) => Math.min(moves.length, s + 1))}
              disabled={step >= moves.length}
              className="p-1.5 rounded bg-slate-100 hover:bg-slate-200 disabled:opacity-40 text-slate-700 transition-colors"
              title="Coup suivant"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setStep(moves.length)}
              disabled={step >= moves.length}
              className="p-1.5 rounded bg-slate-100 hover:bg-slate-200 disabled:opacity-40 text-slate-700 transition-colors"
              title="Fin de partie"
            >
              <ChevronLast className="w-4 h-4" />
            </button>
          </div>

          {/* Interactive Move List */}
          <div className="max-h-28 overflow-y-auto border border-slate-200 rounded p-2.5 bg-slate-50 font-mono text-xs leading-relaxed">
            {Array.from({ length: Math.ceil(moves.length / 2) }).map((_, pairIdx) => {
              const wIdx = pairIdx * 2;
              const bIdx = pairIdx * 2 + 1;
              return (
                <span key={pairIdx} className="inline-block mr-3 mb-1">
                  <span className="text-slate-400 mr-1">{pairIdx + 1}.</span>
                  <button
                    type="button"
                    onClick={() => setStep(wIdx + 1)}
                    className={`px-1 rounded transition-colors ${
                      step === wIdx + 1
                        ? 'bg-slate-900 text-white font-semibold'
                        : 'text-slate-800 hover:bg-slate-200'
                    }`}
                  >
                    {moves[wIdx]}
                  </button>
                  {moves[bIdx] && (
                    <button
                      type="button"
                      onClick={() => setStep(bIdx + 1)}
                      className={`ml-1 px-1 rounded transition-colors ${
                        step === bIdx + 1
                          ? 'bg-slate-900 text-white font-semibold'
                          : 'text-slate-800 hover:bg-slate-200'
                      }`}
                    >
                      {moves[bIdx]}
                    </button>
                  )}
                </span>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};
