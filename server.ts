import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer as createViteServer } from 'vite';
import {
  BoardState,
  Player,
  MoveOption,
  NODE_MAP,
  createInitialBoard,
  getLegalMovesForNode,
  applyMove,
  countPieces,
  checkGameWinner,
} from './src/game/sholoGutiEngine.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface OnlinePlayerInfo {
  uid: string;
  username: string;
  avatar: string;
  connected: boolean;
}

export interface OnlineMoveLogItem {
  moveNumber: number;
  player: Player;
  from: string;
  to: string;
  type: 'step' | 'capture';
  capturedNode?: string;
}

export interface OnlineRoomState {
  roomCode: string;
  matchId: string;
  isPrivate: boolean;
  status: 'waiting' | 'playing' | 'finished';
  player1: OnlinePlayerInfo;
  player2: OnlinePlayerInfo | null;
  board: BoardState;
  currentTurn: Player;
  chainNode: string | null;
  moveHistory: OnlineMoveLogItem[];
  lastMove: { from: string; to: string; capturedNodes: string[] } | null;
  winner: Player | 'draw' | null;
  winReasonKey: string | null;
  drawOfferedBy: Player | null;
  rematchVotes: Player[];
  createdAt: number;
  updatedAt: number;
}

interface ClientSession {
  ws: WebSocket;
  uid: string;
  username: string;
  avatar: string;
  status: 'online' | 'searching' | 'in_game';
  currentRoomCode: string | null;
}

const rooms = new Map<string, OnlineRoomState>();
const clientsByUid = new Map<string, ClientSession>();
const quickMatchQueue: string[] = [];

function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return rooms.has(code) ? generateRoomCode() : code;
}

function sendJson(ws: WebSocket, payload: unknown) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(payload));
  }
}

function broadcastPresence() {
  const onlineUsers: Array<{
    uid: string;
    username: string;
    avatar: string;
    status: 'online' | 'searching' | 'in_game';
  }> = [];

  for (const session of clientsByUid.values()) {
    if (session.ws.readyState === WebSocket.OPEN) {
      onlineUsers.push({
        uid: session.uid,
        username: session.username,
        avatar: session.avatar,
        status: session.status,
      });
    }
  }

  const msg = JSON.stringify({
    type: 'presence:list',
    users: onlineUsers,
    queueCount: quickMatchQueue.length,
    activeRoomsCount: rooms.size,
  });

  for (const session of clientsByUid.values()) {
    if (session.ws.readyState === WebSocket.OPEN) {
      session.ws.send(msg);
    }
  }
}

function broadcastRoomState(room: OnlineRoomState, eventType: string = 'room:state') {
  const p1Session = clientsByUid.get(room.player1.uid);
  if (p1Session) {
    sendJson(p1Session.ws, { type: eventType, room, yourSeat: 1 });
  }
  if (room.player2) {
    const p2Session = clientsByUid.get(room.player2.uid);
    if (p2Session) {
      sendJson(p2Session.ws, { type: eventType, room, yourSeat: 2 });
    }
  }
}

function removeFromQueue(uid: string) {
  const idx = quickMatchQueue.indexOf(uid);
  if (idx !== -1) {
    quickMatchQueue.splice(idx, 1);
  }
}

