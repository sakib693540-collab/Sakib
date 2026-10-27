// Authentic Bengali Sholo Guti (ষোলো গুটি) Game Engine
// 37 Board Nodes, 20 Straight Board Lines, 16 Pieces per Player

import { LanguageCode, formatBoardCoord } from '../i18n/translations';

export type Player = 1 | 2; // 1 = নিচের পক্ষ (খেলোয়াড় ১ - লাল/সোনালি), 2 = উপরের পক্ষ (খেলোয়াড় ২ / কম্পিউটার - পান্না সবুজ)
export type BoardState = Record<string, Player | null>;

export interface BoardNode {
  id: string;
  row: number; // 0 to 8
  col: number; // logical column index
  x: number;   // SVG coordinate (viewBox 0 0 600 840)
  y: number;   // SVG coordinate (viewBox 0 0 600 840)
  zone: 'top_camp' | 'main_square' | 'bottom_camp';
  labelBn: string;
}

export interface MoveOption {
  from: string;
  to: string;
  type: 'step' | 'capture';
  capturedNode?: string;
}

export interface MoveRecord {
  moveNumber: number;
  player: Player;
  from: string;
  to: string;
  type: 'step' | 'capture';
  capturedNodes: string[];
  descriptionBn: string;
  boardSnapshot: BoardState;
  turnSnapshot: Player;
  chainNodeSnapshot: string | null;
}

/**
 * Coordinate System for the Traditional Sholo Guti Board (viewBox: 0 0 600 840)
 *
 * Center 5x5 Alquerque Square (rows 2..6, cols 0..4):
 * - x spans from 100 to 500 (spacing = 100px per column: 100, 200, 300, 400, 500)
 * - y spans from 220 to 620 (spacing = 100px per row: 220, 320, 420, 520, 620)
 *
 * Top Triangular Camp (rows 0..1, attached to throat node r2_c2 at (300, 220)):
 * - Row 1 (y = 140): x = 220 (r1_c0), 300 (r1_c1), 380 (r1_c2)
 * - Row 0 (y = 60):  x = 140 (r0_c0), 300 (r0_c1), 460 (r0_c2)
 * Notice how (140,60) -> (220,140) -> (300,220) -> (400,320) -> (500,420) has exact slope dy/dx = 1!
 * It is a geometrically true straight line!
 *
 * Bottom Triangular Camp (rows 7..8, attached to throat node r6_c2 at (300, 620)):
 * - Row 7 (y = 700): x = 220 (r7_c0), 300 (r7_c1), 380 (r7_c2)
 * - Row 8 (y = 780): x = 140 (r8_c0), 300 (r8_c1), 460 (r8_c2)
 * Notice how (100,420) -> (200,520) -> (300,620) -> (380,700) -> (460,780) has exact slope dy/dx = 1!
 * Every single line on the board is 100% collinear both visually and topologically.
 */

const BENGALI_ROW_NAMES = ['১ম', '২য়', '৩য়', '৪র্থ', '৫ম', '৬ষ্ঠ', '৭ম', '৮ম', '৯ম'];
const BENGALI_COL_NAMES = ['ক', 'খ', 'গ', 'ঘ', 'ঙ'];

