import React, { useState } from 'react';
import {
  X,
  UserPlus,
  Users,
  Search,
  Check,
  XCircle,
  Swords,
  ShieldAlert,
  Circle,
  LogIn,
} from 'lucide-react';
import {
  CloudFriendRequest,
  CloudPublicProfile,
  searchPublicPlayers,
  sendCloudFriendRequest,
  respondToCloudFriendRequest,
  sendCloudRoomInviteToFriend,
  submitPlayerReportOrBlock,
} from '../services/firebaseClient';
import {
  LanguageCode,
  TranslationKey,
  TranslationStrings,
  formatNumber,
  translate,
} from '../i18n/translations';

interface FriendsModalProps {
  isOpen: boolean;
  onClose: () => void;
  t: TranslationStrings;
  lang?: LanguageCode;
  currentProfile: CloudPublicProfile | null;
  friendRequests: CloudFriendRequest[];
  onlineUsersMap: Record<string, { status: string; username: string }>;
  activeRoomCode: string | null;
  onJoinRoomCode: (code: string) => void;
  onOpenAuth: () => void;
}

export const FriendsModal: React.FC<FriendsModalProps> = ({
  isOpen,
  onClose,
  t,
  lang = 'bn',
  currentProfile,
  friendRequests,
  onlineUsersMap,
  activeRoomCode,
  onJoinRoomCode,
  onOpenAuth,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<CloudPublicProfile[]>([]);
  const [searching, setSearching] = useState(false);
  const [feedbackState, setFeedbackState] = useState<{
    key: TranslationKey;
    params?: Record<string, string | number>;
    isError?: boolean;
  } | null>(null);

  if (!isOpen) return null;

  const incomingPending = currentProfile
    ? friendRequests.filter(
        (r) => r.toUid === currentProfile.uid && r.status === 'pending'
      )
    : [];

  const acceptedFriends = currentProfile
    ? friendRequests.filter((r) => r.status === 'accepted')
    : [];

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentProfile) return;
    setSearching(true);
    setFeedbackState(null);
    try {
      const results = await searchPublicPlayers(searchTerm);
      setSearchResults(results.filter((u) => u.uid !== currentProfile.uid));
    } catch {
      setFeedbackState({ key: 'friendsSearchError', isError: true });
    } finally {
      setSearching(false);
    }
  };

  const handleSendRequest = async (target: CloudPublicProfile) => {
    if (!currentProfile) return;
    try {
      await sendCloudFriendRequest(currentProfile, target);
      setFeedbackState({
        key: 'friendsReqSent',
        params: { name: target.username },
      });
    } catch {
      setFeedbackState({ key: 'friendsReqError', isError: true });
    }
  };

  const handleRespond = async (
    requestId: string,
    status: 'accepted' | 'declined'
  ) => {
    try {
      await respondToCloudFriendRequest(requestId, status);
    } catch {
      setFeedbackState({ key: 'friendsUpdateError', isError: true });
    }
  };

  const handleInviteFriend = async (
    requestId: string,
    friendUsername: string
  ) => {
    if (!activeRoomCode) {
      setFeedbackState({ key: 'friendsCreateRoomFirst', isError: true });
      return;
    }
    try {
      await sendCloudRoomInviteToFriend(requestId, activeRoomCode);
      setFeedbackState({
        key: 'friendsInviteSent',
        params: { name: friendUsername, code: activeRoomCode },
      });
    } catch {
      setFeedbackState({ key: 'friendsInviteError', isError: true });
    }
  };

  const handleReportOrBlock = async (
    targetUid: string,
    targetUsername: string
  ) => {
    if (!currentProfile) return;
    try {
      await submitPlayerReportOrBlock(
        currentProfile.uid,
        targetUid,
        targetUsername,
        t.friendsReportReason,
        'report'
      );
      setFeedbackState({
        key: 'friendsReportSuccess',
        params: { name: targetUsername },
      });
    } catch {
      setFeedbackState({ key: 'friendsReportError', isError: true });
    }
  };

  const getPresenceStatusText = (uid: string, fallbackStatus?: string) => {
    const liveStatus = onlineUsersMap[uid]?.status || fallbackStatus || 'offline';
    if (liveStatus === 'online' || liveStatus === 'searching') {
      return t.statusOnline;
    }
    if (liveStatus === 'in_game') {
      return t.statusInGame;
    }
    return t.statusOffline;
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-[#2D1B0E]/60"
      role="dialog"
      aria-modal="true"
    >
      <div className="relative w-full max-w-lg max-h-[88vh] flex flex-col rounded-3xl bg-[#FAF3E4] border-2 border-[#98643D] text-[#3D2516] shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-4 bg-[#F1E2C8] border-b border-[#D5BC96]">
          <div className="flex items-center gap-2.5 min-w-0">
            <Users className="w-5 h-5 text-[#168653] shrink-0" />
            <h2 className="text-lg sm:text-xl font-bold text-[#3D2516] truncate">
              {t.friendsTitle}
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label={t.closeBtn}
            className="p-2 rounded-lg text-[#5C3A21] hover:bg-[#E5D1AF] transition-colors cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5">
          {!currentProfile ? (
            <div className="p-6 text-center rounded-2xl bg-[#F5E8CF] border border-[#D8C09A] space-y-4">
              <p className="text-sm font-semibold text-[#5C3A21]">
                {t.friendsSignInPrompt}
              </p>
              <button
                onClick={() => {
                  onClose();
                  onOpenAuth();
                }}
                className="px-5 py-2.5 rounded-xl bg-[#168653] hover:bg-[#126E44] text-white text-sm font-bold inline-flex items-center gap-2 cursor-pointer"
              >
                <LogIn className="w-4 h-4" />
                <span>{t.authSignInBtn}</span>
              </button>
            </div>
          ) : (
            <>
              {feedbackState && (
                <div
                  className={`px-4 py-2.5 rounded-xl border text-xs font-bold ${
                    feedbackState.isError
                      ? 'bg-[#FDECEC] border-[#C93636] text-[#8A1E1E]'
                      : 'bg-[#E8F8F0] border-[#168653] text-[#0E5C38]'
                  }`}
                >
                  {translate(lang, feedbackState.key, feedbackState.params)}
                </div>
              )}

              {/* Search Users */}
              <form onSubmit={handleSearch} className="flex gap-2">
                <div className="relative flex-1 min-w-0">
                  <Search className="w-4 h-4 text-[#98643D] absolute left-3.5 top-3" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder={t.searchPlayerPlaceholder}
                    className="w-full pl-10 pr-4 py-2 rounded-xl bg-[#F5E8CF] border border-[#C8A97E] text-sm text-[#3D2516] focus:outline-none focus:border-[#168653]"
                  />
                </div>
                <button
                  type="submit"
                  disabled={searching}
                  className="px-4 py-2 rounded-xl bg-[#98643D] hover:bg-[#7F512F] text-white font-bold text-xs transition-colors cursor-pointer shrink-0"
                >
                  {searching ? '...' : t.searchBtn}
                </button>
              </form>

              {/* Search Results */}
              {searchResults.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-xs font-bold text-[#7A5233] uppercase">
                    {t.friendsSearchResults}
                  </h3>
                  <div className="space-y-2">
                    {searchResults.map((user) => {
                      const alreadyConnected = friendRequests.some(
                        (r) =>
                          ((r.fromUid === currentProfile.uid &&
                            r.toUid === user.uid) ||
                            (r.fromUid === user.uid &&
                              r.toUid === currentProfile.uid)) &&
                          r.status !== 'declined'
                      );
                      return (
                        <div
                          key={user.uid}
                          className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-xl bg-[#F5E8CF] border border-[#D8C09A]"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-8 h-8 rounded-full bg-[#168653] text-white font-bold flex items-center justify-center text-sm shrink-0">
                              {user.username.slice(0, 1).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <div className="text-sm font-bold text-[#3D2516] flex items-center gap-1.5 truncate">
                                <span className="truncate">{user.username}</span>
                                <Circle
                                  className={`w-2.5 h-2.5 fill-current shrink-0 ${
                                    onlineUsersMap[user.uid]?.status === 'online'
                                      ? 'text-[#168653]'
                                      : 'text-neutral-400'
                                  }`}
                                />
                              </div>
                              <div className="text-[11px] text-[#7A5233] truncate">
                                {t.statsWins}: {formatNumber(user.wins, lang)} •{' '}
                                {getPresenceStatusText(user.uid, user.status)}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            {!alreadyConnected && (
                              <button
                                onClick={() => handleSendRequest(user)}
                                className="px-3 py-1.5 rounded-lg bg-[#168653] hover:bg-[#126E44] text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                              >
                                <UserPlus className="w-3.5 h-3.5" />
                                <span>{t.sendFriendReqBtn}</span>
                              </button>
                            )}
                            <button
                              onClick={() =>
                                handleReportOrBlock(user.uid, user.username)
                              }
                              title={t.reportBlockBtn}
                              aria-label={t.reportBlockBtn}
                              className="p-1.5 rounded-lg text-[#C93636] hover:bg-[#FDECEC] transition-colors cursor-pointer"
                            >
                              <ShieldAlert className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Incoming Pending Friend Requests */}
              {incomingPending.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-xs font-bold text-[#C93636] uppercase">
                    {t.friendsPendingTitle} (
                    {formatNumber(incomingPending.length, lang)})
                  </h3>
                  <div className="space-y-2">
                    {incomingPending.map((req) => (
                      <div
                        key={req.requestId}
                        className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-xl bg-[#FFF6EB] border border-[#E6B88A]"
                      >
                        <div className="min-w-0">
                          <div className="text-sm font-bold text-[#3D2516] truncate">
                            {req.fromUsername}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            onClick={() =>
                              handleRespond(req.requestId, 'accepted')
                            }
                            className="px-2.5 py-1.5 rounded-lg bg-[#168653] text-white text-xs font-bold flex items-center gap-1 cursor-pointer"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>{t.acceptBtn}</span>
                          </button>
                          <button
                            onClick={() =>
                              handleRespond(req.requestId, 'declined')
                            }
                            className="px-2.5 py-1.5 rounded-lg bg-[#C93636] text-white text-xs font-bold flex items-center gap-1 cursor-pointer"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            <span>{t.declineBtn}</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Accepted Friends List */}
              <div className="space-y-2">
                <h3 className="text-xs font-bold text-[#7A5233] uppercase">
                  {t.friendsListTitle} (
                  {formatNumber(acceptedFriends.length, lang)})
                </h3>
                {acceptedFriends.length === 0 ? (
                  <div className="p-6 text-center rounded-2xl bg-[#F5E8CF]/60 border border-[#D8C09A] text-xs text-[#7A5233]">
                    {t.friendsEmptyText}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {acceptedFriends.map((edge) => {
                      const isSender = edge.fromUid === currentProfile.uid;
                      const friendUid = isSender ? edge.toUid : edge.fromUid;
                      const friendUsername = isSender
                        ? edge.toUsername
                        : edge.fromUsername;
                      const isOnline =
                        onlineUsersMap[friendUid]?.status === 'online';

                      return (
                        <div
                          key={edge.requestId}
                          className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-xl bg-[#F5E8CF] border border-[#D8C09A]"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-9 h-9 rounded-full bg-[#98643D] text-white font-bold flex items-center justify-center text-sm shrink-0">
                              {friendUsername.slice(0, 1).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <div className="text-sm font-bold text-[#3D2516] flex items-center gap-1.5 truncate">
                                <span className="truncate">{friendUsername}</span>
                                <Circle
                                  className={`w-2.5 h-2.5 fill-current shrink-0 ${
                                    isOnline
                                      ? 'text-[#168653]'
                                      : 'text-neutral-400'
                                  }`}
                                />
                              </div>
                              <div className="text-[11px] text-[#7A5233] truncate">
                                {t.statusLabel}:{' '}
                                {getPresenceStatusText(friendUid)}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {edge.roomInviteCode && (
                              <button
                                onClick={() => {
                                  onJoinRoomCode(edge.roomInviteCode);
                                  onClose();
                                }}
                                className="px-3 py-1.5 rounded-lg bg-[#98643D] hover:bg-[#7F512F] text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                              >
                                <span>
                                  {t.joinRoomBtn} ({edge.roomInviteCode})
                                </span>
                              </button>
                            )}
                            <button
                              onClick={() =>
                                handleInviteFriend(
                                  edge.requestId,
                                  friendUsername
                                )
                              }
                              className="px-3 py-1.5 rounded-lg bg-[#168653] hover:bg-[#126E44] text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                            >
                              <Swords className="w-3.5 h-3.5" />
                              <span>{t.inviteToRoomBtn}</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
