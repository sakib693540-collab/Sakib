import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Users,
  Cpu,
  Globe,
  RotateCcw,
  Undo2,
  BookOpen,
  Volume2,
  VolumeX,
  Trophy,
  Play,
  Lightbulb,
  Check,
  Compass,
  Sparkles,
  UserCheck,
  LogIn,
  LogOut,
  Copy,
  Share2,
  Flag,
  Handshake,
  RefreshCw,
} from 'lucide-react';
import { User } from 'firebase/auth';
import { Capacitor } from '@capacitor/core';
import { SplashScreen } from '@capacitor/splash-screen';
import { StatusBar, Style } from '@capacitor/status-bar';
import {
  BoardState,
  Player,
  MoveOption,
  MoveRecord,
  NODE_MAP,
  createInitialBoard,
  getLegalMovesForNode,
  applyMove,
  countPieces,
  checkGameWinner,
  chooseBestMove,
  getNodeLabel,
} from './game/sholoGutiEngine';
import { SholoGutiBoard } from './components/SholoGutiBoard';
import { RulesModal } from './components/RulesModal';
import { AuthModal } from './components/AuthModal';
import { FriendsModal } from './components/FriendsModal';
import { ProfileModal } from './components/ProfileModal';
import {
  PWAInstallButton,
  OfflineIndicator,
  AndroidGuideModal,
} from './components/PWAInstallButton';
import { soundFX } from './utils/bengali';
import {
  LanguageCode,
  SUPPORTED_LANGUAGES,
  TRANSLATIONS,
  TranslationKey,
  isRtlLanguage,
  formatNumber,
  translate,
} from './i18n/translations';
import {
  CloudPublicProfile,
  CloudUserPrivate,
  CloudFriendRequest,
  CloudMatchHistoryRecord,
  initAuthListener,
  ensureCloudUserProfile,
  updateCloudProfileDetails,
  saveMatchResultToCloud,
  subscribeToMatchHistory,
  subscribeToFriendRequests,
  signOutUser,
} from './services/firebaseClient';

type GameScreen = 'WELCOME' | 'ONLINE_LOBBY' | 'PLAYING';
type GameMode = 'online' | 'ai' | 'local';
type Difficulty = 'easy' | 'medium' | 'hard';

interface OnlineRoomState {
  roomCode: string;
  matchId: string;
  isPrivate: boolean;
  status: 'waiting' | 'playing' | 'finished';
  player1: { uid: string; username: string; avatar: string; connected: boolean };
  player2: { uid: string; username: string; avatar: string; connected: boolean } | null;
  board: BoardState;
  currentTurn: Player;
  chainNode: string | null;
  moveHistory: Array<{
    moveNumber: number;
    player: Player;
    from: string;
    to: string;
    type: 'step' | 'capture';
    capturedNode?: string;
  }>;
  lastMove: { from: string; to: string; capturedNodes: string[] } | null;
  winner: Player | 'draw' | null;
  winReasonKey: string | null;
  drawOfferedBy: Player | null;
  rematchVotes: Player[];
}

