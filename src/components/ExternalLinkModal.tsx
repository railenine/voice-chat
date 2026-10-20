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
      className="max-w-md w-full flex flex-col overflow-hidden"
    >
      <Modal.Header
        title="Внешняя ссылка"
        subtitle="Безопасность перехода"
        icon={
          isDanger ? (
            <ShieldAlert className="w-4 h-4 text-(--danger)" />
          ) : isWarning ? (
            <AlertTriangle className="w-4 h-4 text-(--warning)" />
          ) : (
            <ExternalLink className="w-4 h-4 text-(--accent)" />
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

      <Modal.Body className="p-4 sm:p-5 space-y-3.5">
        {/* Risk Warning or Spec-Compliant Callout */}
        {isDanger ? (
          <div className="p-2.5 bg-(--danger-soft) border border-(--danger-border) rounded-(--radius) flex items-start gap-2.5 text-xs">
            <ShieldAlert className="w-4 h-4 text-(--danger) shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="font-semibold text-(--danger)">Подозрительный домен!</p>
              <p className="text-(--danger)/90 mt-0.5 leading-relaxed">
                {analysis.warningMessage}
              </p>
            </div>
          </div>
        ) : isWarning ? (
          <div className="p-2.5 bg-(--warning-soft) border border-(--warning-border) rounded-(--radius) flex items-start gap-2.5 text-xs">
            <AlertTriangle className="w-4 h-4 text-(--warning) shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="font-semibold text-(--warning)">Предупреждение безопасности</p>
              <p className="text-(--warning)/90 mt-0.5 leading-relaxed">
                {analysis.warningMessage}
              </p>
            </div>
          </div>
        ) : (
          <div className="callout border-l-2 border-(--accent) pl-3 py-0.5 text-xs text-(--muted) leading-relaxed">
            Вы переходите на сторонний ресурс. Никогда не вводите пароли или личные данные на непроверенных сайтах.
          </div>
        )}

        {/* Unified Destination Slot */}
        <div className="p-3 bg-(--bg) border border-(--border) rounded-(--radius) space-y-1.5 select-none">
          <div className="flex items-center justify-between text-[11px] text-(--muted)">
            <span className="flex items-center gap-1.5 font-medium">
              <Globe className="w-3.5 h-3.5 text-(--accent)" />
              <span>Домен назначения</span>
            </span>
            <span className="font-mono text-[10px] text-(--muted)">
              {analysis.protocol}
            </span>
          </div>

          <div className="text-sm sm:text-base font-bold font-mono break-all">
            <span className={isDanger ? 'text-(--danger)' : isWarning ? 'text-(--warning)' : 'text-(--accent)'}>
              {analysis.hostname}
            </span>
          </div>

          <div className="text-[11px] text-(--muted) break-all font-mono select-all pt-1.5 border-t border-(--border) max-h-16 overflow-y-auto custom-scrollbar">
            {url}
          </div>
        </div>

        {/* Remember Trust Checkbox */}
        {!isDanger && (
          <div
            onClick={() => setDontAskAgain((v) => !v)}
            className="flex items-center gap-2 text-xs text-(--muted) hover:text-(--fg) cursor-pointer select-none transition-colors group pt-0.5"
          >
            <div className="text-(--accent) transition-colors shrink-0">
              {dontAskAgain ? (
                <CheckSquare className="w-4 h-4 text-(--accent)" />
              ) : (
                <Square className="w-4 h-4 text-(--muted)" />
              )}
            </div>
            <span>
              Больше не предупреждать для <span className="text-(--accent) font-mono font-medium">{analysis.hostname}</span>
            </span>
          </div>
        )}
      </Modal.Body>

      <Modal.Footer className="justify-between gap-2">
        <Button
          variant="secondary"
          size="sm"
          icon={copied ? <Check className="w-3.5 h-3.5 text-(--accent)" /> : <Copy className="w-3.5 h-3.5 text-(--muted)" />}
          onClick={handleCopy}
        >
          {copied ? 'Скопировано!' : 'Копировать'}
        </Button>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
          >
            Отмена
          </Button>

          <Button
            variant={isDanger ? 'danger' : 'primary'}
            size="sm"
            icon={<ExternalLink className="w-3.5 h-3.5" />}
            onClick={handleProceed}
          >
            {isDanger ? 'Перейти' : 'Перейти на сайт'}
          </Button>
        </div>
      </Modal.Footer>
    </Modal>
  );
});

ExternalLinkModal.displayName = 'ExternalLinkModal';