export const BOARD_NODES: BoardNode[] = [
  // Row 0: Top Camp Outer Rank (3 nodes)
  { id: 'r0_c0', row: 0, col: 0, x: 140, y: 60, zone: 'top_camp', labelBn: '১ম-ক' },
  { id: 'r0_c1', row: 0, col: 2, x: 300, y: 60, zone: 'top_camp', labelBn: '১ম-গ' },
  { id: 'r0_c2', row: 0, col: 4, x: 460, y: 60, zone: 'top_camp', labelBn: '১ম-ঙ' },

  // Row 1: Top Camp Inner Rank (3 nodes)
  { id: 'r1_c0', row: 1, col: 1, x: 220, y: 140, zone: 'top_camp', labelBn: '২য়-খ' },
  { id: 'r1_c1', row: 1, col: 2, x: 300, y: 140, zone: 'top_camp', labelBn: '২য়-গ' },
  { id: 'r1_c2', row: 1, col: 3, x: 380, y: 140, zone: 'top_camp', labelBn: '২য়-ঘ' },

  // Rows 2 to 6: Main 5x5 Square (25 nodes)
  ...([2, 3, 4, 5, 6] as const).flatMap((r) =>
    ([0, 1, 2, 3, 4] as const).map((c) => ({
      id: `r${r}_c${c}`,
      row: r,
      col: c,
      x: 100 + c * 100,
      y: 220 + (r - 2) * 100,
      zone: 'main_square' as const,
      labelBn: `${BENGALI_ROW_NAMES[r]}-${BENGALI_COL_NAMES[c]}`,
    }))
  ),

  // Row 7: Bottom Camp Inner Rank (3 nodes)
  { id: 'r7_c0', row: 7, col: 1, x: 220, y: 700, zone: 'bottom_camp', labelBn: '৮ম-খ' },
  { id: 'r7_c1', row: 7, col: 2, x: 300, y: 700, zone: 'bottom_camp', labelBn: '৮ম-গ' },
  { id: 'r7_c2', row: 7, col: 3, x: 380, y: 700, zone: 'bottom_camp', labelBn: '৮ম-ঘ' },

  // Row 8: Bottom Camp Outer Rank (3 nodes)
  { id: 'r8_c0', row: 8, col: 0, x: 140, y: 780, zone: 'bottom_camp', labelBn: '৯ম-ক' },
  { id: 'r8_c1', row: 8, col: 2, x: 300, y: 780, zone: 'bottom_camp', labelBn: '৯ম-গ' },
  { id: 'r8_c2', row: 8, col: 4, x: 460, y: 780, zone: 'bottom_camp', labelBn: '৯ম-ঙ' },
];

export const NODE_MAP: Record<string, BoardNode> = Object.fromEntries(
  BOARD_NODES.map((n) => [n.id, n])
);

export function getNodeLabel(nodeId: string, lang: LanguageCode = 'bn'): string {
  const node = NODE_MAP[nodeId];
  if (!node) return nodeId;
  return formatBoardCoord(node.row, node.col, lang);
}

/**
 * All 20 Straight Lines on the Traditional Sholo Guti Board.
 * A step move is moving 1 index (+1 or -1) along any line to an empty node.
 * A capture move is jumping 2 indices (+2 or -2) along any single line over an opponent's piece into an empty node.
 */
export const BOARD_LINES: string[][] = [
  // 9 Horizontal Lines
  ['r0_c0', 'r0_c1', 'r0_c2'],
  ['r1_c0', 'r1_c1', 'r1_c2'],
  ['r2_c0', 'r2_c1', 'r2_c2', 'r2_c3', 'r2_c4'],
  ['r3_c0', 'r3_c1', 'r3_c2', 'r3_c3', 'r3_c4'],
  ['r4_c0', 'r4_c1', 'r4_c2', 'r4_c3', 'r4_c4'],
  ['r5_c0', 'r5_c1', 'r5_c2', 'r5_c3', 'r5_c4'],
  ['r6_c0', 'r6_c1', 'r6_c2', 'r6_c3', 'r6_c4'],
  ['r7_c0', 'r7_c1', 'r7_c2'],
  ['r8_c0', 'r8_c1', 'r8_c2'],

  // 5 Vertical Lines (Center column extends through both triangular camps)
  ['r2_c0', 'r3_c0', 'r4_c0', 'r5_c0', 'r6_c0'],
  ['r2_c1', 'r3_c1', 'r4_c1', 'r5_c1', 'r6_c1'],
  ['r0_c1', 'r1_c1', 'r2_c2', 'r3_c2', 'r4_c2', 'r5_c2', 'r6_c2', 'r7_c1', 'r8_c1'],
  ['r2_c3', 'r3_c3', 'r4_c3', 'r5_c3', 'r6_c3'],
  ['r2_c4', 'r3_c4', 'r4_c4', 'r5_c4', 'r6_c4'],

  // 2 Main Square Diagonals
  ['r2_c0', 'r3_c1', 'r4_c2', 'r5_c3', 'r6_c4'],
  ['r2_c4', 'r3_c3', 'r4_c2', 'r5_c1', 'r6_c0'],

  // 4 Extended Diamond + Triangle Wing Diagonals
  ['r0_c0', 'r1_c0', 'r2_c2', 'r3_c3', 'r4_c4'],
  ['r0_c2', 'r1_c2', 'r2_c2', 'r3_c1', 'r4_c0'],
  ['r4_c0', 'r5_c1', 'r6_c2', 'r7_c2', 'r8_c2'],
  ['r4_c4', 'r5_c3', 'r6_c2', 'r7_c0', 'r8_c0'],
];

