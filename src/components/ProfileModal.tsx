import React, { useEffect, useState } from 'react';
import {
  X,
  User as UserIcon,
  Trophy,
  History,
  CloudUpload,
  CloudDownload,
  Download,
  Lock,
  CheckCircle2,
  AlertCircle,
  LogOut,
  Trash2,
  LogIn,
} from 'lucide-react';
import {
  CloudMatchHistoryRecord,
  CloudPublicProfile,
  CloudUserPrivate,
  updateCloudProfileDetails,
  updateAccountPassword,
  saveBackupToGoogleDrive,
  loadBackupFromGoogleDrive,
  deleteAllUserCloudData,
  signOutUser,
  formatAuthErrorBn,
} from '../services/firebaseClient';
import {
  LanguageCode,
  SUPPORTED_LANGUAGES,
  TranslationKey,
  TranslationStrings,
  formatNumber,
} from '../i18n/translations';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  t: TranslationStrings;
  lang: LanguageCode;
  onChangeLanguage: (nextLang: LanguageCode) => void;
  profile: CloudPublicProfile | null;
  privateData: CloudUserPrivate | null;
  matchHistory: CloudMatchHistoryRecord[];
  onProfileUpdated: (updated: CloudPublicProfile) => void;
  onAccountDeleted: () => void;
  onOpenAuth: () => void;
}

const AVATAR_OPTIONS: {
  id: string;
  labelKey: TranslationKey;
  color: string;
}[] = [
  { id: 'emerald_lotus', labelKey: 'avatarEmerald', color: '#168653' },
  { id: 'crimson_star', labelKey: 'avatarRuby', color: '#C93636' },
  { id: 'bengal_tiger', labelKey: 'avatarTiger', color: '#D97706' },
  { id: 'padma_boat', labelKey: 'avatarBoat', color: '#2563EB' },
];

