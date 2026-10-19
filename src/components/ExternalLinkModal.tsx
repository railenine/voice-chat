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
import { Button, Badge, Card } from './ui';
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
            <ExternalLink className="w-4 h-4 text-[var(--accent)]" />
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
          <div className="p-3 bg-rose-500/15 border border-rose-500/30 rounded-[var(--radius)] flex items-start gap-3">
            <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            <div className="min-w-0 text-xs">
              <p className="font-semibold text-rose-200">Подозрительный домен!</p>
              <p className="text-rose-300/90 mt-0.5 leading-relaxed">
                {analysis.warningMessage}
              </p>
            </div>
          </div>
        ) : isWarning ? (
          <div className="p-3 bg-amber-500/15 border border-amber-500/30 rounded-[var(--radius)] flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div className="min-w-0 text-xs">
              <p className="font-semibold text-amber-200">Предупреждение безопасности</p>
              <p className="text-amber-300/90 mt-0.5 leading-relaxed">
                {analysis.warningMessage}
              </p>
            </div>
          </div>
        ) : (
          <div className="p-3 bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius)] flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-[var(--accent)] shrink-0 mt-0.5" />
            <p className="text-xs text-[var(--muted)] leading-relaxed">
              Вы собираетесь перейти на сторонний ресурс. Никогда не вводите пароли от своих аккаунтов, коды авторизации или личные данные на непроверенных сайтах.
            </p>
          </div>
        )}

        {/* Destination Host Highlight */}
        <Card variant="surface" className="p-3.5 space-y-2 select-none">
          <div className="flex items-center justify-between text-xs text-[var(--muted)]">
            <span className="flex items-center gap-1.5 font-medium">
              <Globe className="w-3.5 h-3.5 text-[var(--accent)]" />
              Домен назначения:
            </span>
            <span className="font-mono text-[11px] text-[var(--muted)]">
              {analysis.protocol}
            </span>
          </div>

          <div className="text-sm sm:text-base font-bold text-[var(--fg)] font-mono break-all px-2.5 py-1.5 bg-[var(--bg)]/70 rounded-[var(--radius)] border border-[var(--border)] flex items-center justify-between gap-2">
            <span className={isDanger ? 'text-rose-400' : isWarning ? 'text-amber-300' : 'text-cyan-300'}>
              {analysis.hostname}
            </span>
          </div>

          <div className="text-[11px] text-[var(--muted)] break-all font-mono select-all bg-[var(--bg)]/40 p-2 rounded-[var(--radius)] border border-[var(--border)] max-h-20 overflow-y-auto custom-scrollbar">
            {url}
          </div>
        </Card>

        {/* Remember Trust Checkbox */}
        {!isDanger && (
          <div
            onClick={() => setDontAskAgain((v) => !v)}
            className="flex items-center gap-2.5 text-xs text-[var(--muted)] hover:text-[var(--fg)] cursor-pointer select-none transition-colors group"
          >
            <div className="text-[var(--accent)] group-hover:text-[var(--accent)] transition-colors p-0.5 shrink-0">
              {dontAskAgain ? (
                <CheckSquare className="w-4 h-4 text-[var(--accent)]" />
              ) : (
                <Square className="w-4 h-4 text-[var(--muted)]" />
              )}
            </div>
            <span>
              Больше не предупреждать для домена <span className="text-[var(--accent)] font-mono font-medium">{analysis.hostname}</span>
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