async function startServer() {
  const app = express();
  app.use(express.json());

  app.get('/api/online-stats', (_req, res) => {
    res.json({
      onlineCount: clientsByUid.size,
      searchingCount: quickMatchQueue.length,
      activeRoomsCount: rooms.size,
    });
  });

  app.get('/api/rooms/:code', (req, res) => {
    const code = (req.params.code || '').toUpperCase().trim();
    const room = rooms.get(code);
    if (!room) {
      res.status(404).json({ error: 'Room not found' });
      return;
    }
    res.json({
      roomCode: room.roomCode,
      status: room.status,
      player1: room.player1.username,
      player2: room.player2?.username || null,
    });
  });

  const server = http.createServer(app);
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws) => {
    let boundUid: string | null = null;

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(String(raw));
        if (!msg || typeof msg.type !== 'string') return;

        // 1. Register user session
        if (msg.type === 'presence:register') {
          const uid = String(msg.uid || '').trim().slice(0, 128);
          const username = String(msg.username || 'Player').trim().slice(0, 32);
          const avatar = String(msg.avatar || 'emerald_lotus').trim().slice(0, 64);
          if (!uid) return;

          boundUid = uid;
          const existingSession = clientsByUid.get(uid);
          const existingRoomCode = existingSession?.currentRoomCode || null;

          const session: ClientSession = {
            ws,
            uid,
            username,
            avatar,
            status: existingRoomCode ? 'in_game' : 'online',
            currentRoomCode: existingRoomCode,
          };
          clientsByUid.set(uid, session);

          // Check if user is already in an active room and restore it automatically
          if (existingRoomCode && rooms.has(existingRoomCode)) {
            const room = rooms.get(existingRoomCode)!;
            if (room.player1.uid === uid) {
              room.player1.connected = true;
              room.player1.username = username;
            } else if (room.player2 && room.player2.uid === uid) {
              room.player2.connected = true;
              room.player2.username = username;
            }
            broadcastRoomState(room, 'room:state');
          }

          broadcastPresence();
          return;
        }

        if (!boundUid) return;
        const session = clientsByUid.get(boundUid);
        if (!session) return;

        // 2. Quick Matchmaking Queue
        if (msg.type === 'quick_match') {
          removeFromQueue(boundUid);
          // Find another waiting player in queue
          const opponentUid = quickMatchQueue.find((id) => {
            if (id === boundUid) return false;
            const opp = clientsByUid.get(id);
            return opp && opp.ws.readyState === WebSocket.OPEN;
          });

          if (opponentUid) {
            removeFromQueue(opponentUid);
            const oppSession = clientsByUid.get(opponentUid)!;
            const roomCode = generateRoomCode();
            const now = Date.now();
            const room: OnlineRoomState = {
              roomCode,
              matchId: `match_${roomCode}_${now}`,
              isPrivate: false,
              status: 'playing',
              player1: {
                uid: oppSession.uid,
                username: oppSession.username,
                avatar: oppSession.avatar,
                connected: true,
              },
              player2: {
                uid: session.uid,
                username: session.username,
                avatar: session.avatar,
                connected: true,
              },
              board: createInitialBoard(),
              currentTurn: 1,
              chainNode: null,
              moveHistory: [],
              lastMove: null,
              winner: null,
              winReasonKey: null,
              drawOfferedBy: null,
              rematchVotes: [],
              createdAt: now,
              updatedAt: now,
            };

            rooms.set(roomCode, room);
            oppSession.status = 'in_game';
            oppSession.currentRoomCode = roomCode;
            session.status = 'in_game';
            session.currentRoomCode = roomCode;

            broadcastRoomState(room, 'room:started');
            broadcastPresence();
          } else {
            quickMatchQueue.push(boundUid);
            session.status = 'searching';
            sendJson(ws, { type: 'quick_match:searching' });
            broadcastPresence();
          }
          return;
        }

        // 3. Cancel Quick Match
        if (msg.type === 'cancel_quick_match') {
          removeFromQueue(boundUid);
          session.status = 'online';
          sendJson(ws, { type: 'quick_match:cancelled' });
          broadcastPresence();
          return;
        }

        // 4. Create Private Room
        if (msg.type === 'create_room') {
          removeFromQueue(boundUid);
          const roomCode = generateRoomCode();
          const now = Date.now();
          const room: OnlineRoomState = {
            roomCode,
            matchId: `match_${roomCode}_${now}`,
            isPrivate: true,
            status: 'waiting',
            player1: {
              uid: session.uid,
              username: session.username,
              avatar: session.avatar,
              connected: true,
            },
            player2: null,
            board: createInitialBoard(),
            currentTurn: 1,
            chainNode: null,
            moveHistory: [],
            lastMove: null,
            winner: null,
            winReasonKey: null,
            drawOfferedBy: null,
            rematchVotes: [],
            createdAt: now,
            updatedAt: now,
          };

          rooms.set(roomCode, room);
          session.status = 'in_game';
          session.currentRoomCode = roomCode;

          sendJson(ws, { type: 'room:created', room, yourSeat: 1 });
          broadcastPresence();
          return;
        }

        // 5. Join Room by Code
        if (msg.type === 'join_room') {
          const code = String(msg.roomCode || '').toUpperCase().trim();
          const room = rooms.get(code);
          if (!room) {
            sendJson(ws, { type: 'room:error', errorKey: 'roomNotFound' });
            return;
          }

          // Reconnect if user is already Player 1 or Player 2
          if (room.player1.uid === boundUid) {
            room.player1.connected = true;
            session.status = 'in_game';
            session.currentRoomCode = code;
            broadcastRoomState(room, 'room:state');
            broadcastPresence();
            return;
          }
          if (room.player2 && room.player2.uid === boundUid) {
            room.player2.connected = true;
            session.status = 'in_game';
            session.currentRoomCode = code;
            broadcastRoomState(room, 'room:state');
            broadcastPresence();
            return;
          }

          if (room.status !== 'waiting' || room.player2 !== null) {
            sendJson(ws, { type: 'room:error', errorKey: 'roomFull' });
            return;
          }

          removeFromQueue(boundUid);
          room.player2 = {
            uid: session.uid,
            username: session.username,
            avatar: session.avatar,
            connected: true,
          };
          room.status = 'playing';
          room.updatedAt = Date.now();

          session.status = 'in_game';
          session.currentRoomCode = code;

          broadcastRoomState(room, 'room:started');
          broadcastPresence();
          return;
        }

        // 6. Leave Room
        if (msg.type === 'leave_room') {
          const code = session.currentRoomCode;
          if (code && rooms.has(code)) {
            const room = rooms.get(code)!;
            if (room.status === 'playing' && room.winner === null) {
              // Leaving during an active match forfeits the match to the remaining player
              const leaverSeat: Player = room.player1.uid === boundUid ? 1 : 2;
              room.winner = leaverSeat === 1 ? 2 : 1;
              room.status = 'finished';
              room.winReasonKey = 'opponentLeft';
              room.updatedAt = Date.now();
              broadcastRoomState(room, 'room:state');
            } else if (room.status === 'waiting') {
              rooms.delete(code);
            }
          }
          session.currentRoomCode = null;
          session.status = 'online';
          broadcastPresence();
          return;
        }

        // 7. Submit Authoritative Move
        if (msg.type === 'submit_move') {
          const code = String(msg.roomCode || session.currentRoomCode || '').toUpperCase().trim();
          const room = rooms.get(code);
          if (!room || room.status !== 'playing' || room.winner !== null) return;

          const playerSeat: Player | null =
            room.player1.uid === boundUid
              ? 1
              : room.player2?.uid === boundUid
              ? 2
              : null;

          if (!playerSeat || room.currentTurn !== playerSeat) {
            sendJson(ws, { type: 'room:error', errorKey: 'notYourTurn' });
            return;
          }

          const from = String(msg.from || '');
          const to = String(msg.to || '');
          if (!NODE_MAP[from] || !NODE_MAP[to]) return;

          if (room.chainNode && room.chainNode !== from) {
            sendJson(ws, { type: 'room:error', errorKey: 'mustUseChainPiece' });
            return;
          }

          const legalMoves: MoveOption[] = getLegalMovesForNode(
            room.board,
            from,
            playerSeat,
            Boolean(room.chainNode)
          );
          const matchedMove = legalMoves.find((m) => m.to === to);
          if (!matchedMove) {
            sendJson(ws, { type: 'room:error', errorKey: 'illegalMove' });
            return;
          }

          const { nextBoard, hasFurtherCapture } = applyMove(room.board, matchedMove);
          room.board = nextBoard;
          room.drawOfferedBy = null;
          room.updatedAt = Date.now();

          const moveLog: OnlineMoveLogItem = {
            moveNumber: room.moveHistory.length + 1,
            player: playerSeat,
            from: matchedMove.from,
            to: matchedMove.to,
            type: matchedMove.type,
            capturedNode: matchedMove.capturedNode,
          };
          room.moveHistory.unshift(moveLog);
          room.lastMove = {
            from: matchedMove.from,
            to: matchedMove.to,
            capturedNodes: matchedMove.capturedNode ? [matchedMove.capturedNode] : [],
          };

          // Check if opponent lost all pieces immediately
          const counts = countPieces(room.board);
          if (counts.player1 === 0 || counts.player2 === 0) {
            room.winner = counts.player2 === 0 ? 1 : 2;
            room.status = 'finished';
            room.chainNode = null;
            room.winReasonKey = 'allPiecesCaptured';
            broadcastRoomState(room, 'room:state');
            return;
          }

          if (matchedMove.type === 'capture' && hasFurtherCapture) {
            room.chainNode = matchedMove.to;
            broadcastRoomState(room, 'room:state');
            return;
          }

          // Switch turn and check if next player has any legal moves
          const nextTurn: Player = playerSeat === 1 ? 2 : 1;
          room.chainNode = null;
          room.currentTurn = nextTurn;

          const winCheck = checkGameWinner(room.board, nextTurn);
          if (winCheck.winner) {
            room.winner = winCheck.winner;
            room.status = 'finished';
            room.winReasonKey = 'noLegalMoves';
          }

          broadcastRoomState(room, 'room:state');
          return;
        }

        // 8. End Chain Capture Turn Voluntarily
        if (msg.type === 'end_chain_turn') {
          const code = String(msg.roomCode || session.currentRoomCode || '').toUpperCase().trim();
          const room = rooms.get(code);
          if (!room || room.status !== 'playing' || !room.chainNode) return;

          const playerSeat: Player | null =
            room.player1.uid === boundUid
              ? 1
              : room.player2?.uid === boundUid
              ? 2
              : null;

          if (!playerSeat || room.currentTurn !== playerSeat) return;

          const nextTurn: Player = playerSeat === 1 ? 2 : 1;
          room.chainNode = null;
          room.currentTurn = nextTurn;
          room.updatedAt = Date.now();

          const winCheck = checkGameWinner(room.board, nextTurn);
          if (winCheck.winner) {
            room.winner = winCheck.winner;
            room.status = 'finished';
            room.winReasonKey = 'noLegalMoves';
          }

          broadcastRoomState(room, 'room:state');
          return;
        }

        // 9. Offer or Respond to Draw
        if (msg.type === 'offer_draw') {
          const code = String(msg.roomCode || session.currentRoomCode || '').toUpperCase().trim();
          const room = rooms.get(code);
          if (!room || room.status !== 'playing') return;
          const seat: Player | null =
            room.player1.uid === boundUid ? 1 : room.player2?.uid === boundUid ? 2 : null;
          if (!seat) return;
          room.drawOfferedBy = seat;
          broadcastRoomState(room, 'room:state');
          return;
        }

        if (msg.type === 'respond_draw') {
          const code = String(msg.roomCode || session.currentRoomCode || '').toUpperCase().trim();
          const room = rooms.get(code);
          if (!room || room.status !== 'playing' || !room.drawOfferedBy) return;
          const seat: Player | null =
            room.player1.uid === boundUid ? 1 : room.player2?.uid === boundUid ? 2 : null;
          if (!seat || seat === room.drawOfferedBy) return;

          if (msg.accept === true) {
            room.winner = 'draw';
            room.status = 'finished';
            room.winReasonKey = 'mutualDraw';
            room.drawOfferedBy = null;
          } else {
            room.drawOfferedBy = null;
          }
          broadcastRoomState(room, 'room:state');
          return;
        }

        // 10. Resign Match
        if (msg.type === 'resign_match') {
          const code = String(msg.roomCode || session.currentRoomCode || '').toUpperCase().trim();
          const room = rooms.get(code);
          if (!room || room.status !== 'playing') return;
          const seat: Player | null =
            room.player1.uid === boundUid ? 1 : room.player2?.uid === boundUid ? 2 : null;
          if (!seat) return;
          room.winner = seat === 1 ? 2 : 1;
          room.status = 'finished';
          room.winReasonKey = 'opponentResigned';
          room.updatedAt = Date.now();
          broadcastRoomState(room, 'room:state');
          return;
        }

        // 11. Request Rematch
        if (msg.type === 'request_rematch') {
          const code = String(msg.roomCode || session.currentRoomCode || '').toUpperCase().trim();
          const room = rooms.get(code);
          if (!room || room.status !== 'finished' || !room.player2) return;
          const seat: Player | null =
            room.player1.uid === boundUid ? 1 : room.player2.uid === boundUid ? 2 : null;
          if (!seat) return;

          if (!room.rematchVotes.includes(seat)) {
            room.rematchVotes.push(seat);
          }

          if (room.rematchVotes.includes(1) && room.rematchVotes.includes(2)) {
            const now = Date.now();
            room.matchId = `match_${room.roomCode}_${now}`;
            room.board = createInitialBoard();
            room.status = 'playing';
            room.currentTurn = 1;
            room.chainNode = null;
            room.moveHistory = [];
            room.lastMove = null;
            room.winner = null;
            room.winReasonKey = null;
            room.drawOfferedBy = null;
            room.rematchVotes = [];
            room.updatedAt = now;
            broadcastRoomState(room, 'room:started');
          } else {
            broadcastRoomState(room, 'room:state');
          }
          return;
        }
      } catch (err) {
        console.error('WebSocket message error:', err);
      }
    });

    ws.on('close', () => {
      if (!boundUid) return;
      removeFromQueue(boundUid);
      const session = clientsByUid.get(boundUid);
      if (session && session.ws === ws) {
        if (session.currentRoomCode && rooms.has(session.currentRoomCode)) {
          const room = rooms.get(session.currentRoomCode)!;
          if (room.player1.uid === boundUid) {
            room.player1.connected = false;
          } else if (room.player2 && room.player2.uid === boundUid) {
            room.player2.connected = false;
          }
          broadcastRoomState(room, 'room:state');
        }
        clientsByUid.delete(boundUid);
      }
      broadcastPresence();
    });
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const PORT = 3000;
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Sholo Guti Authoritative Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
