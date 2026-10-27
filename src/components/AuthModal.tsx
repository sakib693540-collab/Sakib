import React, { useState } from 'react';
import { X, Mail, Lock, User as UserIcon, AlertCircle, CheckCircle2 } from 'lucide-react';
import {
  signInWithGoogle,
  registerWithEmail,
  loginWithEmail,
  triggerPasswordReset,
  formatAuthErrorBn,
} from '../services/firebaseClient';
import { TranslationStrings } from '../i18n/translations';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  t: TranslationStrings;
  onSuccess: (desiredUsername?: string) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  t,
  onSuccess,
}) => {
  const [tab, setTab] = useState<'signin' | 'signup' | 'reset'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setErrorMsg(null);
    setInfoMsg(null);
    try {
      await signInWithGoogle();
      onSuccess();
      onClose();
    } catch (err) {
      setErrorMsg(formatAuthErrorBn(err, t));
    } finally {
      setLoading(false);
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);
    setInfoMsg(null);

    try {
      if (tab === 'reset') {
        await triggerPasswordReset(email);
        setInfoMsg(t.authResetSentInfo);
      } else if (tab === 'signup') {
        if (username.trim().length < 2) {
          setErrorMsg(t.authUsernameMinError);
          setLoading(false);
          return;
        }
        await registerWithEmail(email, password);
        onSuccess(username.trim());
        onClose();
      } else {
        await loginWithEmail(email, password);
        onSuccess();
        onClose();
      }
    } catch (err) {
      setErrorMsg(formatAuthErrorBn(err, t));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#2D1B0E]/60"
      role="dialog"
      aria-modal="true"
    >
      <div className="relative w-full max-w-md rounded-3xl bg-[#FAF3E4] border-2 border-[#98643D] text-[#3D2516] shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-[#F1E2C8] border-b border-[#D5BC96]">
          <h2 className="text-xl font-bold font-serif-bn text-[#3D2516]">
            {tab === 'signup'
              ? t.authTitleSignUp
              : tab === 'reset'
              ? t.authForgotPassword
              : t.authTitleSignIn}
          </h2>
          <button
            onClick={onClose}
            aria-label={t.closeBtn}
            className="p-2 rounded-lg text-[#5C3A21] hover:bg-[#E5D1AF] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          {/* Mode Switch Tabs */}
          <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-[#EAD8B8] border border-[#D4BA92]">
            <button
              type="button"
              onClick={() => {
                setTab('signin');
                setErrorMsg(null);
                setInfoMsg(null);
              }}
              className={`py-2 rounded-lg text-sm font-bold transition-colors cursor-pointer ${
                tab === 'signin'
                  ? 'bg-[#168653] text-white shadow-xs'
                  : 'text-[#5C3A21] hover:text-[#3D2516]'
              }`}
            >
              {t.authSignInBtn}
            </button>
            <button
              type="button"
              onClick={() => {
                setTab('signup');
                setErrorMsg(null);
                setInfoMsg(null);
              }}
              className={`py-2 rounded-lg text-sm font-bold transition-colors cursor-pointer ${
                tab === 'signup'
                  ? 'bg-[#168653] text-white shadow-xs'
                  : 'text-[#5C3A21] hover:text-[#3D2516]'
              }`}
            >
              {t.authSignUpBtn}
            </button>
          </div>

          {errorMsg && (
            <div className="p-3 rounded-xl bg-[#FDECEC] border border-[#C93636] text-[#8A1E1E] text-xs sm:text-sm flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-[#C93636]" />
              <span>{errorMsg}</span>
            </div>
          )}

          {infoMsg && (
            <div className="p-3 rounded-xl bg-[#E8F8F0] border border-[#168653] text-[#0E5C38] text-xs sm:text-sm flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-[#168653]" />
              <span>{infoMsg}</span>
            </div>
          )}

          {/* Official Google Sign-In Button */}
          <button
            type="button"
            disabled={loading}
            onClick={handleGoogleSignIn}
            className="w-full py-3 px-4 rounded-xl bg-white hover:bg-neutral-50 border border-[#C8A97E] text-[#3D2516] font-bold text-sm shadow-xs flex items-center justify-center gap-3 transition-colors cursor-pointer"
          >
            <svg className="w-5 h-5 shrink-0" viewBox="0 0 48 48">
              <path
                fill="#EA4335"
                d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
              />
              <path
                fill="#4285F4"
                d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
              />
              <path
                fill="#FBBC05"
                d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
              />
              <path
                fill="#34A853"
                d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
              />
            </svg>
            <span>{t.authGoogleBtn}</span>
          </button>

          <div className="flex items-center gap-3 text-xs text-[#855C3B]">
            <div className="h-px flex-1 bg-[#D8C09A]" />
            <span>{t.authOrEmailDivider}</span>
            <div className="h-px flex-1 bg-[#D8C09A]" />
          </div>

          <form onSubmit={handleEmailSubmit} className="space-y-3.5">
            {tab === 'signup' && (
              <div>
                <label className="block text-xs font-bold text-[#5C3A21] mb-1">
                  {t.authUsernameLabel}
                </label>
                <div className="relative">
                  <UserIcon className="w-4 h-4 text-[#98643D] absolute left-3.5 top-3" />
                  <input
                    type="text"
                    required
                    minLength={2}
                    maxLength={32}
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder={t.authUsernamePlaceholder}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#F5E8CF] border border-[#C8A97E] text-sm text-[#3D2516] focus:outline-none focus:border-[#168653]"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-[#5C3A21] mb-1">
                {t.authEmailLabel}
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-[#98643D] absolute left-3.5 top-3" />
                <input
                  type="email"
                  required
                  maxLength={254}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#F5E8CF] border border-[#C8A97E] text-sm text-[#3D2516] focus:outline-none focus:border-[#168653]"
                />
              </div>
            </div>

            {tab !== 'reset' && (
              <div>
                <label className="block text-xs font-bold text-[#5C3A21] mb-1">
                  {t.authPasswordLabel}
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-[#98643D] absolute left-3.5 top-3" />
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#F5E8CF] border border-[#C8A97E] text-sm text-[#3D2516] focus:outline-none focus:border-[#168653]"
                  />
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-5 rounded-xl bg-[#168653] hover:bg-[#126E44] disabled:opacity-50 text-white font-bold text-sm shadow-sm transition-colors cursor-pointer"
            >
              {loading
                ? '...'
                : tab === 'signup'
                ? t.authSignUpBtn
                : tab === 'reset'
                ? t.authSendReset
                : t.authSignInBtn}
            </button>
          </form>

          <div className="flex items-center justify-between text-xs pt-1">
            {tab !== 'reset' ? (
              <button
                type="button"
                onClick={() => {
                  setTab('reset');
                  setErrorMsg(null);
                  setInfoMsg(null);
                }}
                className="text-[#98643D] hover:underline font-semibold cursor-pointer"
              >
                {t.authForgotPassword}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setTab('signin')}
                className="text-[#168653] hover:underline font-semibold cursor-pointer"
              >
                ← {t.authSignInBtn}
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="text-[#5C3A21] hover:underline font-semibold cursor-pointer"
            >
              {t.authGuestBtn}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
