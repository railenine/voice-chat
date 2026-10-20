import React, { memo } from "react";
import { Settings, Share2, Check } from "lucide-react";
import { PanelHeader, Button, Logo, Badge } from "../ui";
import { Tooltip } from "../Tooltip";
import { MAX_ROOM_PEERS } from "../../config";
import { ConnectionStatusIndicator } from "./ConnectionStatusIndicator";

export interface VoiceHeaderProps {
  roomId: string;
  copied: boolean;
  copyRoomId: () => void;
  triggerShare: () => void;
  onOpenSettings: () => void;
  isMobile?: boolean;
  isSmartphone?: boolean;
  participantCount?: number;
  maxParticipants?: number;
  className?: string;
  isConnected?: boolean;
  error?: string | null;
  connectionStatus?: string;
  reconnectAttempts?: number;
  handleRetry?: () => void;
  isRetrying?: boolean;
}

export const VoiceHeader: React.FC<VoiceHeaderProps> = memo(
  ({
    roomId,
    copied,
    copyRoomId,
    triggerShare,
    onOpenSettings,
    isMobile = false,
    isSmartphone = false,
    participantCount,
    maxParticipants = MAX_ROOM_PEERS,
    className = "",
    isConnected,
    error,
    connectionStatus,
    reconnectAttempts,
    handleRetry,
    isRetrying,
  }) => {
    return (
      <PanelHeader
        style={
          isMobile
            ? { paddingTop: "env(safe-area-inset-top, 0px)" }
            : undefined
        }
        className={`${isMobile ? "lg:hidden z-20 px-3" : "px-3"} ${className}`}
      >
        {/* Left: Branding & Connection Status */}
        <div className="flex items-center gap-2 sm:gap-2.5 min-w-0 flex-1">
          <Logo size="sm" className="shadow-xs shrink-0" />

          <span className="hidden sm:inline text-sm sm:text-base font-bold text-(--fg) tracking-tight shrink-0">
            RVxis
          </span>

          {/* Participant count badge on tablet/laptop */}
          {isMobile && typeof participantCount === "number" && (
            <Badge
              variant="neutral"
              size="sm"
              className={`shrink-0 transition-colors hidden md:inline-flex ${
                participantCount >= maxParticipants
                  ? "bg-(--danger-soft)! border-(--danger-border)! text-(--danger)! font-semibold"
                  : participantCount >= 8
                    ? "bg-(--warning-soft)! border-(--warning-border)! text-(--warning)!"
                    : "text-(--muted)"
              }`}
              title={
                participantCount >= maxParticipants
                  ? "Комната заполнена"
                  : participantCount >= 8
                    ? "Mesh P2P (8+ участников)"
                    : "Количество участников"
              }
            >
              {participantCount}/{maxParticipants}
            </Badge>
          )}

          {/* Unified Connection Status Indicator for Mobile (< 1024px) */}
          {isMobile && typeof isConnected === "boolean" && (
            <ConnectionStatusIndicator
              isConnected={isConnected}
              error={error}
              connectionStatus={connectionStatus}
              reconnectAttempts={reconnectAttempts}
              handleRetry={handleRetry}
              isRetrying={isRetrying}
              isMobile={true}
            />
          )}
        </div>

        {/* Right: Quick Actions (Settings & Share) */}
        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0 ml-1.5">
          <Tooltip
            content={isSmartphone ? "Настройки звука" : "Настройки"}
            description={
              isSmartphone
                ? "Выбор микрофона и динамиков"
                : "Звук, микрофон и горячие клавиши"
            }
            position="bottom"
          >
            <Button
              variant="secondary"
              size="icon-sm"
              onClick={onOpenSettings}
              aria-label="Настройки"
            >
              <Settings className="w-4 h-4 text-(--muted) hover:text-(--fg)" />
            </Button>
          </Tooltip>

          <Tooltip
            content={copied ? "Скопировано!" : "Поделиться"}
            description={
              copied
                ? "Ссылка в буфере обмена"
                : "Скопировать ссылку на комнату"
            }
            position="bottom"
          >
            <Button
              variant={copied ? "accent" : "secondary"}
              size="icon-sm"
              onClick={triggerShare}
              aria-label={copied ? "Ссылка скопирована" : "Поделиться ссылкой"}
              className={`transition-all duration-150 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                copied ? "shadow-xs" : ""
              }`}
            >
              <div className="relative w-4 h-4 flex items-center justify-center">
                <Share2
                  className={`w-4 h-4 transition-all duration-150 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                    copied
                      ? "opacity-0 scale-50 rotate-45 pointer-events-none"
                      : "opacity-100 scale-100 rotate-0 text-(--muted)"
                  }`}
                />
                <Check
                  className={`w-4 h-4 absolute inset-0 transition-all duration-150 ease-[cubic-bezier(0.16,1,0.3,1)] text-(--accent) ${
                    copied
                      ? "opacity-100 scale-100 rotate-0"
                      : "opacity-0 scale-50 -rotate-45 pointer-events-none"
                  }`}
                />
              </div>
            </Button>
          </Tooltip>
        </div>
      </PanelHeader>
    );
  },
);

VoiceHeader.displayName = "VoiceHeader";