/**
 * Create the authentic initial Sholo Guti board setup:
 * - Player 2 (Top / সবুজ গুটি): 16 pieces on rows 0, 1, 2, 3
 * - Empty Middle Line: 5 empty points on row 4
 * - Player 1 (Bottom / লাল গুটি): 16 pieces on rows 5, 6, 7, 8
 */
export function createInitialBoard(): BoardState {
  const board: BoardState = {};
  for (const node of BOARD_NODES) {
    if (node.row <= 3) {
      board[node.id] = 2;
    } else if (node.row === 4) {
      board[node.id] = null;
    } else {
      board[node.id] = 1;
    }
  }
  return board;
}

/**
 * Get all legal moves for a specific piece at `nodeId`.
 * If `onlyCaptures` is true (used during a multi-jump chain), only capture jumps are returned.
 */
export function getLegalMovesForNode(
  board: BoardState,
  nodeId: string,
  player: Player,
  onlyCaptures = false
): MoveOption[] {
  if (board[nodeId] !== player) return [];
  const opponent: Player = player === 1 ? 2 : 1;
  const moves: MoveOption[] = [];
  const seenTargets = new Set<string>();

  for (const line of BOARD_LINES) {
    const idx = line.indexOf(nodeId);
    if (idx === -1) continue;

    // Check both directions along this straight line (-1 and +1)
    for (const dir of [-1, 1]) {
      const adjIdx = idx + dir;
      if (adjIdx >= 0 && adjIdx < line.length) {
        const adjNode = line[adjIdx];

        // 1. Step move: adjacent node is empty
        if (!onlyCaptures && board[adjNode] === null) {
          const key = `step:${adjNode}`;
          if (!seenTargets.has(key)) {
            seenTargets.add(key);
            moves.push({
              from: nodeId,
              to: adjNode,
              type: 'step',
            });
          }
        }

        // 2. Capture jump: adjacent node has opponent piece, and next node on the same line is empty
        const jumpIdx = idx + dir * 2;
        if (
          board[adjNode] === opponent &&
          jumpIdx >= 0 &&
          jumpIdx < line.length &&
          board[line[jumpIdx]] === null
        ) {
          const jumpTarget = line[jumpIdx];
          const key = `capture:${jumpTarget}:${adjNode}`;
          if (!seenTargets.has(key)) {
            seenTargets.add(key);
            moves.push({
              from: nodeId,
              to: jumpTarget,
              type: 'capture',
              capturedNode: adjNode,
            });
          }
        }
      }
    }
  }

  return moves;
}

/**
 * Get all legal moves for `player` across the entire board.
 * If `chainNode` is active (a piece just captured and can continue jumping),
 * only capture moves from `chainNode` are returned.
 */
export function getAllLegalMoves(
  board: BoardState,
  player: Player,
  chainNode: string | null = null
): MoveOption[] {
  if (chainNode) {
    return getLegalMovesForNode(board, chainNode, player, true);
  }
  const allMoves: MoveOption[] = [];
  for (const node of BOARD_NODES) {
    if (board[node.id] === player) {
      allMoves.push(...getLegalMovesForNode(board, node.id, player, false));
    }
  }
  return allMoves;
}

/**
 * Execute a move and return the new board state plus whether the same piece has a chain capture available.
 */
export function applyMove(
  board: BoardState,
  move: MoveOption
): {
  nextBoard: BoardState;
  hasFurtherCapture: boolean;
  furtherCaptures: MoveOption[];
} {
  const player = board[move.from];
  if (!player) {
    return { nextBoard: { ...board }, hasFurtherCapture: false, furtherCaptures: [] };
  }

  const nextBoard: BoardState = { ...board };
  nextBoard[move.from] = null;
  nextBoard[move.to] = player;

  if (move.type === 'capture' && move.capturedNode) {
    nextBoard[move.capturedNode] = null;
  }

  if (move.type === 'capture') {
    const furtherCaptures = getLegalMovesForNode(nextBoard, move.to, player, true);
    return {
      nextBoard,
      hasFurtherCapture: furtherCaptures.length > 0,
      furtherCaptures,
    };
  }

  return {
    nextBoard,
    hasFurtherCapture: false,
    furtherCaptures: [],
  };
}