export const ProfileModal: React.FC<ProfileModalProps> = ({
  isOpen,
  onClose,
  t,
  lang,
  onChangeLanguage,
  profile,
  privateData,
  matchHistory,
  onProfileUpdated,
  onAccountDeleted,
  onOpenAuth,
}) => {
  const [username, setUsername] = useState('');
  const [avatar, setAvatar] = useState('emerald_lotus');
  const [newPassword, setNewPassword] = useState('');
  const [statusKey, setStatusKey] = useState<TranslationKey | null>(null);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmingDriveAction, setConfirmingDriveAction] = useState<
    'backup' | 'restore' | null
  >(null);
  const [confirmingDeleteAccount, setConfirmingDeleteAccount] = useState(false);

  useEffect(() => {
    if (isOpen && profile) {
      setUsername(profile.username);
      setAvatar(profile.avatar || 'emerald_lotus');
      setStatusKey(null);
      setErrorText(null);
      setConfirmingDriveAction(null);
      setConfirmingDeleteAccount(false);
    }
  }, [isOpen, profile]);

  if (!isOpen) return null;

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    setBusy(true);
    setStatusKey(null);
    setErrorText(null);
    try {
      await updateCloudProfileDetails(profile.uid, {
        username,
        avatar,
        preferredLanguage: lang,
        status: profile.status,
      });
      onProfileUpdated({
        ...profile,
        username: username.trim() || profile.username,
        avatar,
        preferredLanguage: lang,
      });
      setStatusKey('profileSavedSuccess');
    } catch {
      setErrorText(t.profileSaveError);
    } finally {
      setBusy(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 6) {
      setErrorText(t.authErrWeakPass);
      return;
    }
    setBusy(true);
    setStatusKey(null);
    setErrorText(null);
    try {
      await updateAccountPassword(newPassword);
      setNewPassword('');
      setStatusKey('profileSavedSuccess');
    } catch (err) {
      setErrorText(formatAuthErrorBn(err, t));
    } finally {
      setBusy(false);
    }
  };

  const handleDriveBackup = async () => {
    if (!profile) return;
    setBusy(true);
    setStatusKey(null);
    setErrorText(null);
    try {
      await saveBackupToGoogleDrive({
        exportedAt: new Date().toISOString(),
        profile,
        privateData,
        matchHistory,
      });
      setConfirmingDriveAction(null);
      setStatusKey('driveBackupSuccess');
    } catch {
      setErrorText(t.driveBackupError);
    } finally {
      setBusy(false);
    }
  };

  const handleDriveRestore = async () => {
    if (!profile) return;
    setBusy(true);
    setStatusKey(null);
    setErrorText(null);
    try {
      const restored = await loadBackupFromGoogleDrive();
      if (!restored || !restored.profile) {
        setErrorText(t.driveNoBackupFound);
        return;
      }
      const restoredProfile = restored.profile as Partial<CloudPublicProfile>;
      const nextUsername = restoredProfile.username || profile.username;
      const nextAvatar = restoredProfile.avatar || profile.avatar;
      const nextLang = (restoredProfile.preferredLanguage || lang) as LanguageCode;

      await updateCloudProfileDetails(profile.uid, {
        username: nextUsername,
        avatar: nextAvatar,
        preferredLanguage: nextLang,
        status: profile.status,
      });
      onChangeLanguage(nextLang);
      onProfileUpdated({
        ...profile,
        username: nextUsername,
        avatar: nextAvatar,
        preferredLanguage: nextLang,
      });
      setConfirmingDriveAction(null);
      setStatusKey('driveRestoreSuccess');
    } catch {
      setErrorText(t.driveRestoreError);
    } finally {
      setBusy(false);
    }
  };

  const handleExportJson = () => {
    if (!profile) return;
    const payload = JSON.stringify(
      {
        exportedAt: new Date().toISOString(),
        profile,
        privateData,
        matchHistory,
      },
      null,
      2
    );
    const blob = new Blob([payload], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sholo_guti_backup_${profile.username}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDeleteAccount = async () => {
    if (!profile) return;
    setBusy(true);
    setStatusKey(null);
    setErrorText(null);
    try {
      await deleteAllUserCloudData(profile.uid);
      onAccountDeleted();
      onClose();
    } catch {
      setErrorText(t.deleteAccountError);
    } finally {
      setBusy(false);
    }
  };

  const getMatchOutcomeLabel = (result: CloudMatchHistoryRecord['result']) => {
    if (result === 'win') return t.statsWins;
    if (result === 'loss') return t.statsLosses;
    return t.statsDraws;
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-[#2D1B0E]/60"
      role="dialog"
      aria-modal="true"
    >
      <div className="relative w-full max-w-2xl max-h-[90vh] flex flex-col rounded-3xl bg-[#FAF3E4] border-2 border-[#98643D] text-[#3D2516] shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-4 bg-[#F1E2C8] border-b border-[#D5BC96]">
          <div className="flex items-center gap-2.5 min-w-0">
            <UserIcon className="w-5 h-5 text-[#168653] shrink-0" />
            <h2 className="text-lg sm:text-xl font-bold text-[#3D2516] truncate">
              {t.profileTitle}
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

        {/* Content */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6">
          {!profile ? (
            <div className="p-6 text-center rounded-2xl bg-[#F5E8CF] border border-[#D8C09A] space-y-4">
              <p className="text-sm font-semibold text-[#5C3A21]">
                {t.guestBanner}
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
              {statusKey && (
                <div className="p-3 rounded-xl bg-[#E8F8F0] border border-[#168653] text-[#0E5C38] text-xs font-bold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{t[statusKey]}</span>
                </div>
              )}

              {errorText && (
                <div className="p-3 rounded-xl bg-[#FDECEC] border border-[#C93636] text-[#8A1E1E] text-xs font-bold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorText}</span>
                </div>
              )}

              {/* Career Stats Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="p-3 rounded-2xl bg-[#F5E8CF] border border-[#D8C09A] text-center">
                  <div className="text-xs text-[#7A5233] font-semibold">
                    {t.statsPlayed}
                  </div>
                  <div className="text-xl font-extrabold text-[#3D2516] mt-0.5">
                    {formatNumber(profile.gamesPlayed, lang)}
                  </div>
                </div>
                <div className="p-3 rounded-2xl bg-[#E8F8F0] border border-[#A5DFC4] text-center">
                  <div className="text-xs text-[#0E5C38] font-semibold">
                    {t.statsWins}
                  </div>
                  <div className="text-xl font-extrabold text-[#168653] mt-0.5">
                    {formatNumber(profile.wins, lang)}
                  </div>
                </div>
                <div className="p-3 rounded-2xl bg-[#FDECEC] border border-[#F2B8B8] text-center">
                  <div className="text-xs text-[#8A1E1E] font-semibold">
                    {t.statsLosses}
                  </div>
                  <div className="text-xl font-extrabold text-[#C93636] mt-0.5">
                    {formatNumber(profile.losses, lang)}
                  </div>
                </div>
                <div className="p-3 rounded-2xl bg-[#FFF6E5] border border-[#EBCD98] text-center">
                  <div className="text-xs text-[#8C5811] font-semibold">
                    {t.statsDraws}
                  </div>
                  <div className="text-xl font-extrabold text-[#B45309] mt-0.5">
                    {formatNumber(profile.draws, lang)}
                  </div>
                </div>
              </div>

              {/* Profile Form */}
              <form
                onSubmit={handleSaveProfile}
                className="p-4 rounded-2xl bg-[#F5E8CF] border border-[#D8C09A] space-y-4"
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-[#5C3A21] mb-1">
                      {t.authUsernameLabel}
                    </label>
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      maxLength={32}
                      className="w-full px-3.5 py-2 rounded-xl bg-[#FAF3E4] border border-[#C8A97E] text-sm text-[#3D2516]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#5C3A21] mb-1">
                      {t.preferredLanguageLabel}
                    </label>
                    <select
                      value={lang}
                      onChange={(e) =>
                        onChangeLanguage(e.target.value as LanguageCode)
                      }
                      className="w-full px-3.5 py-2 rounded-xl bg-[#FAF3E4] border border-[#C8A97E] text-sm text-[#3D2516]"
                    >
                      {SUPPORTED_LANGUAGES.map((l) => (
                        <option key={l.code} value={l.code}>
                          {l.nativeName} ({l.englishName})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#5C3A21] mb-1.5">
                    {t.avatarLabel}
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {AVATAR_OPTIONS.map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setAvatar(opt.id)}
                        className={`px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-2 cursor-pointer ${
                          avatar === opt.id
                            ? 'bg-[#3D2516] text-[#FAF3E4] border-[#3D2516]'
                            : 'bg-[#FAF3E4] text-[#5C3A21] border-[#C8A97E]'
                        }`}
                      >
                        <span
                          className="w-3 h-3 rounded-full inline-block shrink-0"
                          style={{ backgroundColor: opt.color }}
                        />
                        <span>{t[opt.labelKey]}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  <div className="text-[11px] text-[#7A5233] break-all">
                    {t.authEmailLabel}:{' '}
                    <span className="font-bold">{privateData?.email || '—'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleExportJson}
                      className="px-3 py-2 rounded-xl bg-[#FAF3E4] hover:bg-[#EAD8B8] border border-[#C8A97E] text-[#3D2516] text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>{t.exportDataBtn}</span>
                    </button>
                    <button
                      type="submit"
                      disabled={busy}
                      className="px-4 py-2 rounded-xl bg-[#168653] hover:bg-[#126E44] text-white text-xs font-bold cursor-pointer"
                    >
                      {t.saveProfileBtn}
                    </button>
                  </div>
                </div>
              </form>

              {/* Google Workspace Drive Integration */}
              <div className="p-4 rounded-2xl bg-[#F5E8CF] border border-[#D8C09A] space-y-3">
                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-[#3D2516] flex items-center gap-2">
                    <CloudUpload className="w-4 h-4 text-[#168653] shrink-0" />
                    <span>{t.driveSyncTitle}</span>
                  </h3>
                  <p className="text-xs text-[#6B4628]">{t.driveSyncDesc}</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => setConfirmingDriveAction('backup')}
                    className="py-2.5 px-3 rounded-xl bg-[#168653] hover:bg-[#126E44] text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <CloudUpload className="w-4 h-4 shrink-0" />
                    <span>{t.driveBackupBtn}</span>
                  </button>

                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => setConfirmingDriveAction('restore')}
                    className="py-2.5 px-3 rounded-xl bg-[#98643D] hover:bg-[#7F512F] text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <CloudDownload className="w-4 h-4 shrink-0" />
                    <span>{t.driveRestoreBtn}</span>
                  </button>
                </div>

                {confirmingDriveAction && (
                  <div className="p-3 rounded-xl bg-[#FFF6EB] border border-[#D97706] flex flex-wrap items-center justify-between gap-2 text-xs">
                    <span className="text-[#7A2E0E] font-bold">
                      {t.driveConfirmPrompt}
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={
                          confirmingDriveAction === 'backup'
                            ? handleDriveBackup
                            : handleDriveRestore
                        }
                        className="px-3 py-1.5 rounded-lg bg-[#168653] text-white font-bold cursor-pointer"
                      >
                        {t.confirmYesBtn}
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmingDriveAction(null)}
                        className="px-3 py-1.5 rounded-lg bg-white text-[#5C3A21] border border-[#C8A97E] font-bold cursor-pointer"
                      >
                        {t.confirmCancelBtn}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Change Password */}
              <form
                onSubmit={handlePasswordChange}
                className="p-4 rounded-2xl bg-[#F5E8CF] border border-[#D8C09A] flex flex-col sm:flex-row items-stretch sm:items-end gap-3"
              >
                <div className="flex-1">
                  <label className="block text-xs font-bold text-[#5C3A21] mb-1">
                    <Lock className="w-3.5 h-3.5 inline mr-1" />
                    {t.changePasswordLabel} ({t.optionalLabel})
                  </label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    minLength={6}
                    placeholder={t.passwordMinPlaceholder}
                    className="w-full px-3.5 py-2 rounded-xl bg-[#FAF3E4] border border-[#C8A97E] text-sm text-[#3D2516]"
                  />
                </div>
                <button
                  type="submit"
                  disabled={busy || !newPassword}
                  className="px-4 py-2 rounded-xl bg-[#98643D] hover:bg-[#7F512F] disabled:opacity-50 text-white text-xs font-bold cursor-pointer"
                >
                  {t.saveProfileBtn}
                </button>
              </form>

              {/* Recent Match History */}
              <div className="space-y-2">
                <h3 className="text-xs font-bold text-[#7A5233] uppercase flex items-center gap-1.5">
                  <History className="w-4 h-4" />
                  <span>{t.matchHistoryTitle}</span>
                </h3>
                {matchHistory.length === 0 ? (
                  <div className="p-4 text-center rounded-2xl bg-[#F5E8CF]/60 border border-[#D8C09A] text-xs text-[#7A5233]">
                    {t.matchHistoryEmpty}
                  </div>
                ) : (
                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    {matchHistory.map((m) => (
                      <div
                        key={m.matchId}
                        className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl bg-[#F5E8CF] border border-[#D8C09A] text-xs"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <Trophy
                            className={`w-4 h-4 shrink-0 ${
                              m.result === 'win'
                                ? 'text-[#168653]'
                                : m.result === 'loss'
                                ? 'text-[#C93636]'
                                : 'text-[#B45309]'
                            }`}
                          />
                          <span className="font-bold text-[#3D2516] truncate">
                            {t.vsLabel}: {m.opponentName}
                          </span>
                          <span className="text-[11px] text-[#7A5233] shrink-0">
                            ({t.modeLabel}: {m.mode.toUpperCase()})
                          </span>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <span className="text-[#5C3A21]">
                            {t.totalMoves}: {formatNumber(m.totalMoves, lang)}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-md font-bold ${
                              m.result === 'win'
                                ? 'bg-[#E8F8F0] text-[#168653]'
                                : m.result === 'loss'
                                ? 'bg-[#FDECEC] text-[#C93636]'
                                : 'bg-[#FFF6E5] text-[#B45309]'
                            }`}
                          >
                            {getMatchOutcomeLabel(m.result)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Delete Account Section */}
              <div className="pt-2 border-t border-[#D8C09A]">
                {!confirmingDeleteAccount ? (
                  <button
                    type="button"
                    onClick={() => setConfirmingDeleteAccount(true)}
                    className="text-xs font-bold text-[#C93636] hover:underline flex items-center gap-1.5 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>{t.deleteAccountBtn}</span>
                  </button>
                ) : (
                  <div className="p-3 rounded-xl bg-[#FDECEC] border border-[#C93636] flex flex-wrap items-center justify-between gap-2 text-xs">
                    <span className="text-[#8A1E1E] font-bold">
                      {t.deleteAccountWarning}
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={handleDeleteAccount}
                        className="px-3 py-1.5 rounded-lg bg-[#C93636] text-white font-bold cursor-pointer"
                      >
                        {t.confirmYesBtn}
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmingDeleteAccount(false)}
                        className="px-3 py-1.5 rounded-lg bg-white text-[#5C3A21] border border-[#C8A97E] font-bold cursor-pointer"
                      >
                        {t.confirmCancelBtn}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 sm:px-6 py-3.5 bg-[#F1E2C8] border-t border-[#D5BC96] flex justify-between items-center gap-2">
          {profile ? (
            <button
              type="button"
              onClick={async () => {
                await signOutUser();
                onClose();
              }}
              className="px-4 py-2 rounded-xl bg-[#FDECEC] hover:bg-[#FAD4D4] text-[#C93636] border border-[#E6A8A8] text-xs font-bold flex items-center gap-1.5 cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              <span>{t.authSignOut}</span>
            </button>
          ) : (
            <div />
          )}

          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-[#3D2516] text-[#FAF3E4] text-xs font-bold cursor-pointer"
          >
            {t.closeBtn}
          </button>
        </div>
      </div>
    </div>
  );
};
