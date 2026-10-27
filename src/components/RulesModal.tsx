import React from 'react';
import { X, BookOpen, ShieldAlert, Sparkles, Award, Move } from 'lucide-react';
import { TranslationStrings } from '../i18n/translations';

interface RulesModalProps {
  isOpen: boolean;
  onClose: () => void;
  t: TranslationStrings;
}

export const RulesModal: React.FC<RulesModalProps> = ({ isOpen, onClose, t }) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-[#2C1A0E]/60 backdrop-blur-sm animate-fadeIn"
      role="dialog"
      aria-modal="true"
      aria-labelledby="rules-modal-title"
    >
      <div className="relative w-full max-w-2xl max-h-[88vh] overflow-y-auto rounded-3xl bg-[#FDF7EC] border-2 border-[#C8A67A] text-[#3D2514] shadow-[0_24px_60px_rgba(61,37,20,0.28)]">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between px-4 sm:px-6 py-4 bg-[#F5E8CF]/95 backdrop-blur border-b border-[#D8C09E]">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2.5 rounded-xl bg-[#98643D]/15 border border-[#98643D]/30 text-[#7A4B28] shrink-0">
              <BookOpen className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <h2 id="rules-modal-title" className="text-lg sm:text-2xl font-bold text-[#3D2514] truncate">
                {t.rulesModalTitle}
              </h2>
              <p className="text-xs sm:text-sm text-[#7A5638] truncate">
                {t.appSubtitle}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-[#EAD7B7] hover:bg-[#DFC69E] text-[#4A2E19] border border-[#C8A67A] transition-colors cursor-pointer shrink-0"
            aria-label={t.closeBtn}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-6 space-y-5 text-sm sm:text-base leading-relaxed text-[#4A2E19]">
          <div className="p-4 rounded-2xl bg-[#F5E8CF] border border-[#D8C09E]">
            <p>{t.rulesIntro}</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 rounded-2xl bg-[#F8EFE0] border border-[#DEC7A6] space-y-2">
              <div className="flex items-center gap-2 text-[#168653] font-bold text-base">
                <Sparkles className="w-5 h-5 shrink-0" />
                <span>{t.rule1Title}</span>
              </div>
              <p className="text-sm text-[#5C3A21]">{t.rule1Body}</p>
            </div>

            <div className="p-4 rounded-2xl bg-[#F8EFE0] border border-[#DEC7A6] space-y-2">
              <div className="flex items-center gap-2 text-[#7A4B28] font-bold text-base">
                <Move className="w-5 h-5 shrink-0" />
                <span>{t.rule2Title}</span>
              </div>
              <p className="text-sm text-[#5C3A21]">{t.rule2Body}</p>
            </div>

            <div className="p-4 rounded-2xl bg-[#F8EFE0] border border-[#DEC7A6] space-y-2">
              <div className="flex items-center gap-2 text-[#C93636] font-bold text-base">
                <ShieldAlert className="w-5 h-5 shrink-0" />
                <span>{t.rule3Title}</span>
              </div>
              <ul className="list-disc list-inside space-y-1 text-sm text-[#5C3A21]">
                <li>{t.rule3Bullet1}</li>
                <li>{t.rule3Bullet2}</li>
                <li>{t.rule3Bullet3}</li>
              </ul>
            </div>

            <div className="p-4 rounded-2xl bg-[#F8EFE0] border border-[#DEC7A6] space-y-2">
              <div className="flex items-center gap-2 text-[#B45309] font-bold text-base">
                <Award className="w-5 h-5 shrink-0" />
                <span>{t.rule4Title}</span>
              </div>
              <p className="text-sm text-[#5C3A21]">{t.rule4Body}</p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 sm:px-6 py-4 bg-[#F5E8CF] border-t border-[#D8C09E] flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#98643D] to-[#7A4B28] hover:from-[#875632] hover:to-[#693F20] text-[#FFFDF9] font-bold shadow-md transition-all cursor-pointer"
          >
            {t.rulesCloseBtn}
          </button>
        </div>
      </div>
    </div>
  );
};
