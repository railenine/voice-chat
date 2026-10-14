import React, { useState, memo } from 'react';
import {
  ExternalLink,
  ShieldAlert,
  AlertTriangle,
  Globe,
  Copy,
  Check,
  CheckSquare,
  Square,
  ShieldCheck,
} from 'lucide-react';
import { Modal } from './Modal';
import { Button, Badge } from './ui';
import {
  analyzeUrlSecurity,
  addTrustedDomain,
  openExternalUrl,
} from '../utils/chatMediaUtils';

export interface ExternalLinkModalProps {
  url: string | null;
  onClose: () => void;
}

export const ExternalLinkModal: React.FC<ExternalLinkModalProps> = memo(({
  url,
  onClose,
}) => {
  const [dontAskAgain, setDontAskAgain] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!url) return null;

  const analysis = analyzeUrlSecurity(url);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.warn('Failed to copy link:', err);
    }
  };

  const handleProceed = () => {
    if (dontAskAgain && analysis.hostname) {
      addTrustedDomain(analysis.hostname);
    }
    openExternalUrl(url);
    onClose();
  };

  const isDanger = analysis.riskLevel === 'danger';
  const isWarning = analysis.riskLevel === 'warning';

  return (
    <Modal
      isOpen={Boolean(url)}
      onClose={onClose}
      className="max-w-lg w-full flex flex-col overflow-hidden"
    >
      <Modal.Header
        title="Переход по внешней ссылке"
        subtitle="Безопасность пользователя"
        icon={
          isDanger ? (
            <ShieldAlert className="w-4 h-4 text-rose-400" />
          ) : isWarning ? (
            <AlertTriangle className="w-4 h-4 text-amber-400" />
          ) : (
            <ExternalLink className="w-4 h-4 text-blue-400" />
          )
        }
        onClose={onClose}
      >
        <Badge
          variant={isDanger ? 'rose' : isWarning ? 'amber' : 'blue'}
          size="sm"
        >
          {isDanger ? 'ОПАСНОСТЬ' : isWarning ? 'ВНИМАНИЕ' : 'ВНЕШНИЙ САЙТ'}
        </Badge>
      </Modal.Header>

      <Modal.Body className="p-4 sm:p-5 space-y-4">
        {/* Risk Warning Alert Box */}
        {isDanger ? (
          <div className="p-3 bg-rose-500/15 border border-rose-500/30 rounded-xl flex items-start gap-3">
            <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            <div className="min-w-0 text-xs">
              <p className="font-semibold text-rose-200">Подозрительный домен!</p>
              <p className="text-rose-300/90 mt-0.5 leading-relaxed">
                {analysis.warningMessage}
              </p>
            </div>
          </div>
        ) : isWarning ? (
          <div className="p-3 bg-amber-500/15 border border-amber-500/30 rounded-xl flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div className="min-w-0 text-xs">
              <p className="font-semibold text-amber-200">Предупреждение безопасности</p>
              <p className="text-amber-300/90 mt-0.5 leading-relaxed">
                {analysis.warningMessage}
              </p>
            </div>
          </div>
        ) : (
          <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
            <p className="text-xs text-gray-300 leading-relaxed">
              Вы собираетесь перейти на сторонний ресурс. Никогда не вводите пароли от своих аккаунтов, коды авторизации или личные данные на непроверенных сайтах.
            </p>
          </div>
        )}

        {/* Destination Host Highlight */}
        <div className="p-3.5 bg-black/40 border border-white/10 rounded-xl space-y-2">
          <div className="flex items-center justify-between text-xs text-gray-400">
            <span className="flex items-center gap-1.5 font-medium">
              <Globe className="w-3.5 h-3.5 text-blue-400" />
              Домен назначения:
            </span>
            <span className="font-mono text-[11px] text-gray-500">
              {analysis.protocol}
            </span>
          </div>

          <div className="text-sm sm:text-base font-bold text-white font-mono break-all px-2.5 py-1.5 bg-white/5 rounded-lg border border-white/10 flex items-center justify-between gap-2">
            <span className={isDanger ? 'text-rose-400' : isWarning ? 'text-amber-300' : 'text-blue-300'}>
              {analysis.hostname}
            </span>
          </div>

          <div className="text-[11px] text-gray-400 break-all font-mono select-all bg-black/30 p-2 rounded-lg border border-white/5 max-h-20 overflow-y-auto custom-scrollbar">
            {url}
          </div>
        </div>

        {/* Remember Trust Checkbox */}
        {!isDanger && (
          <div
            onClick={() => setDontAskAgain((v) => !v)}
            className="flex items-center gap-2.5 text-xs text-gray-300 hover:text-white cursor-pointer select-none transition-colors group"
          >
            <div className="text-blue-400 group-hover:text-blue-300 transition-colors p-0.5 shrink-0">
              {dontAskAgain ? (
                <CheckSquare className="w-4 h-4 text-blue-400" />
              ) : (
                <Square className="w-4 h-4 text-gray-500" />
              )}
            </div>
            <span>
              Больше не предупреждать для домена <span className="text-blue-300 font-mono font-medium">{analysis.hostname}</span>
            </span>
          </div>
        )}
      </Modal.Body>

      <Modal.Footer className="justify-between gap-2">
        <Button
          variant="glass"
          size="md"
          icon={copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
          onClick={handleCopy}
        >
          {copied ? 'Скопировано!' : 'Копировать ссылку'}
        </Button>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="md"
            onClick={onClose}
          >
            Отмена
          </Button>

          <Button
            variant={isDanger ? 'danger' : 'primary'}
            size="md"
            icon={<ExternalLink className="w-4 h-4" />}
            onClick={handleProceed}
          >
            {isDanger ? 'Всё равно перейти' : 'Перейти на сайт'}
          </Button>
        </div>
      </Modal.Footer>
    </Modal>
  );
});

ExternalLinkModal.displayName = 'ExternalLinkModal';