/**
 * Count remaining pieces for both players.
 */
export function countPieces(board: BoardState): { player1: number; player2: number } {
  let player1 = 0;
  let player2 = 0;
  for (const id in board) {
    if (board[id] === 1) player1++;
    else if (board[id] === 2) player2++;
  }
  return { player1, player2 };
}

/**
 * Check if the game has ended and return winner + localized reason key + Bengali fallback reason.
 */
export function checkGameWinner(
  board: BoardState,
  currentTurn: Player
): {
  winner: Player | null;
  reasonBn: string | null;
  reasonKey: 'winAllP1Captured' | 'winAllP2Captured' | 'winP1Blocked' | 'winP2Blocked' | null;
} {
  const counts = countPieces(board);
  if (counts.player1 === 0) {
    return {
      winner: 2,
      reasonBn: 'খেলোয়াড় ১-এর সবকটি (১৬টি) গুটি খাওয়া হয়েছে!',
      reasonKey: 'winAllP1Captured',
    };
  }
  if (counts.player2 === 0) {
    return {
      winner: 1,
      reasonBn: 'প্রতিপক্ষের সবকটি (১৬টি) গুটি খাওয়া হয়েছে!',
      reasonKey: 'winAllP2Captured',
    };
  }

  // Check if current player has any legal moves left
  const legalMoves = getAllLegalMoves(board, currentTurn, null);
  if (legalMoves.length === 0) {
    const winner: Player = currentTurn === 1 ? 2 : 1;
    return {
      winner,
      reasonBn:
        currentTurn === 1
          ? 'খেলোয়াড় ১-এর কোনো বৈধ চাল অবশিষ্ট নেই (অবরুদ্ধ)!'
          : 'প্রতিপক্ষের কোনো বৈধ চাল অবশিষ্ট নেই (অবরুদ্ধ)!',
      reasonKey: currentTurn === 1 ? 'winP1Blocked' : 'winP2Blocked',
    };
  }

  return { winner: null, reasonBn: null, reasonKey: null };
}

// Strategic node weights: central spine, crossroads (degree >= 6), and throat nodes are high-value
const STRATEGIC_WEIGHTS: Record<string, number> = {
  r4_c2: 18, // Dead center 8-way intersection
  r2_c2: 16, // Top camp throat (8-way intersection)
  r6_c2: 16, // Bottom camp throat (8-way intersection)
  r3_c1: 12,
  r3_c3: 12,
  r5_c1: 12,
  r5_c3: 12,
  r4_c0: 11,
  r4_c4: 11,
  r3_c2: 10,
  r5_c2: 10,
  r4_c1: 10,
  r4_c3: 10,
};

function evaluateBoard(board: BoardState, aiPlayer: Player): number {
  const humanPlayer: Player = aiPlayer === 1 ? 2 : 1;
  let score = 0;

  let aiCount = 0;
  let humanCount = 0;

  for (const node of BOARD_NODES) {
    const occupant = board[node.id];
    const positionalBonus = STRATEGIC_WEIGHTS[node.id] || 4;
    if (occupant === aiPlayer) {
      aiCount++;
      score += 100 + positionalBonus;
    } else if (occupant === humanPlayer) {
      humanCount++;
      score -= 100 + positionalBonus;
    }
  }

  if (humanCount === 0) return 100000;
  if (aiCount === 0) return -100000;

  const aiMoves = getAllLegalMoves(board, aiPlayer, null);
  const humanMoves = getAllLegalMoves(board, humanPlayer, null);

  const aiCaptures = aiMoves.filter((m) => m.type === 'capture').length;
  const humanCaptures = humanMoves.filter((m) => m.type === 'capture').length;

  score += aiMoves.length * 2 + aiCaptures * 35;
  score -= humanMoves.length * 2 + humanCaptures * 40;

  return score;
}

/**
 * Choose the best move for `player` according to difficulty ('easy' | 'medium' | 'hard').
 * Also used for the Player Hint ("পরামর্শ") feature!
 */