export default function App() {
  // Language State (Default: Bengali 'bn')
  const [lang, setLang] = useState<LanguageCode>(() => {
    const saved = localStorage.getItem('sholo_guti_lang') as LanguageCode | null;
    return saved && TRANSLATIONS[saved] ? saved : 'bn';
  });
  const t = TRANSLATIONS[lang];
  const isRtl = isRtlLanguage(lang);

  // Auth & Cloud Persistence State
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<CloudPublicProfile | null>(null);
  const [privateData, setPrivateData] = useState<CloudUserPrivate | null>(null);
  const [friendRequests, setFriendRequests] = useState<CloudFriendRequest[]>([]);
  const [cloudMatchHistory, setCloudMatchHistory] = useState<CloudMatchHistoryRecord[]>([]);
  const [syncState, setSyncState] = useState<'synced' | 'saving' | 'offline'>('synced');
  const [guestStats, setGuestStats] = useState(() => ({
    gamesPlayed: 0,
    wins: 0,
    losses: 0,
    draws: 0,
  }));
  const [guestId] = useState(
    () => `guest_${Math.random().toString(36).slice(2, 9)}`
  );

  // Modals State
  const [isRulesOpen, setIsRulesOpen] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isFriendsOpen, setIsFriendsOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isAndroidGuideOpen, setIsAndroidGuideOpen] = useState(false);

  // Initialize Capacitor Android Status Bar & Hide Splash Screen when ready
  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      StatusBar.setBackgroundColor({ color: '#98643D' }).catch(() => {});
      StatusBar.setStyle({ style: Style.Dark }).catch(() => {});
      SplashScreen.hide().catch(() => {});
    }
  }, []);

  // Game Shell & Configuration State
  const [screen, setScreen] = useState<GameScreen>('WELCOME');
  const [gameMode, setGameMode] = useState<GameMode>('ai');
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [startingPlayer, setStartingPlayer] = useState<Player>(1);

  // Local / AI Board & Turn State (with offline-safe localStorage persistence)
  const [board, setBoard] = useState<BoardState>(() => {
    try {
      const saved = localStorage.getItem('sholo_guti_local_match_v1');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed?.board) return parsed.board;
      }
    } catch {
      // ignore corrupted local storage
    }
    return createInitialBoard();
  });
  const [currentTurn, setCurrentTurn] = useState<Player>(() => {
    try {
      const saved = localStorage.getItem('sholo_guti_local_match_v1');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed?.currentTurn === 1 || parsed?.currentTurn === 2) {
          return parsed.currentTurn;
        }
      }
    } catch {
      // ignore
    }
    return 1;
  });
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [chainNode, setChainNode] = useState<string | null>(null);
  const [moveHistory, setMoveHistory] = useState<MoveRecord[]>(() => {
    try {
      const saved = localStorage.getItem('sholo_guti_local_match_v1');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed?.moveHistory)) return parsed.moveHistory;
      }
    } catch {
      // ignore
    }
    return [];
  });
  const [lastMove, setLastMove] = useState<{
    from: string;
    to: string;
    capturedNodes: string[];
  } | null>(null);
  const [hintMove, setHintMove] = useState<MoveOption | null>(null);
  const [winner, setWinner] = useState<Player | 'draw' | null>(null);
  const [winReasonKey, setWinReasonKey] = useState<TranslationKey | null>(null);

  // Real-Time Online Multiplayer State (WebSocket)
  const wsRef = useRef<WebSocket | null>(null);
  const [wsConnected, setWsConnected] = useState(false);
  const [onlineUsersMap, setOnlineUsersMap] = useState<
    Record<string, { status: string; username: string }>
  >({});
  const [onlineCount, setOnlineCount] = useState(1);
  const [isSearchingQuickMatch, setIsSearchingQuickMatch] = useState(false);
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [onlineRoom, setOnlineRoom] = useState<OnlineRoomState | null>(null);
  const [myOnlineSeat, setMyOnlineSeat] = useState<Player>(1);
  const [copiedInvite, setCopiedInvite] = useState(false);
  const recordedMatchesRef = useRef<Set<string>>(new Set());

  // UI & Audio Preferences
  const [isMuted, setIsMuted] = useState(false);
  const [showCoordinates, setShowCoordinates] = useState(false);
  const [isAiThinking, setIsAiThinking] = useState(false);
  const [statusState, setStatusState] = useState<{
    key: TranslationKey;
    params?: { from?: string; to?: string; node?: string };
  }>({
    key: 'statusInitial',
  });

  // Sync document lang, dir, and title whenever language changes
  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = isRtl ? 'rtl' : 'ltr';
    document.title = `ষোলো গুটি - Sholo Guti (${t.appTitle})`;
  }, [lang, isRtl, t.appTitle]);

  // Save ongoing local/AI match to localStorage so offline/online transitions never lose progress
  useEffect(() => {
    if (gameMode === 'online') return;
    try {
      localStorage.setItem(
        'sholo_guti_local_match_v1',
        JSON.stringify({
          board,
          currentTurn,
          moveHistory,
          gameMode,
          difficulty,
        })
      );
    } catch {
      // ignore storage quota errors
    }
  }, [board, currentTurn, moveHistory, gameMode, difficulty]);

  // Dynamically compute localized status banner text from statusState + lang
  const statusBannerText = useMemo(() => {
    const rawParams = statusState.params;
    const localizedParams: Record<string, string | number> = {};
    if (rawParams?.from) {
      localizedParams.from = getNodeLabel(rawParams.from, lang);
    }
    if (rawParams?.to) {
      localizedParams.to = getNodeLabel(rawParams.to, lang);
    }
    if (rawParams?.node) {
      localizedParams.node = getNodeLabel(rawParams.node, lang);
    }
    return translate(lang, statusState.key, localizedParams);
  }, [statusState, lang]);

  // Active Board & Turn (Unified for Online vs Local/AI)
  const activeBoard =
    gameMode === 'online' && onlineRoom ? onlineRoom.board : board;
  const activeTurn =
    gameMode === 'online' && onlineRoom ? onlineRoom.currentTurn : currentTurn;
  const activeChainNode =
    gameMode === 'online' && onlineRoom ? onlineRoom.chainNode : chainNode;
  const activeLastMove =
    gameMode === 'online' && onlineRoom ? onlineRoom.lastMove : lastMove;
  const activeWinner =
    gameMode === 'online' && onlineRoom ? onlineRoom.winner : winner;

  const pieceCounts = useMemo(() => countPieces(activeBoard), [activeBoard]);
  const capturedByPlayer1 = 16 - pieceCounts.player2;
  const capturedByPlayer2 = 16 - pieceCounts.player1;

  const player1Name =
    gameMode === 'online' && onlineRoom
      ? `${onlineRoom.player1.username} (${t.greenTag})`
      : profile
      ? `${profile.username} (${t.greenTag})`
      : t.player1Green;

  const player2Name =
    gameMode === 'online' && onlineRoom
      ? onlineRoom.player2
        ? `${onlineRoom.player2.username} (${t.redTag})`
        : t.waitingForOpponent
      : gameMode === 'ai'
      ? t.computerRed
      : t.player2Red;

  // Language switcher with immediate UI update & cloud persistence
  const handleChangeLanguage = async (nextLang: LanguageCode) => {
    setLang(nextLang);
    localStorage.setItem('sholo_guti_lang', nextLang);
    if (profile) {
      setSyncState('saving');
      try {
        await updateCloudProfileDetails(profile.uid, {
          username: profile.username,
          avatar: profile.avatar,
          preferredLanguage: nextLang,
          status: profile.status,
        });
        setProfile((prev) =>
          prev ? { ...prev, preferredLanguage: nextLang } : null
        );
        setSyncState('synced');
      } catch {
        setSyncState('offline');
      }
    }
  };

  // Initialize Firebase Auth & Cloud Listeners
  useEffect(() => {
    let unsubHistory: (() => void) | null = null;
    let unsubFriends: (() => void) | null = null;

    const unsubAuth = initAuthListener(async (user) => {
      setAuthUser(user);
      if (unsubHistory) {
        unsubHistory();
        unsubHistory = null;
      }
      if (unsubFriends) {
        unsubFriends();
        unsubFriends = null;
      }

      if (user) {
        setSyncState('saving');
        try {
          const { profile: loadedProfile, privateData: loadedPrivate } =
            await ensureCloudUserProfile(user, lang, guestStats);
          setProfile(loadedProfile);
          setPrivateData(loadedPrivate);
          if (loadedProfile.preferredLanguage) {
            setLang(loadedProfile.preferredLanguage);
            localStorage.setItem('sholo_guti_lang', loadedProfile.preferredLanguage);
          }
          setSyncState('synced');

          unsubHistory = subscribeToMatchHistory(user.uid, (records) => {
            setCloudMatchHistory(records);
          });
          unsubFriends = subscribeToFriendRequests(user.uid, (reqs) => {
            setFriendRequests(reqs);
          });
        } catch (err) {
          console.error('Failed to sync cloud profile:', err);
          setSyncState('offline');
        }
      } else {
        setProfile(null);
        setPrivateData(null);
        setCloudMatchHistory([]);
        setFriendRequests([]);
      }
    });

    return () => {
      unsubAuth();
      if (unsubHistory) unsubHistory();
      if (unsubFriends) unsubFriends();
    };
  }, []);

  // Connect to Authoritative WebSocket Server for Online Multiplayer & Presence
  useEffect(() => {
    const isNative = Capacitor.isNativePlatform();
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const defaultCloudWs =
      import.meta.env.VITE_BACKEND_WS_URL ||
      'wss://ais-pre-prvcaonqh64gv4fglqel42-787407266981.asia-northeast1.run.app/ws';
    const wsUrl = isNative
      ? defaultCloudWs
      : `${protocol}//${window.location.host}/ws`;
    let reconnectTimer: number | null = null;
    let isUnmounted = false;

    const connectWs = () => {
      if (isUnmounted) return;
      const socket = new WebSocket(wsUrl);
      wsRef.current = socket;

      socket.onopen = () => {
        setWsConnected(true);
        const currentUid = profile?.uid || authUser?.uid || guestId;
        const currentName =
          profile?.username ||
          authUser?.displayName ||
          `${t.guestPrefix}_${guestId.slice(-4)}`;
        const currentAvatar = profile?.avatar || 'emerald_lotus';
        socket.send(
          JSON.stringify({
            type: 'presence:register',
            uid: currentUid,
            username: currentName,
            avatar: currentAvatar,
          })
        );

        // Auto-join room from URL parameter (?room=CODE) if present
        const params = new URLSearchParams(window.location.search);
        const urlRoom = params.get('room');
        if (urlRoom) {
          socket.send(
            JSON.stringify({
              type: 'join_room',
              roomCode: urlRoom.toUpperCase().trim(),
            })
          );
          window.history.replaceState({}, '', window.location.pathname);
        }
      };

      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'presence:list') {
            const map: Record<string, { status: string; username: string }> = {};
            for (const u of data.users || []) {
              map[u.uid] = { status: u.status, username: u.username };
            }
            setOnlineUsersMap(map);
            setOnlineCount(Math.max(1, (data.users || []).length));
          } else if (data.type === 'quick_match:searching') {
            setIsSearchingQuickMatch(true);
          } else if (data.type === 'quick_match:cancelled') {
            setIsSearchingQuickMatch(false);
          } else if (
            data.type === 'room:created' ||
            data.type === 'room:started' ||
            data.type === 'room:state'
          ) {
            setIsSearchingQuickMatch(false);
            const room: OnlineRoomState = data.room;
            setOnlineRoom(room);
            if (data.yourSeat === 1 || data.yourSeat === 2) {
              setMyOnlineSeat(data.yourSeat);
            }
            setGameMode('online');
            setSelectedNode(room.chainNode || null);
            setHintMove(null);

            if (room.status === 'playing' || room.status === 'finished') {
              setScreen('PLAYING');
            } else {
              setScreen('ONLINE_LOBBY');
            }

            if (data.type === 'room:started') {
              soundFX.playSelect();
            } else if (room.lastMove) {
              if (room.lastMove.capturedNodes.length > 0) {
                soundFX.playCapture();
              } else {
                soundFX.playMove();
              }
            }

            // Update status banner for online match
            if (room.winner) {
              soundFX.playVictory();
              setStatusState({ key: 'gameOverTitle' });
            } else if (room.currentTurn === data.yourSeat) {
              setStatusState({
                key: room.chainNode
                  ? 'statusChainAvailable'
                  : 'statusYourTurnOnline',
              });
            } else {
              setStatusState({ key: 'statusOpponentTurnWait' });
            }
          } else if (data.type === 'room:error') {
            if (data.errorKey === 'roomNotFound') {
              setStatusState({ key: 'statusRoomNotFound' });
            } else if (data.errorKey === 'roomFull') {
              setStatusState({ key: 'statusRoomFull' });
            }
          }
        } catch {
          // ignore malformed messages
        }
      };

      socket.onclose = () => {
        setWsConnected(false);
        if (!isUnmounted) {
          reconnectTimer = window.setTimeout(connectWs, 2500);
        }
      };
    };

    connectWs();

    return () => {
      isUnmounted = true;
      if (reconnectTimer) window.clearTimeout(reconnectTimer);
      if (wsRef.current) wsRef.current.close();
    };
  }, [profile?.uid, profile?.username, authUser?.uid, guestId]);

  // Persist Completed Online Match to Cloud Firestore Automatically
  useEffect(() => {
    if (
      gameMode !== 'online' ||
      !onlineRoom ||
      onlineRoom.status !== 'finished' ||
      !onlineRoom.winner
    ) {
      return;
    }

    const matchKey = `${onlineRoom.matchId}_${myOnlineSeat}`;
    if (recordedMatchesRef.current.has(matchKey)) return;
    recordedMatchesRef.current.add(matchKey);

    const result: 'win' | 'loss' | 'draw' =
      onlineRoom.winner === 'draw'
        ? 'draw'
        : onlineRoom.winner === myOnlineSeat
        ? 'win'
        : 'loss';

    const counts = countPieces(onlineRoom.board);
    const ownPieces = myOnlineSeat === 1 ? counts.player1 : counts.player2;
    const oppPieces = myOnlineSeat === 1 ? counts.player2 : counts.player1;
    const oppInfo =
      myOnlineSeat === 1 ? onlineRoom.player2 : onlineRoom.player1;

    if (profile) {
      setSyncState('saving');
      saveMatchResultToCloud(
        profile.uid,
        {
          matchId: onlineRoom.matchId,
          ownerUid: profile.uid,
          opponentUid: oppInfo?.uid || 'online_player',
          opponentName: oppInfo?.username || 'Online Player',
          mode: 'online',
          roomCode: onlineRoom.roomCode,
          playerNumber: myOnlineSeat,
          result,
          reason: onlineRoom.winReasonKey || 'match_completed',
          totalMoves: onlineRoom.moveHistory.length,
          remainingOwnPieces: ownPieces,
          remainingOpponentPieces: oppPieces,
        },
        profile
      )
        .then((updated) => {
          setProfile(updated);
          setSyncState('synced');
        })
        .catch(() => setSyncState('offline'));
    } else {
      setGuestStats((prev) => ({
        gamesPlayed: prev.gamesPlayed + 1,
        wins: prev.wins + (result === 'win' ? 1 : 0),
        losses: prev.losses + (result === 'loss' ? 1 : 0),
        draws: prev.draws + (result === 'draw' ? 1 : 0),
      }));
    }
  }, [gameMode, onlineRoom, myOnlineSeat, profile]);

  // Valid moves for the currently selected piece
  const validMovesForSelected = useMemo(() => {
    if (!selectedNode || activeWinner) return [];
    if (gameMode === 'online' && onlineRoom) {
      if (onlineRoom.currentTurn !== myOnlineSeat) return [];
      if (onlineRoom.chainNode && selectedNode !== onlineRoom.chainNode) return [];
      return getLegalMovesForNode(
        onlineRoom.board,
        selectedNode,
        myOnlineSeat,
        Boolean(onlineRoom.chainNode)
      );
    }
    if (chainNode && selectedNode !== chainNode) return [];
    return getLegalMovesForNode(board, selectedNode, currentTurn, Boolean(chainNode));
  }, [
    selectedNode,
    activeWinner,
    gameMode,
    onlineRoom,
    myOnlineSeat,
    chainNode,
    board,
    currentTurn,
  ]);

  // Toggle sound mute
  const handleToggleMute = () => {
    const next = !isMuted;
    setIsMuted(next);
    soundFX.muted = next;
  };

  // Start or Restart Local / AI Match
  const startNewLocalOrAiMatch = useCallback(
    (mode: 'ai' | 'local', firstTurn = startingPlayer) => {
      const freshBoard = createInitialBoard();
      setGameMode(mode);
      setBoard(freshBoard);
      setCurrentTurn(firstTurn);
      setSelectedNode(null);
      setChainNode(null);
      setMoveHistory([]);
      setLastMove(null);
      setHintMove(null);
      setWinner(null);
      setWinReasonKey(null);
      setIsAiThinking(false);
      setScreen('PLAYING');

      const starterKey: TranslationKey =
        firstTurn === 1
          ? 'statusP1Turn'
          : mode === 'ai'
          ? 'statusAiFirst'
          : 'statusP2Turn';
      setStatusState({ key: starterKey });
    },
    [startingPlayer]
  );

  // Record finished AI/Local match to Cloud Firestore
  const recordLocalOrAiMatchCompletion = useCallback(
    (winningPlayer: Player, reasonText: string, finalBoard: BoardState, movesCount: number) => {
      const counts = countPieces(finalBoard);
      const result: 'win' | 'loss' = winningPlayer === 1 ? 'win' : 'loss';
      const matchId = `local_${Date.now()}`;

      if (profile) {
        setSyncState('saving');
        saveMatchResultToCloud(
          profile.uid,
          {
            matchId,
            ownerUid: profile.uid,
            opponentUid: gameMode === 'ai' ? `ai_${difficulty}` : 'local_player_2',
            opponentName:
              gameMode === 'ai' ? `AI (${difficulty})` : 'Player 2 (Local)',
            mode: gameMode === 'ai' ? 'ai' : 'local',
            roomCode: 'LOCAL',
            playerNumber: 1,
            result,
            reason: reasonText,
            totalMoves: movesCount,
            remainingOwnPieces: counts.player1,
            remainingOpponentPieces: counts.player2,
          },
          profile
        )
          .then((updated) => {
            setProfile(updated);
            setSyncState('synced');
          })
          .catch(() => setSyncState('offline'));
      } else {
        setGuestStats((prev) => ({
          gamesPlayed: prev.gamesPlayed + 1,
          wins: prev.wins + (result === 'win' ? 1 : 0),
          losses: prev.losses + (result === 'loss' ? 1 : 0),
          draws: prev.draws,
        }));
      }
    },
    [profile, gameMode, difficulty]
  );

  // Execute Local / AI Move
  const executeMove = useCallback(
    (
      move: MoveOption,
      currentBoard: BoardState,
      activeTurnPlayer: Player,
      activeChain: string | null
    ) => {
      const snapshotBoard = { ...currentBoard };
      const { nextBoard, hasFurtherCapture } = applyMove(currentBoard, move);

      const fromLabel = NODE_MAP[move.from]?.labelBn || move.from;
      const toLabel = NODE_MAP[move.to]?.labelBn || move.to;

      const capturedList = move.capturedNode ? [move.capturedNode] : [];

      if (move.type === 'capture') {
        soundFX.playCapture();
      } else {
        soundFX.playMove();
      }

      const descriptionBn = `${fromLabel} → ${toLabel}`;

      const nextMovesCount = moveHistory.length + 1;
      const record: MoveRecord = {
        moveNumber: nextMovesCount,
        player: activeTurnPlayer,
        from: move.from,
        to: move.to,
        type: move.type,
        capturedNodes: capturedList,
        descriptionBn,
        boardSnapshot: snapshotBoard,
        turnSnapshot: activeTurnPlayer,
        chainNodeSnapshot: activeChain,
      };

      setBoard(nextBoard);
      setMoveHistory((prev) => [record, ...prev]);
      setLastMove({ from: move.from, to: move.to, capturedNodes: capturedList });
      setHintMove(null);

      // Check multi-jump chain capture
      if (move.type === 'capture' && hasFurtherCapture) {
        const remaining = countPieces(nextBoard);
        if (remaining.player1 === 0 || remaining.player2 === 0) {
          const endResult = checkGameWinner(
            nextBoard,
            activeTurnPlayer === 1 ? 2 : 1
          );
          if (endResult.winner) {
            setWinner(endResult.winner);
            setWinReasonKey(endResult.reasonKey);
            setChainNode(null);
            setSelectedNode(null);
            soundFX.playVictory();
            recordLocalOrAiMatchCompletion(
              endResult.winner,
              endResult.reasonKey || 'All pieces captured',
              nextBoard,
              nextMovesCount
            );
          }
          return;
        }

        setChainNode(move.to);
        setSelectedNode(move.to);
        setStatusState({
          key:
            activeTurnPlayer === 1 || gameMode === 'local'
              ? 'statusChainAvailable'
              : 'statusAiChain',
        });
        return;
      }

      // Switch turn
      const nextTurn: Player = activeTurnPlayer === 1 ? 2 : 1;
      setChainNode(null);
      setSelectedNode(null);

      const endCheck = checkGameWinner(nextBoard, nextTurn);
      if (endCheck.winner) {
        setWinner(endCheck.winner);
        setWinReasonKey(endCheck.reasonKey);
        setCurrentTurn(nextTurn);
        soundFX.playVictory();
        setStatusState({ key: endCheck.reasonKey || 'gameOverTitle' });
        recordLocalOrAiMatchCompletion(
          endCheck.winner,
          endCheck.reasonKey || 'Match finished',
          nextBoard,
          nextMovesCount
        );
        return;
      }

      setCurrentTurn(nextTurn);
      if (nextTurn === 1) {
        setStatusState({ key: 'statusP1Turn' });
      } else if (gameMode === 'ai') {
        setStatusState({ key: 'statusAiThinking' });
      } else {
        setStatusState({ key: 'statusP2Turn' });
      }
    },
    [gameMode, moveHistory.length, recordLocalOrAiMatchCompletion]
  );

  // End Chain Capture Turn (Online or Local)
  const handleEndChainTurn = () => {
    if (gameMode === 'online' && onlineRoom) {
      wsRef.current?.send(
        JSON.stringify({
          type: 'end_chain_turn',
          roomCode: onlineRoom.roomCode,
        })
      );
      return;
    }

    if (!chainNode || winner) return;
    const nextTurn: Player = currentTurn === 1 ? 2 : 1;
    setChainNode(null);
    setSelectedNode(null);
    setHintMove(null);

    const endCheck = checkGameWinner(board, nextTurn);
    if (endCheck.winner) {
      setWinner(endCheck.winner);
      setWinReasonKey(endCheck.reasonKey);
      setCurrentTurn(nextTurn);
      soundFX.playVictory();
      return;
    }

    setCurrentTurn(nextTurn);
    setStatusState({
      key:
        nextTurn === 1
          ? 'statusP1Turn'
          : gameMode === 'ai'
          ? 'statusAiThinking'
          : 'statusP2Turn',
    });
  };

  // AI Turn Effect
  useEffect(() => {
    if (
      screen !== 'PLAYING' ||
      gameMode !== 'ai' ||
      currentTurn !== 2 ||
      winner !== null
    ) {
      setIsAiThinking(false);
      return;
    }

    setIsAiThinking(true);
    const delayMs = chainNode ? 480 : 620;
    const timer = window.setTimeout(() => {
      const aiMove = chooseBestMove(board, 2, difficulty, chainNode);
      if (aiMove) {
        executeMove(aiMove, board, 2, chainNode);
      } else if (chainNode) {
        setChainNode(null);
        setSelectedNode(null);
        setCurrentTurn(1);
      }
      setIsAiThinking(false);
    }, delayMs);

    return () => window.clearTimeout(timer);
  }, [screen, gameMode, currentTurn, winner, board, difficulty, chainNode, executeMove]);

  // Handle Board Node Click (Supports Online Authoritative Server & Local/AI)
  const handleNodeClick = (nodeId: string) => {
    if (activeWinner || isAiThinking) return;

    // ONLINE MULTIPLAYER MODE
    if (gameMode === 'online' && onlineRoom) {
      if (onlineRoom.status !== 'playing') return;
      if (onlineRoom.currentTurn !== myOnlineSeat) {
        setStatusState({ key: 'statusOpponentTurnWait' });
        return;
      }

      if (selectedNode) {
        const chosenMove = validMovesForSelected.find((m) => m.to === nodeId);
        if (chosenMove) {
          wsRef.current?.send(
            JSON.stringify({
              type: 'submit_move',
              roomCode: onlineRoom.roomCode,
              from: chosenMove.from,
              to: chosenMove.to,
            })
          );
          setSelectedNode(null);
          return;
        }
      }

      if (onlineRoom.chainNode) {
        if (nodeId === onlineRoom.chainNode) {
          soundFX.playSelect();
          setSelectedNode(onlineRoom.chainNode);
        }
        return;
      }

      if (onlineRoom.board[nodeId] === myOnlineSeat) {
        soundFX.playSelect();
        setSelectedNode((prev) => (prev === nodeId ? null : nodeId));
      }
      return;
    }

    // LOCAL / AI MODE
    if (gameMode === 'ai' && currentTurn === 2) return;

    if (selectedNode) {
      const chosenMove = validMovesForSelected.find((m) => m.to === nodeId);
      if (chosenMove) {
        executeMove(chosenMove, board, currentTurn, chainNode);
        return;
      }
    }

    if (chainNode) {
      if (nodeId === chainNode) {
        soundFX.playSelect();
        setSelectedNode(chainNode);
      }
      return;
    }

    if (board[nodeId] === currentTurn) {
      soundFX.playSelect();
      setHintMove(null);
      if (selectedNode === nodeId) {
        setSelectedNode(null);
      } else {
        setSelectedNode(nodeId);
        const moves = getLegalMovesForNode(board, nodeId, currentTurn, false);
        if (moves.length === 0) {
          setStatusState({ key: 'statusPieceNoMoves' });
        } else {
          setStatusState({
            key: 'statusPieceSelected',
            params: { node: nodeId },
          });
        }
      }
    }
  };

  // Undo Move (Local / AI only)
  const handleUndoMove = () => {
    if (gameMode === 'online' || moveHistory.length === 0 || isAiThinking) return;

    let targetIndex = 0;
    if (gameMode === 'ai') {
      const p1Idx = moveHistory.findIndex((m) => m.player === 1);
      if (p1Idx !== -1) targetIndex = p1Idx;
    }

    const targetRecord = moveHistory[targetIndex];
    setBoard(targetRecord.boardSnapshot);
    setCurrentTurn(targetRecord.turnSnapshot);
    setChainNode(targetRecord.chainNodeSnapshot);
    setSelectedNode(targetRecord.chainNodeSnapshot);
    setMoveHistory((prev) => prev.slice(targetIndex + 1));
    setLastMove(null);
    setHintMove(null);
    setWinner(null);
    setWinReasonKey(null);
    soundFX.playSelect();
    setStatusState({ key: 'statusMoveUndone' });
  };

  // Show Hint
  const handleShowHint = () => {
    if (activeWinner || isAiThinking) return;
    if (gameMode === 'online') return;
    if (gameMode === 'ai' && currentTurn === 2) return;
    const suggested = chooseBestMove(board, currentTurn, 'hard', chainNode);
    if (suggested) {
      setHintMove(suggested);
      setSelectedNode(suggested.from);
      soundFX.playSelect();
      setStatusState({
        key: 'statusHint',
        params: { from: suggested.from, to: suggested.to },
      });
    }
  };

  // Online Lobby Handlers
  const handleQuickMatch = () => {
    wsRef.current?.send(JSON.stringify({ type: 'quick_match' }));
  };

  const handleCancelQuickMatch = () => {
    wsRef.current?.send(JSON.stringify({ type: 'cancel_quick_match' }));
  };

  const handleCreatePrivateRoom = () => {
    wsRef.current?.send(JSON.stringify({ type: 'create_room' }));
  };

  const handleJoinRoomByCode = (codeToJoin: string) => {
    const clean = codeToJoin.trim().toUpperCase();
    if (!clean) return;
    setScreen('ONLINE_LOBBY');
    wsRef.current?.send(JSON.stringify({ type: 'join_room', roomCode: clean }));
  };

  const handleCopyInviteLink = () => {
    if (!onlineRoom) return;
    const inviteUrl = `${window.location.origin}${window.location.pathname}?room=${onlineRoom.roomCode}`;
    navigator.clipboard.writeText(inviteUrl).catch(() => {});
    setCopiedInvite(true);
    window.setTimeout(() => setCopiedInvite(false), 2000);
  };

  return (
    <div
      dir={isRtl ? 'rtl' : 'ltr'}
      className="min-h-screen flex flex-col bg-[#FAF4E8] text-[#3D2516]"
    >
      {/* Top Bar following the strict 3-Zone Contract */}
      <header className="flex items-center justify-between gap-4 sm:gap-8 px-4 sm:px-8 py-3.5 bg-[#F2E5CE] border-b border-[#D2B68E] shadow-xs">
        {/* Zone 1: Brand Title */}
        <a
          href="#top"
          onClick={(e) => {
            e.preventDefault();
            setScreen('WELCOME');
          }}
          className="text-xl sm:text-2xl font-bold font-serif-bn text-[#3D2516] tracking-tight whitespace-nowrap shrink-0"
        >
          {t.appTitle}
        </a>

        {/* Zone 2: 5 Concise Single-Line Navigation Links */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-semibold text-[#5C3A21]">
          <button
            onClick={() => setScreen('WELCOME')}
            className="hover:text-[#168653] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            {t.navHome}
          </button>
          <button
            onClick={() => {
              setGameMode('online');
              setScreen('ONLINE_LOBBY');
            }}
            className="hover:text-[#168653] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            {t.navOnline}
          </button>
          <button
            onClick={() => setIsFriendsOpen(true)}
            className="hover:text-[#168653] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            {t.navFriends}
          </button>
          <button
            onClick={() => setIsProfileOpen(true)}
            className="hover:text-[#168653] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            {t.navProfile}
          </button>
          <button
            onClick={() => setIsRulesOpen(true)}
            className="hover:text-[#168653] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            {t.navRules}
          </button>
        </nav>

        {/* Zone 3: Language, Android App Install & Account Action */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <PWAInstallButton
            onOpenAndroidGuide={() => setIsAndroidGuideOpen(true)}
            t={t}
          />

          <select
            aria-label={t.languageSelectAria}
            value={lang}
            onChange={(e) => handleChangeLanguage(e.target.value as LanguageCode)}
            className="px-2 sm:px-2.5 py-1.5 rounded-lg bg-[#FAF3E4] border border-[#C2A073] text-xs sm:text-sm font-bold text-[#3D2516] cursor-pointer max-w-[115px] sm:max-w-none"
          >
            {SUPPORTED_LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>
                {l.nativeName}
              </option>
            ))}
          </select>

          {profile ? (
            <button
              onClick={() => setIsProfileOpen(true)}
              className="px-3.5 py-2 text-xs sm:text-sm font-bold rounded-lg bg-[#168653] hover:bg-[#126E44] text-white transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <UserCheck className="w-4 h-4" />
              <span className="max-w-[110px] truncate">{profile.username}</span>
            </button>
          ) : (
            <button
              onClick={() => setIsAuthOpen(true)}
              className="px-3.5 py-2 text-xs sm:text-sm font-bold rounded-lg bg-[#98643D] hover:bg-[#82522E] text-white transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <LogIn className="w-4 h-4" />
              <span>{t.authSignInBtn}</span>
            </button>
          )}
        </div>
      </header>

      {/* Sub-bar for Mobile Navigation & Cloud Sync Status */}
      <div className="bg-[#EFE0C4] border-b border-[#D8C09A] px-4 py-2 flex flex-wrap items-center justify-between gap-2 text-xs text-[#5C3A21]">
        <div className="flex items-center gap-3 overflow-x-auto">
          <button
            onClick={() => setScreen('WELCOME')}
            className="md:hidden font-bold hover:text-[#168653] whitespace-nowrap cursor-pointer"
          >
            {t.navHome}
          </button>
          <button
            onClick={() => {
              setGameMode('online');
              setScreen('ONLINE_LOBBY');
            }}
            className="md:hidden font-bold hover:text-[#168653] whitespace-nowrap cursor-pointer"
          >
            {t.navOnline}
          </button>
          <button
            onClick={() => setIsFriendsOpen(true)}
            className="md:hidden font-bold hover:text-[#168653] whitespace-nowrap cursor-pointer"
          >
            {t.navFriends}
          </button>
          <button
            onClick={() => setIsProfileOpen(true)}
            className="md:hidden font-bold hover:text-[#168653] whitespace-nowrap cursor-pointer"
          >
            {t.navProfile}
          </button>
          <button
            onClick={() => setIsRulesOpen(true)}
            className="md:hidden font-bold hover:text-[#168653] whitespace-nowrap cursor-pointer"
          >
            {t.navRules}
          </button>

          <span className="hidden md:inline font-medium">
            {profile
              ? `${
                  syncState === 'saving'
                    ? t.syncStatusSaving
                    : syncState === 'offline'
                    ? t.syncStatusOffline
                    : t.syncStatusSynced
                } · ${t.statsWins}: ${formatNumber(profile.wins, lang)}`
              : t.guestBanner}
          </span>
        </div>

        <div className="flex items-center gap-3 ml-auto">
          <span>
            {t.onlinePlayersCount}: {formatNumber(onlineCount, lang)}
          </span>
          <button
            onClick={handleToggleMute}
            className="font-bold text-[#3D2516] hover:text-[#168653] flex items-center gap-1 cursor-pointer"
          >
            {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
            <span>{isMuted ? t.soundOff : t.soundOn}</span>
          </button>
          {profile && (
            <button
              onClick={signOutUser}
              className="font-bold text-[#C93636] hover:underline flex items-center gap-1 cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>{t.authSignOut}</span>
            </button>
          )}
        </div>
      </div>

      {/* SCREEN 1: WELCOME / HOME SCREEN */}
      {screen === 'WELCOME' && (
        <main className="flex-1 flex items-center justify-center px-4 py-8 sm:py-10">
          <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-12 gap-8 items-center bg-[#F5E8CF] border-2 border-[#98643D] rounded-3xl p-6 sm:p-10 shadow-[0_16px_40px_rgba(92,58,33,0.14)]">
            {/* Left Column: Heritage Emblem & Overview */}
            <div className="lg:col-span-6 space-y-5 text-center lg:text-left">
              <div className="mx-auto lg:mx-0 w-28 h-28 sm:w-32 sm:h-32 rounded-2xl bg-[#FAF3E4] border-2 border-[#98643D] p-3 flex items-center justify-center shadow-sm">
                <svg viewBox="0 0 120 120" className="w-full h-full">
                  <polygon
                    points="30,14 90,14 60,42"
                    fill="none"
                    stroke="#916B43"
                    strokeWidth="2.5"
                  />
                  <rect
                    x="22"
                    y="42"
                    width="76"
                    height="36"
                    fill="none"
                    stroke="#916B43"
                    strokeWidth="2.5"
                  />
                  <line x1="22" y1="60" x2="98" y2="60" stroke="#916B43" strokeWidth="2" />
                  <line x1="60" y1="14" x2="60" y2="106" stroke="#916B43" strokeWidth="2" />
                  <polygon
                    points="60,78 30,106 90,106"
                    fill="none"
                    stroke="#916B43"
                    strokeWidth="2.5"
                  />
                  <circle cx="60" cy="26" r="7" fill="#C93636" stroke="#7A1A1A" strokeWidth="1.5" />
                  <circle cx="38" cy="42" r="7" fill="#C93636" stroke="#7A1A1A" strokeWidth="1.5" />
                  <circle cx="82" cy="42" r="7" fill="#C93636" stroke="#7A1A1A" strokeWidth="1.5" />
                  <circle cx="60" cy="60" r="5" fill="#F5E8CF" stroke="#D99B26" strokeWidth="2.2" />
                  <circle cx="38" cy="78" r="7" fill="#168653" stroke="#0B4F30" strokeWidth="1.5" />
                  <circle cx="82" cy="78" r="7" fill="#168653" stroke="#0B4F30" strokeWidth="1.5" />
                  <circle cx="60" cy="94" r="7" fill="#168653" stroke="#0B4F30" strokeWidth="1.5" />
                </svg>
              </div>

              <div className="space-y-2">
                <p className="text-sm text-[#168653] font-bold">{t.appSubtitle}</p>
                <h1 className="text-3xl sm:text-5xl font-bold font-serif-bn text-[#3D2516] tracking-tight">
                  {t.appTitle}
                </h1>
              </div>

              <p className="text-[#5C3A21] text-base sm:text-lg leading-relaxed">
                {t.appDescription}
              </p>

              <div className="flex flex-wrap items-center justify-center lg:justify-start gap-2.5 pt-1">
                <button
                  onClick={() => setIsProfileOpen(true)}
                  className="px-4 py-2 rounded-xl bg-[#FAF3E4] hover:bg-[#EDE0C4] border border-[#C8A97E] text-xs sm:text-sm font-bold text-[#3D2516] cursor-pointer"
                >
                  {t.navProfile}
                </button>
                <button
                  onClick={() => setIsFriendsOpen(true)}
                  className="px-4 py-2 rounded-xl bg-[#FAF3E4] hover:bg-[#EDE0C4] border border-[#C8A97E] text-xs sm:text-sm font-bold text-[#3D2516] cursor-pointer"
                >
                  {t.navFriends}
                </button>
                <button
                  onClick={() => setIsRulesOpen(true)}
                  className="px-4 py-2 rounded-xl bg-[#FAF3E4] hover:bg-[#EDE0C4] border border-[#C8A97E] text-xs sm:text-sm font-bold text-[#3D2516] cursor-pointer"
                >
                  {t.navRules}
                </button>
              </div>
            </div>

            {/* Right Column: Mode Setup */}
            <div className="lg:col-span-6 bg-[#FAF3E4] border border-[#C8A97E] rounded-2xl p-5 sm:p-6 space-y-5 shadow-xs">
              <div className="space-y-2">
                <label className="block text-sm font-bold text-[#3D2516]">
                  {t.modeSelectTitle}
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setGameMode('online')}
                    className={`flex items-center justify-center gap-2 px-3 py-3 rounded-xl border text-xs sm:text-sm font-bold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                      gameMode === 'online'
                        ? 'bg-[#168653] border-[#0E5C38] text-white shadow-xs'
                        : 'bg-[#F5E8CF] border-[#C8A97E] text-[#5C3A21] hover:bg-[#EDE0C4]'
                    }`}
                  >
                    <Globe className="w-4 h-4 shrink-0" />
                    <span>{t.modeOnline}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setGameMode('ai')}
                    className={`flex items-center justify-center gap-2 px-3 py-3 rounded-xl border text-xs sm:text-sm font-bold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                      gameMode === 'ai'
                        ? 'bg-[#168653] border-[#0E5C38] text-white shadow-xs'
                        : 'bg-[#F5E8CF] border-[#C8A97E] text-[#5C3A21] hover:bg-[#EDE0C4]'
                    }`}
                  >
                    <Cpu className="w-4 h-4 shrink-0" />
                    <span>{t.modeAi}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setGameMode('local')}
                    className={`flex items-center justify-center gap-2 px-3 py-3 rounded-xl border text-xs sm:text-sm font-bold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                      gameMode === 'local'
                        ? 'bg-[#168653] border-[#0E5C38] text-white shadow-xs'
                        : 'bg-[#F5E8CF] border-[#C8A97E] text-[#5C3A21] hover:bg-[#EDE0C4]'
                    }`}
                  >
                    <Users className="w-4 h-4 shrink-0" />
                    <span>{t.modeLocal}</span>
                  </button>
                </div>
              </div>

              {gameMode === 'ai' && (
                <div className="space-y-2">
                  <label className="block text-sm font-bold text-[#3D2516]">
                    {t.difficultyTitle}
                  </label>
                  <div className="grid grid-cols-3 gap-2.5">
                    {(['easy', 'medium', 'hard'] as Difficulty[]).map((level) => (
                      <button
                        key={level}
                        type="button"
                        onClick={() => setDifficulty(level)}
                        className={`px-3 py-2.5 rounded-lg border text-sm font-bold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                          difficulty === level
                            ? 'bg-[#98643D] border-[#7A4B28] text-white'
                            : 'bg-[#F5E8CF] border-[#C8A97E] text-[#5C3A21] hover:bg-[#EDE0C4]'
                        }`}
                      >
                        {level === 'easy'
                          ? t.diffEasy
                          : level === 'medium'
                          ? t.diffMedium
                          : t.diffHard}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {gameMode !== 'online' && (
                <div className="space-y-2">
                  <label className="block text-sm font-bold text-[#3D2516]">
                    {t.firstTurnTitle}
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setStartingPlayer(1)}
                      className={`px-3 py-2.5 rounded-lg border text-xs sm:text-sm font-bold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                        startingPlayer === 1
                          ? 'bg-[#168653] border-[#0E5C38] text-white'
                          : 'bg-[#F5E8CF] border-[#C8A97E] text-[#5C3A21] hover:bg-[#EDE0C4]'
                      }`}
                    >
                      {t.player1Green}
                    </button>
                    <button
                      type="button"
                      onClick={() => setStartingPlayer(2)}
                      className={`px-3 py-2.5 rounded-lg border text-xs sm:text-sm font-bold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                        startingPlayer === 2
                          ? 'bg-[#C93636] border-[#8F1F1F] text-white'
                          : 'bg-[#F5E8CF] border-[#C8A97E] text-[#5C3A21] hover:bg-[#EDE0C4]'
                      }`}
                    >
                      {gameMode === 'ai' ? t.computerRed : t.player2Red}
                    </button>
                  </div>
                </div>
              )}

              <div className="pt-2 space-y-3">
                <button
                  type="button"
                  onClick={() => {
                    if (gameMode === 'online') {
                      setScreen('ONLINE_LOBBY');
                    } else {
                      startNewLocalOrAiMatch(gameMode, startingPlayer);
                    }
                  }}
                  className="w-full py-3.5 px-6 rounded-xl bg-[#168653] hover:bg-[#126E44] text-white font-bold text-lg shadow-md transition-colors flex items-center justify-center gap-2.5 cursor-pointer whitespace-nowrap shrink-0"
                >
                  <Play className="w-5 h-5 fill-current" />
                  <span>
                    {gameMode === 'online' ? t.navOnline : t.startGameBtn}
                  </span>
                </button>

                {!profile && (
                  <button
                    type="button"
                    onClick={() => setIsAuthOpen(true)}
                    className="w-full py-2.5 px-4 rounded-xl bg-[#F5E8CF] hover:bg-[#EAD8B6] border border-[#C8A97E] text-[#3D2516] font-bold text-sm transition-colors flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap shrink-0"
                  >
                    <LogIn className="w-4 h-4 text-[#168653]" />
                    <span>
                      {t.authSignInBtn} / {t.authSignUpBtn}
                    </span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </main>
      )}

      {/* SCREEN 2: WORLDWIDE ONLINE MULTIPLAYER LOBBY */}
      {screen === 'ONLINE_LOBBY' && (
        <main className="flex-1 flex items-center justify-center px-4 py-8">
          <div className="w-full max-w-3xl bg-[#F5E8CF] border-2 border-[#98643D] rounded-3xl p-6 sm:p-8 space-y-6 shadow-xl">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-[#D8C09A]">
              <div className="flex items-center gap-3">
                <Globe className="w-7 h-7 text-[#168653]" />
                <div>
                  <h2 className="text-xl sm:text-2xl font-bold font-serif-bn text-[#3D2516]">
                    {t.onlineHubTitle}
                  </h2>
                  <p className="text-xs font-semibold text-[#6B4628]">
                    {t.serverStatusLabel}:{' '}
                    {wsConnected
                      ? t.serverStatusConnected
                      : t.serverStatusConnecting}{' '}
                    · {t.onlinePlayersCount}: {formatNumber(onlineCount, lang)}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsFriendsOpen(true)}
                className="px-4 py-2 rounded-xl bg-[#FAF3E4] hover:bg-[#EDE0C4] border border-[#C2A073] text-xs font-bold text-[#3D2516] flex items-center gap-2 cursor-pointer"
              >
                <Users className="w-4 h-4 text-[#168653]" />
                <span>{t.navFriends}</span>
              </button>
            </div>

            {/* Active Waiting Private Room */}
            {onlineRoom && onlineRoom.status === 'waiting' && (
              <div className="p-6 rounded-2xl bg-[#FAF3E4] border-2 border-[#168653] text-center space-y-4">
                <p className="text-xs font-bold text-[#168653] uppercase tracking-wider">
                  {t.roomCodeLabel}
                </p>
                <p className="text-3xl sm:text-4xl font-mono font-bold tracking-widest text-[#3D2516]">
                  {onlineRoom.roomCode}
                </p>
                <p className="text-sm font-medium text-[#5C3A21]">
                  {t.waitingForOpponent}
                </p>
                <div className="flex flex-wrap items-center justify-center gap-3">
                  <button
                    onClick={handleCopyInviteLink}
                    className="px-5 py-2.5 rounded-xl bg-[#168653] hover:bg-[#126E44] text-white font-bold text-xs sm:text-sm flex items-center gap-2 cursor-pointer"
                  >
                    <Copy className="w-4 h-4" />
                    <span>{copiedInvite ? t.copiedText : t.copyInviteLink}</span>
                  </button>
                  <button
                    onClick={() => setIsFriendsOpen(true)}
                    className="px-4 py-2.5 rounded-xl bg-[#F5E8CF] hover:bg-[#EAD8B6] border border-[#C2A073] text-[#3D2516] font-bold text-xs sm:text-sm flex items-center gap-2 cursor-pointer"
                  >
                    <Share2 className="w-4 h-4 text-[#98643D]" />
                    <span>{t.inviteToRoomBtn}</span>
                  </button>
                </div>
              </div>
            )}

            {/* Quick Match & Private Room Creation */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-5 rounded-2xl bg-[#FAF3E4] border border-[#C8A97E] flex flex-col justify-between space-y-4">
                <div className="space-y-1.5">
                  <h3 className="font-bold text-lg text-[#3D2516]">
                    {t.quickMatchBtn}
                  </h3>
                  <p className="text-xs text-[#6B4628]">
                    {t.quickMatchDesc}
                  </p>
                </div>

                {isSearchingQuickMatch ? (
                  <div className="space-y-2">
                    <p className="text-xs font-bold text-[#168653]">
                      {t.searchingOpponent}
                    </p>
                    <button
                      onClick={handleCancelQuickMatch}
                      className="w-full py-2.5 px-4 rounded-xl bg-[#C93636] hover:bg-[#9E2424] text-white font-bold text-sm cursor-pointer"
                    >
                      {t.cancelSearchBtn}
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={handleQuickMatch}
                    className="w-full py-3 px-5 rounded-xl bg-[#168653] hover:bg-[#126E44] text-white font-bold text-sm cursor-pointer"
                  >
                    {t.quickMatchBtn}
                  </button>
                )}
              </div>

              <div className="p-5 rounded-2xl bg-[#FAF3E4] border border-[#C8A97E] flex flex-col justify-between space-y-4">
                <div className="space-y-1.5">
                  <h3 className="font-bold text-lg text-[#3D2516]">
                    {t.createPrivateRoomBtn}
                  </h3>
                  <p className="text-xs text-[#6B4628]">
                    {t.privateRoomDesc}
                  </p>
                </div>
                <button
                  onClick={handleCreatePrivateRoom}
                  className="w-full py-3 px-5 rounded-xl bg-[#98643D] hover:bg-[#82522E] text-white font-bold text-sm cursor-pointer"
                >
                  {t.createPrivateRoomBtn}
                </button>
              </div>
            </div>

            {/* Join Room by Code */}
            <div className="p-5 rounded-2xl bg-[#FAF3E4] border border-[#C8A97E] flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                maxLength={12}
                value={joinCodeInput}
                onChange={(e) => setJoinCodeInput(e.target.value.toUpperCase())}
                placeholder={t.joinRoomPlaceholder}
                className="flex-1 px-4 py-2.5 rounded-xl bg-[#F5E8CF] border border-[#C8A97E] text-sm font-mono font-bold text-[#3D2516] uppercase"
              />
              <button
                onClick={() => handleJoinRoomByCode(joinCodeInput)}
                className="px-6 py-2.5 rounded-xl bg-[#168653] hover:bg-[#126E44] text-white font-bold text-sm cursor-pointer whitespace-nowrap shrink-0"
              >
                {t.joinRoomBtn}
              </button>
            </div>
          </div>
        </main>
      )}

      {/* SCREEN 3: ACTIVE GAME VIEW (ONLINE, AI, OR LOCAL) */}
      {screen === 'PLAYING' && (
        <main className="flex-1 max-w-[1380px] w-full mx-auto px-3 sm:px-6 py-4 sm:py-6 grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* Left Panel: Player 1 & Player 2 Cards + Controls */}
          <section className="lg:col-span-3 space-y-4 order-2 lg:order-1">
            {/* Player 1 Card (Bottom Camp — Emerald Green #168653) */}
            <div
              className={`rounded-2xl p-4 border-2 transition-all ${
                activeTurn === 1 && !activeWinner
                  ? 'bg-[#E9F7F0] border-[#168653] shadow-md'
                  : 'bg-[#F5E8CF] border-[#C8A97E]'
              }`}
            >
              <div className="flex items-center justify-between gap-2 mb-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="w-5 h-5 rounded-full bg-[#168653] border-2 border-[#0B4F30] shrink-0 shadow-xs" />
                  <h2 className="font-bold text-base text-[#145337] truncate">
                    {player1Name}
                  </h2>
                </div>
                {activeTurn === 1 && !activeWinner && (
                  <span className="text-xs font-bold text-[#168653] whitespace-nowrap shrink-0">
                    {t.currentTurn}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm bg-[#FAF3E4] rounded-xl p-3 border border-[#D8C09A]">
                <div>
                  <p className="text-xs font-medium text-[#6B4628]">
                    {t.remainingPieces}
                  </p>
                  <p className="text-xl font-bold text-[#168653] tabular-nums">
                    {formatNumber(pieceCounts.player1, lang)}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-[#6B4628]">
                    {t.capturedPieces}
                  </p>
                  <p className="text-xl font-bold text-[#98643D] tabular-nums">
                    {formatNumber(capturedByPlayer1, lang)}
                  </p>
                </div>
              </div>

              <div className="mt-3">
                <div className="flex flex-wrap gap-1.5 min-h-[18px]">
                  {Array.from({ length: 16 }).map((_, i) => (
                    <span
                      key={i}
                      className={`w-3.5 h-3.5 rounded-full border ${
                        i < capturedByPlayer1
                          ? 'bg-[#C93636] border-[#7A1A1A]'
                          : 'bg-[#E8D6B5] border-[#C9AE84]'
                      }`}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Player 2 Card (Top Camp — Deep Red #C93636) */}
            <div
              className={`rounded-2xl p-4 border-2 transition-all ${
                activeTurn === 2 && !activeWinner
                  ? 'bg-[#FDF0F0] border-[#C93636] shadow-md'
                  : 'bg-[#F5E8CF] border-[#C8A97E]'
              }`}
            >
              <div className="flex items-center justify-between gap-2 mb-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="w-5 h-5 rounded-full bg-[#C93636] border-2 border-[#7A1A1A] shrink-0 shadow-xs" />
                  <h2 className="font-bold text-base text-[#7A1A1A] truncate">
                    {player2Name}
                  </h2>
                </div>
                {activeTurn === 2 && !activeWinner && (
                  <span className="text-xs font-bold text-[#C93636] whitespace-nowrap shrink-0">
                    {isAiThinking ? t.thinking : t.currentTurn}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm bg-[#FAF3E4] rounded-xl p-3 border border-[#D8C09A]">
                <div>
                  <p className="text-xs font-medium text-[#6B4628]">
                    {t.remainingPieces}
                  </p>
                  <p className="text-xl font-bold text-[#C93636] tabular-nums">
                    {formatNumber(pieceCounts.player2, lang)}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-[#6B4628]">
                    {t.capturedPieces}
                  </p>
                  <p className="text-xl font-bold text-[#98643D] tabular-nums">
                    {formatNumber(capturedByPlayer2, lang)}
                  </p>
                </div>
              </div>

              <div className="mt-3">
                <div className="flex flex-wrap gap-1.5 min-h-[18px]">
                  {Array.from({ length: 16 }).map((_, i) => (
                    <span
                      key={i}
                      className={`w-3.5 h-3.5 rounded-full border ${
                        i < capturedByPlayer2
                          ? 'bg-[#168653] border-[#0B4F30]'
                          : 'bg-[#E8D6B5] border-[#C9AE84]'
                      }`}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Game Controls Card */}
            <div className="rounded-2xl p-4 bg-[#F5E8CF] border border-[#C8A97E] space-y-3 shadow-xs">
              <div className="flex items-center justify-between text-xs font-semibold text-[#5C3A21] pb-2 border-b border-[#D8C09A]">
                <span>
                  {gameMode === 'online' && onlineRoom
                    ? `${t.roomCodeLabel}: ${onlineRoom.roomCode}`
                    : gameMode === 'ai'
                    ? t.modeAi
                    : t.modeLocal}
                </span>
                <span>
                  {t.totalMoves}:{' '}
                  {formatNumber(
                    gameMode === 'online' && onlineRoom
                      ? onlineRoom.moveHistory.length
                      : moveHistory.length,
                    lang
                  )}
                </span>
              </div>

              {/* Incoming Draw Offer Banner in Online Mode */}
              {gameMode === 'online' &&
                onlineRoom &&
                onlineRoom.drawOfferedBy &&
                onlineRoom.drawOfferedBy !== myOnlineSeat && (
                  <div className="p-3 rounded-xl bg-[#FFF5EB] border border-[#D97706] space-y-2">
                    <p className="text-xs font-bold text-[#7A2E0E]">
                      {t.drawOfferReceived}
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() =>
                          wsRef.current?.send(
                            JSON.stringify({
                              type: 'respond_draw',
                              roomCode: onlineRoom.roomCode,
                              accept: true,
                            })
                          )
                        }
                        className="flex-1 py-1.5 rounded-lg bg-[#168653] text-white text-xs font-bold cursor-pointer"
                      >
                        {t.acceptBtn}
                      </button>
                      <button
                        onClick={() =>
                          wsRef.current?.send(
                            JSON.stringify({
                              type: 'respond_draw',
                              roomCode: onlineRoom.roomCode,
                              accept: false,
                            })
                          )
                        }
                        className="flex-1 py-1.5 rounded-lg bg-[#C93636] text-white text-xs font-bold cursor-pointer"
                      >
                        {t.declineBtn}
                      </button>
                    </div>
                  </div>
                )}

              {activeChainNode &&
                ((gameMode === 'online' && activeTurn === myOnlineSeat) ||
                  gameMode === 'local' ||
                  (gameMode === 'ai' && currentTurn === 1)) && (
                  <button
                    onClick={handleEndChainTurn}
                    className="w-full py-2.5 px-4 rounded-xl bg-[#168653] hover:bg-[#126E44] text-white font-bold text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer"
                  >
                    <Check className="w-4 h-4 shrink-0" />
                    <span>{t.endChainBtn}</span>
                  </button>
                )}

              {gameMode === 'online' && onlineRoom ? (
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    onClick={() =>
                      wsRef.current?.send(
                        JSON.stringify({
                          type: 'offer_draw',
                          roomCode: onlineRoom.roomCode,
                        })
                      )
                    }
                    disabled={Boolean(onlineRoom.winner)}
                    className="py-2.5 px-3 rounded-xl bg-[#FAF3E4] hover:bg-[#EDE0C4] disabled:opacity-40 border border-[#C2A073] text-[#3D2516] text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Handshake className="w-4 h-4 text-[#98643D]" />
                    <span>{t.offerDrawBtn}</span>
                  </button>

                  <button
                    onClick={() =>
                      wsRef.current?.send(
                        JSON.stringify({
                          type: 'resign_match',
                          roomCode: onlineRoom.roomCode,
                        })
                      )
                    }
                    disabled={Boolean(onlineRoom.winner)}
                    className="py-2.5 px-3 rounded-xl bg-[#FDF0F0] hover:bg-[#F9DADA] disabled:opacity-40 border border-[#E6B0B0] text-[#C93636] text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Flag className="w-4 h-4" />
                    <span>{t.resignBtn}</span>
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    onClick={handleUndoMove}
                    disabled={moveHistory.length === 0 || isAiThinking}
                    className="py-2.5 px-3 rounded-xl bg-[#FAF3E4] hover:bg-[#EDE0C4] disabled:opacity-40 border border-[#C2A073] text-[#3D2516] text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Undo2 className="w-4 h-4 text-[#98643D] shrink-0" />
                    <span className="truncate">{t.undoMove}</span>
                  </button>

                  <button
                    onClick={handleShowHint}
                    disabled={
                      Boolean(winner) ||
                      isAiThinking ||
                      (gameMode === 'ai' && currentTurn === 2)
                    }
                    className="py-2.5 px-3 rounded-xl bg-[#FAF3E4] hover:bg-[#EDE0C4] disabled:opacity-40 border border-[#C2A073] text-[#145337] text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Lightbulb className="w-4 h-4 text-[#D97706] shrink-0" />
                    <span className="truncate">{t.hintBtn}</span>
                  </button>

                  <button
                    onClick={() => startNewLocalOrAiMatch(gameMode as 'ai' | 'local', startingPlayer)}
                    className="py-2.5 px-3 rounded-xl bg-[#FAF3E4] hover:bg-[#EDE0C4] border border-[#C2A073] text-[#3D2516] text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <RotateCcw className="w-4 h-4 text-[#98643D] shrink-0" />
                    <span className="truncate">{t.restartBtn}</span>
                  </button>

                  <button
                    onClick={() => setScreen('WELCOME')}
                    className="py-2.5 px-3 rounded-xl bg-[#98643D] hover:bg-[#82522E] text-white text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Sparkles className="w-4 h-4 shrink-0" />
                    <span className="truncate">{t.newGameBtn}</span>
                  </button>
                </div>
              )}
            </div>
          </section>

          {/* Center Panel: Live Status Banner + Traditional Cream & Wooden Board */}
          <section className="lg:col-span-6 flex flex-col items-center space-y-3 order-1 lg:order-2">
            <div className="w-full max-w-[500px] rounded-2xl px-4 py-3 bg-[#F5E8CF] border-2 border-[#98643D] flex items-center justify-between gap-3 shadow-xs">
              <div className="flex items-center gap-2.5 min-w-0">
                <span
                  className={`w-4 h-4 rounded-full shrink-0 border-2 ${
                    activeTurn === 1
                      ? 'bg-[#168653] border-[#0B4F30]'
                      : 'bg-[#C93636] border-[#7A1A1A]'
                  }`}
                />
                <p className="text-sm sm:text-base font-bold text-[#3D2516] leading-snug break-words">
                  {statusBannerText}
                </p>
              </div>
              {activeChainNode &&
                ((gameMode === 'online' && activeTurn === myOnlineSeat) ||
                  gameMode === 'local' ||
                  (gameMode === 'ai' && currentTurn === 1)) && (
                  <button
                    onClick={handleEndChainTurn}
                    className="px-3 py-1.5 rounded-lg bg-[#168653] hover:bg-[#126E44] text-white text-xs font-bold whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    {t.endChainBtn}
                  </button>
                )}
            </div>

            <SholoGutiBoard
              board={activeBoard}
              currentTurn={
                gameMode === 'online' ? myOnlineSeat : currentTurn
              }
              selectedNode={selectedNode}
              validMoves={validMovesForSelected}
              lastMove={activeLastMove}
              hintMove={hintMove}
              chainNode={activeChainNode}
              isAiThinking={
                isAiThinking ||
                (gameMode === 'online' && activeTurn !== myOnlineSeat)
              }
              showCoordinates={showCoordinates}
              t={t}
              lang={lang}
              onNodeClick={handleNodeClick}
            />
          </section>

          {/* Right Panel: Quick Guide & Move Log */}
          <section className="lg:col-span-3 space-y-4 order-3">
            <div className="rounded-2xl p-4 bg-[#F5E8CF] border border-[#C8A97E] space-y-3 shadow-xs">
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-bold text-base text-[#3D2516]">
                  {t.quickGuideTitle}
                </h3>
                <button
                  onClick={() => setIsRulesOpen(true)}
                  className="text-xs font-bold text-[#168653] hover:underline cursor-pointer"
                >
                  {t.detailedRules}
                </button>
              </div>
              <ul className="space-y-2 text-xs sm:text-sm font-medium text-[#4A2F1D]">
                <li className="flex items-center gap-2">
                  <span className="w-3.5 h-3.5 rounded-full bg-[#168653] border border-[#0B4F30] inline-block shrink-0" />
                  <span>{t.guideGreen}</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-3.5 h-3.5 rounded-full bg-[#C93636] border border-[#7A1A1A] inline-block shrink-0" />
                  <span>{t.guideRed}</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-3.5 h-3.5 rounded-full bg-[#EAB308] border border-[#B45309] inline-block shrink-0" />
                  <span>{t.guideGold}</span>
                </li>
              </ul>

              <button
                onClick={() => setShowCoordinates((v) => !v)}
                className="w-full py-2 px-3 rounded-xl bg-[#FAF3E4] hover:bg-[#EDE0C4] border border-[#C2A073] text-xs font-bold text-[#3D2516] flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <Compass className="w-4 h-4 text-[#98643D] shrink-0" />
                <span>{showCoordinates ? t.coordsHide : t.coordsShow}</span>
              </button>
            </div>

            {/* Move History Log */}
            <div className="rounded-2xl p-4 bg-[#F5E8CF] border border-[#C8A97E] flex flex-col h-[290px] shadow-xs">
              <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-[#D8C09A]">
                <h3 className="font-bold text-base text-[#3D2516]">
                  {t.moveLogTitle}
                </h3>
                <span className="text-xs font-semibold text-[#6B4628] tabular-nums">
                  {formatNumber(
                    gameMode === 'online' && onlineRoom
                      ? onlineRoom.moveHistory.length
                      : moveHistory.length,
                    lang
                  )}
                </span>
              </div>

              {(gameMode === 'online' && onlineRoom
                ? onlineRoom.moveHistory.length
                : moveHistory.length) === 0 ? (
                <div className="flex-1 flex items-center justify-center text-center text-sm text-[#7A5434] px-4">
                  {t.noMovesYet}
                </div>
              ) : (
                <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                  {gameMode === 'online' && onlineRoom
                    ? onlineRoom.moveHistory.map((item) => (
                        <div
                          key={item.moveNumber}
                          className="px-3 py-2 rounded-xl bg-[#FAF3E4] border border-[#DEC7A3] text-xs sm:text-sm flex items-start gap-2"
                        >
                          <span className="font-mono font-bold text-[#98643D] tabular-nums shrink-0">
                            {formatNumber(item.moveNumber, lang)}.
                          </span>
                          <span
                            className={
                              item.type === 'capture'
                                ? 'text-[#145337] font-bold'
                                : 'text-[#3D2516] font-medium'
                            }
                          >
                            {item.player === 1
                              ? onlineRoom.player1.username
                              : onlineRoom.player2?.username || t.player2Short}
                            : {getNodeLabel(item.from, lang)} →{' '}
                            {getNodeLabel(item.to, lang)}
                            {item.type === 'capture'
                              ? ` ${t.moveCapturedSuffix}`
                              : ''}
                          </span>
                        </div>
                      ))
                    : moveHistory.map((item) => {
                        const actorName =
                          item.player === 1
                            ? t.player1Short
                            : gameMode === 'ai'
                            ? t.computerShort
                            : t.player2Short;
                        return (
                          <div
                            key={item.moveNumber}
                            className="px-3 py-2 rounded-xl bg-[#FAF3E4] border border-[#DEC7A3] text-xs sm:text-sm flex items-start gap-2"
                          >
                            <span className="font-mono font-bold text-[#98643D] tabular-nums shrink-0">
                              {formatNumber(item.moveNumber, lang)}.
                            </span>
                            <span
                              className={
                                item.type === 'capture'
                                  ? 'text-[#145337] font-bold'
                                  : 'text-[#3D2516] font-medium'
                              }
                            >
                              {actorName}: {getNodeLabel(item.from, lang)} →{' '}
                              {getNodeLabel(item.to, lang)}
                              {item.type === 'capture'
                                ? ` ${t.moveCapturedSuffix}`
                                : ''}
                            </span>
                          </div>
                        );
                      })}
                </div>
              )}
            </div>
          </section>
        </main>
      )}

      {/* VICTORY / GAME OVER MODAL */}
      {activeWinner !== null && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-[#2D1B0E]/60"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-3xl bg-[#FAF3E4] border-2 border-[#98643D] p-6 sm:p-8 text-center space-y-5 shadow-2xl">
            <div className="mx-auto w-16 h-16 rounded-full bg-[#168653]/15 border-2 border-[#168653] flex items-center justify-center text-[#168653]">
              <Trophy className="w-9 h-9" />
            </div>

            <div className="space-y-2">
              <p className="text-sm font-bold text-[#98643D]">{t.gameOverTitle}</p>
              <h2 className="text-2xl sm:text-3xl font-bold font-serif-bn text-[#3D2516]">
                {activeWinner === 'draw'
                  ? t.statsDraws
                  : activeWinner === 1
                  ? `${player1Name} — ${t.statsWins}!`
                  : `${player2Name} — ${t.statsWins}!`}
              </h2>
              {winReasonKey && (
                <p className="text-sm sm:text-base font-medium text-[#5C3A21]">
                  {t[winReasonKey]}
                </p>
              )}
            </div>

            <div className="grid grid-cols-3 gap-2.5 bg-[#F5E8CF] p-3.5 rounded-2xl border border-[#D8C09A] text-sm">
              <div>
                <p className="text-xs font-medium text-[#6B4628]">{t.totalMoves}</p>
                <p className="text-lg font-bold text-[#3D2516] tabular-nums">
                  {formatNumber(
                    gameMode === 'online' && onlineRoom
                      ? onlineRoom.moveHistory.length
                      : moveHistory.length,
                    lang
                  )}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-[#6B4628]">{t.greenShort}</p>
                <p className="text-lg font-bold text-[#168653] tabular-nums">
                  {formatNumber(pieceCounts.player1, lang)}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-[#6B4628]">{t.redShort}</p>
                <p className="text-lg font-bold text-[#C93636] tabular-nums">
                  {formatNumber(pieceCounts.player2, lang)}
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              {gameMode === 'online' && onlineRoom ? (
                <button
                  onClick={() =>
                    wsRef.current?.send(
                      JSON.stringify({
                        type: 'request_rematch',
                        roomCode: onlineRoom.roomCode,
                      })
                    )
                  }
                  className="flex-1 py-3 px-5 rounded-xl bg-[#168653] hover:bg-[#126E44] text-white font-bold text-base flex items-center justify-center gap-2 cursor-pointer"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>{t.rematchBtn}</span>
                </button>
              ) : (
                <button
                  onClick={() =>
                    startNewLocalOrAiMatch(
                      gameMode as 'ai' | 'local',
                      startingPlayer
                    )
                  }
                  className="flex-1 py-3 px-5 rounded-xl bg-[#168653] hover:bg-[#126E44] text-white font-bold text-base transition-colors cursor-pointer"
                >
                  {t.playAgainBtn}
                </button>
              )}
              <button
                onClick={() => {
                  if (gameMode === 'online' && onlineRoom) {
                    wsRef.current?.send(JSON.stringify({ type: 'leave_room' }));
                    setOnlineRoom(null);
                  }
                  setWinner(null);
                  setScreen('WELCOME');
                }}
                className="py-3 px-5 rounded-xl bg-[#F5E8CF] hover:bg-[#EAD8B6] border border-[#C2A073] text-[#3D2516] font-bold text-base transition-colors cursor-pointer"
              >
                {t.mainMenuBtn}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODALS */}
      <RulesModal
        isOpen={isRulesOpen}
        onClose={() => setIsRulesOpen(false)}
        t={t}
      />
      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        t={t}
        onSuccess={() => {}}
      />
      <FriendsModal
        isOpen={isFriendsOpen}
        onClose={() => setIsFriendsOpen(false)}
        t={t}
        lang={lang}
        currentProfile={profile}
        friendRequests={friendRequests}
        onlineUsersMap={onlineUsersMap}
        activeRoomCode={onlineRoom?.roomCode || null}
        onJoinRoomCode={(code) => handleJoinRoomByCode(code)}
        onOpenAuth={() => setIsAuthOpen(true)}
      />
      <ProfileModal
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
        t={t}
        lang={lang}
        onChangeLanguage={handleChangeLanguage}
        profile={profile}
        privateData={privateData}
        matchHistory={cloudMatchHistory}
        onProfileUpdated={(updated) => setProfile(updated)}
        onAccountDeleted={() => {
          setProfile(null);
          setPrivateData(null);
          setCloudMatchHistory([]);
        }}
        onOpenAuth={() => setIsAuthOpen(true)}
      />
      <AndroidGuideModal
        isOpen={isAndroidGuideOpen}
        onClose={() => setIsAndroidGuideOpen(false)}
        t={t}
      />
      <OfflineIndicator t={t} />
    </div>
  );
}
