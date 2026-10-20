import React, { memo } from 'react';
import { Pencil } from 'lucide-react';
import { Modal } from '../Modal';
import { Button, Input } from '../ui';

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
      <Modal.Header
        title="Ваш никнейм"
        icon={<Pencil className="w-5 h-5 text-(--accent)" />}
        onClose={onClose}
      />

      <form onSubmit={onSubmit}>
        <Modal.Body className="space-y-3">
          <label className="text-xs text-(--muted) block">
            Введите никнейм для отображения в комнате:
          </label>
          <Input
            value={newNickInput}
            onChange={(e) => setNewNickInput(e.target.value)}
            maxLength={24}
            autoFocus
          />
        </Modal.Body>

        <Modal.Footer>
          <Button variant="secondary" size="md" onClick={onClose}>
            Отмена
          </Button>
          <Button variant="primary" size="md" type="submit">
            Сохранить
          </Button>
        </Modal.Footer>
      </form>
    </Modal>
  );
});

MobileNicknameModal.displayName = 'MobileNicknameModal';