export function chooseBestMove(
  board: BoardState,
  player: Player,
  difficulty: 'easy' | 'medium' | 'hard',
  chainNode: string | null = null
): MoveOption | null {
  const legalMoves = getAllLegalMoves(board, player, chainNode);
  if (legalMoves.length === 0) return null;

  // If currently in a chain capture, always prioritize continuing the capture chain
  if (chainNode) {
    let bestChainMove = legalMoves[0];
    let bestChainScore = -Infinity;
    for (const move of legalMoves) {
      const { nextBoard, hasFurtherCapture } = applyMove(board, move);
      const val = evaluateBoard(nextBoard, player) + (hasFurtherCapture ? 60 : 0);
      if (val > bestChainScore) {
        bestChainScore = val;
        bestChainMove = move;
      }
    }
    return bestChainMove;
  }

  const captures = legalMoves.filter((m) => m.type === 'capture');

  if (difficulty === 'easy') {
    // Easy mode: 65% chance to take a capture if available, otherwise random safe-ish move
    if (captures.length > 0 && Math.random() < 0.65) {
      return captures[Math.floor(Math.random() * captures.length)];
    }
    return legalMoves[Math.floor(Math.random() * legalMoves.length)];
  }

  const searchDepth = difficulty === 'hard' ? 3 : 2;
  const opponent: Player = player === 1 ? 2 : 1;

  // Order captures first for better alpha-beta pruning
  const orderedMoves = [
    ...captures,
    ...legalMoves.filter((m) => m.type === 'step'),
  ];

  let bestMove = orderedMoves[0];
  let bestScore = -Infinity;

  for (const move of orderedMoves) {
    const { nextBoard, hasFurtherCapture } = applyMove(board, move);
    let score: number;

    if (hasFurtherCapture) {
      // Simulate greedy follow-up capture chain for accurate evaluation
      let tempBoard = nextBoard;
      let nextHop = move.to;
      let chainBonus = 45;
      while (true) {
        const more = getLegalMovesForNode(tempBoard, nextHop, player, true);
        if (more.length === 0) break;
        const applied = applyMove(tempBoard, more[0]);
        tempBoard = applied.nextBoard;
        nextHop = more[0].to;
        chainBonus += 55;
      }
      score =
        minimax(tempBoard, searchDepth - 1, -Infinity, Infinity, false, player, opponent) +
        chainBonus;
    } else {
      score = minimax(
        nextBoard,
        searchDepth - 1,
        -Infinity,
        Infinity,
        false,
        player,
        opponent
      );
    }

    // Slight jitter for variety among equally strong moves
    score += (Math.random() - 0.5) * 3;

    if (score > bestScore) {
      bestScore = score;
      bestMove = move;
    }
  }

  return bestMove;
}

function minimax(
  board: BoardState,
  depth: number,
  alpha: number,
  beta: number,
  isMaximizing: boolean,
  aiPlayer: Player,
  humanPlayer: Player
): number {
  const currentTurn = isMaximizing ? aiPlayer : humanPlayer;
  const { winner } = checkGameWinner(board, currentTurn);
  if (winner === aiPlayer) return 50000 + depth * 100;
  if (winner === humanPlayer) return -50000 - depth * 100;
  if (depth <= 0) {
    return evaluateBoard(board, aiPlayer);
  }

  const moves = getAllLegalMoves(board, currentTurn, null);
  const captures = moves.filter((m) => m.type === 'capture');
  const ordered = [
    ...captures,
    ...moves.filter((m) => m.type === 'step').slice(0, 14),
  ];

  if (isMaximizing) {
    let maxEval = -Infinity;
    for (const move of ordered) {
      const { nextBoard } = applyMove(board, move);
      const evaluation = minimax(
        nextBoard,
        depth - 1,
        alpha,
        beta,
        false,
        aiPlayer,
        humanPlayer
      );
      maxEval = Math.max(maxEval, evaluation);
      alpha = Math.max(alpha, evaluation);
      if (beta <= alpha) break;
    }
    return maxEval;
  } else {
    let minEval = Infinity;
    for (const move of ordered) {
      const { nextBoard } = applyMove(board, move);
      const evaluation = minimax(
        nextBoard,
        depth - 1,
        alpha,
        beta,
        true,
        aiPlayer,
        humanPlayer
      );
      minEval = Math.min(minEval, evaluation);
      beta = Math.min(beta, evaluation);
      if (beta <= alpha) break;
    }
    return minEval;
  }
}
