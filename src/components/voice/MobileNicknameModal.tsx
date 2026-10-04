import React, { memo } from 'react';
import { Pencil, X } from 'lucide-react';
import { Modal } from '../Modal';
import { Tooltip } from '../Tooltip';

export interface MobileNicknameModalProps {
  isOpen: boolean;
  onClose: () => void;
  newNickInput: string;
  setNewNickInput: (val: string) => void;
  onSubmit: (e: React.FormEvent) => void;
}

export const MobileNicknameModal: React.FC<MobileNicknameModalProps> = memo(({
  isOpen,
  onClose,
  newNickInput,
  setNewNickInput,
  onSubmit,
}) => {
  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <div className="flex items-center justify-between border-b border-white/10 p-4 sm:p-5 flex-shrink-0 bg-white/[0.02]">
        <div className="flex items-center gap-2">
          <Pencil className="w-5 h-5 text-blue-400" />
          <h3 className="font-bold text-sm sm:text-base">Ваш никнейм</h3>
        </div>
        <Tooltip content="Закрыть" position="bottom">
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors flex items-center justify-center cursor-pointer"
            aria-label="Закрыть"
          >
            <X className="w-5 h-5" />
          </button>
        </Tooltip>
      </div>

      <form onSubmit={onSubmit}>
        <div className="modal-content-scroll p-4 sm:p-5 space-y-3">
          <label className="text-xs text-gray-400 block">Введите никнейм для отображения в комнате:</label>
          <input
            type="text"
            value={newNickInput}
            onChange={(e) => setNewNickInput(e.target.value)}
            maxLength={24}
            autoFocus
            className="w-full py-2.5 px-3 bg-black/30 hover:bg-black/40 focus:bg-black/50 border border-white/10 focus:border-blue-500/60 focus:ring-2 focus:ring-blue-500/20 rounded-xl text-white text-base focus:outline-none transition-all"
          />
        </div>

        <div className="flex justify-end gap-2 p-3 sm:p-4 border-t border-white/10 flex-shrink-0 bg-slate-950/50 rounded-b-2xl">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-white/[0.06] hover:bg-white/[0.12] text-gray-300 rounded-xl text-xs sm:text-sm font-medium transition-colors cursor-pointer"
          >
            Отмена
          </button>
          <button
            type="submit"
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs sm:text-sm font-semibold transition-all shadow-lg shadow-blue-600/30 active:scale-95 cursor-pointer"
          >
            Сохранить
          </button>
        </div>
      </form>
    </Modal>
  );
});

MobileNicknameModal.displayName = 'MobileNicknameModal';
