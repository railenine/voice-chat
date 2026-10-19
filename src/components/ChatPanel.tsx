import React, { useState, useRef, useEffect, useCallback, memo } from 'react';
import {
  MessageSquare,
  Send,
  Paperclip,
  X,
  ExternalLink,
  Play,
  UploadCloud,
  Image as ImageIcon,
  Video,
  AlertCircle,
  ShieldAlert,
  Eye,
  RefreshCw,
} from 'lucide-react';
import type { ChatMessage, ChatAttachment } from '../types/protocol';
import { Tooltip } from './Tooltip';
import { Button, Badge, PanelHeader } from './ui';
import { MediaViewerModal, type MediaViewerItem } from './MediaViewerModal';
import { ExternalLinkModal } from './ExternalLinkModal';
import {
  URL_REGEX,
  isUrl,
  splitTextByUrls,
  resolveMediaUrl,
  openExternalUrl,
  isDomainTrusted,
  extractMediaUrlsFromText,
  formatFileSize,
} from '../utils/chatMediaUtils';
import { getBackendBaseUrl } from '../config';

interface StagedAttachment {
  file: File;
  previewUrl: string;
  type: 'image' | 'video' | 'gif';
}

interface ChatPanelProps {
  roomId: string;
  messages: ChatMessage[];
  myPeerId: string;
  onSendMessage: (text: string, attachments?: ChatAttachment[]) => void;
  className?: string;
  showHeader?: boolean;
  onOpenMobileDrawer?: () => void;
  participantCount?: number;
  isConnected?: boolean;
  error?: string | null;
  connectionStatus?: string;
  reconnectAttempts?: number;
  isRetrying?: boolean;
  handleRetry?: () => void;
  streamView?: React.ReactNode;
}

export const ChatPanel: React.FC<ChatPanelProps> = memo(({
  roomId,
  messages,
  myPeerId,
  onSendMessage,
  className = '',
  showHeader = true,
  isConnected = true,
  error = null,
  connectionStatus = 'Подключено',
  reconnectAttempts = 0,
  isRetrying = false,
  handleRetry,
  streamView,
}) => {
  const [inputText, setInputText] = useState('');
  const [stagedAttachment, setStagedAttachment] = useState<StagedAttachment | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [viewingMedia, setViewingMedia] = useState<MediaViewerItem | null>(null);
  const [revealedMediaUrls, setRevealedMediaUrls] = useState<Set<string>>(() => new Set());
  const [confirmExternalUrl, setConfirmExternalUrl] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isAtBottomRef = useRef(true);
  const dragCounterRef = useRef(0);

  // Prevent browser / WebView2 from navigating to the dropped file path if dropped outside
  useEffect(() => {
    const preventDragNav = (e: DragEvent) => {
      e.preventDefault();
    };
    window.addEventListener('dragover', preventDragNav);
    window.addEventListener('drop', preventDragNav);
    return () => {
      window.removeEventListener('dragover', preventDragNav);
      window.removeEventListener('drop', preventDragNav);
    };
  }, []);

  // Check if user is scrolled near bottom
  const handleScroll = () => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const threshold = 160; // Generous threshold to consider user near bottom
    isAtBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight <= threshold;
  };

  // Safe scroll to bottom within the message container only
  const scrollToBottom = useCallback((smooth = true) => {
    const el = scrollContainerRef.current;
    if (!el) return;
    el.scrollTo({
      top: el.scrollHeight + 1000,
      behavior: smooth ? 'smooth' : 'auto',
    });
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({
        behavior: smooth ? 'smooth' : 'auto',
        block: 'end',
      });
    }
  }, []);

  // When media loads asynchronously, re-scroll to bottom if user was near bottom
  const handleMediaLoad = useCallback(() => {
    const el = scrollContainerRef.current;
    const wasNearBottom = el
      ? el.scrollHeight - el.scrollTop - el.clientHeight <= 200
      : true;
    if (isAtBottomRef.current || wasNearBottom) {
      scrollToBottom(true);
    }
  }, [scrollToBottom]);

  const prevMessagesLengthRef = useRef(messages.length);

  // Auto-scroll to bottom on message updates (for both sender and recipient)
  useEffect(() => {
    const hasNewMessage = messages.length > prevMessagesLengthRef.current;
    const lastMsg = messages[messages.length - 1];
    const isFromMe = lastMsg?.peerId === myPeerId;
    prevMessagesLengthRef.current = messages.length;

    const el = scrollContainerRef.current;
    const wasNearBottom = el
      ? el.scrollHeight - el.scrollTop - el.clientHeight <= 180
      : true;

    // Scroll if a new message arrived and recipient was near bottom, or if sender sent it
    if (hasNewMessage && (isFromMe || isAtBottomRef.current || wasNearBottom)) {
      isAtBottomRef.current = true;
      // Immediate scroll for instant feedback
      scrollToBottom(false);
      // Double deferred scroll to account for React layout flush and paint
      const t1 = setTimeout(() => scrollToBottom(true), 40);
      const t2 = setTimeout(() => scrollToBottom(true), 120);
      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
      };
    } else if (isAtBottomRef.current) {
      scrollToBottom(true);
    }
  }, [messages, myPeerId, scrollToBottom]);

  // Stage a local file for attachment
  const stageFile = useCallback((file: File) => {
    setUploadError(null);
    const isImage = file.type.startsWith('image/');
    const isVideo = file.type.startsWith('video/');

    // Explicitly reject SVG on client side
    if (file.name.toLowerCase().endsWith('.svg') || file.type.includes('svg')) {
      setUploadError('Файл не отправлен: загрузка SVG-файлов запрещена в целях безопасности');
      return;
    }

    if (!isImage && !isVideo) {
      setUploadError('Файл не отправлен: поддерживаются только изображения (PNG, JPG, WebP), GIF и видео (MP4, WebM)');
      return;
    }

    const maxSize = isVideo ? 25 * 1024 * 1024 : 10 * 1024 * 1024;
    if (file.size > maxSize) {
      setUploadError(`Файл не отправлен: размер превышает лимит (${isVideo ? '25 МБ для видео' : '10 МБ для фото'})`);
      return;
    }

    const isGif = file.type.includes('gif') || file.name.toLowerCase().endsWith('.gif');
    const type: 'image' | 'video' | 'gif' = isGif ? 'gif' : isVideo ? 'video' : 'image';
    const previewUrl = URL.createObjectURL(file);

    setStagedAttachment({ file, previewUrl, type });
  }, []);

  const handleClearStaged = useCallback(() => {
    if (stagedAttachment) {
      URL.revokeObjectURL(stagedAttachment.previewUrl);
    }
    setStagedAttachment(null);
    setUploadError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [stagedAttachment]);

  // Handle file input selection
  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files[0]) {
      stageFile(files[0]);
    }
  };

  // Handle clipboard paste (e.g. screenshot Ctrl+V)
  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) {
          e.preventDefault();
          stageFile(file);
          break;
        }
      }
    }
  };

  // Handle drag and drop files
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current += 1;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDraggingOver(true);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'copy';
    setIsDraggingOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current -= 1;
    if (dragCounterRef.current <= 0) {
      dragCounterRef.current = 0;
      setIsDraggingOver(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current = 0;
    setIsDraggingOver(false);
    const files = e.dataTransfer.files;
    if (files && files[0]) {
      stageFile(files[0]);
    }
  };

  // Upload staged file to in-memory ephemeral RAM server
  const uploadStagedFile = async (): Promise<ChatAttachment | null> => {
    if (!stagedAttachment) return null;

    const { file, type } = stagedAttachment;
    const url = `${getBackendBaseUrl()}/api/upload`;

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': file.type || 'application/octet-stream',
        'x-room-id': roomId,
        'x-peer-id': myPeerId,
        'x-filename': encodeURIComponent(file.name),
      },
      body: file,
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || `Файл не отправлен: ошибка сервера (${res.status})`);
    }

    const data = await res.json();
    return {
      id: data.id,
      url: data.url,
      name: data.name || file.name,
      type: data.type || type,
      size: data.size || file.size,
    };
  };

  // Form submit handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = inputText.trim();

    if (!trimmed && !stagedAttachment) return;

    try {
      let attachments: ChatAttachment[] | undefined;

      if (stagedAttachment) {
        setIsUploading(true);
        const uploaded = await uploadStagedFile();
        if (uploaded) {
          attachments = [uploaded];
        }
      }

      onSendMessage(trimmed, attachments);
      setInputText('');
      handleClearStaged();
      isAtBottomRef.current = true;
      scrollToBottom(false);
      setTimeout(() => {
        scrollToBottom(true);
      }, 50);
    } catch (err: any) {
      console.error('[Chat] Failed to send message with attachment:', err);
      setUploadError(err.message || 'Файл не отправлен: произошла неизвестная ошибка');
    } finally {
      setIsUploading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Safely handles external link clicks with anti-phishing protection
  const handleLinkClick = (url: string) => {
    if (isDomainTrusted(url)) {
      openExternalUrl(url);
    } else {
      setConfirmExternalUrl(url);
    }
  };

  // Render message text with styled interactive URLs
  const renderFormattedText = (text: string) => {
    if (!text) return null;
    const parts = splitTextByUrls(text);

    return parts.map((part, index) => {
      if (isUrl(part)) {
        return (
          <Tooltip key={index} content="Открыть ссылку" position="top" delay={120}>
            <a
              href={part}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleLinkClick(part);
              }}
              className="text-[var(--accent)] hover:underline underline-offset-2 font-medium break-all inline-flex items-center gap-1 group/link cursor-pointer"
            >
              <span>{part}</span>
              <ExternalLink className="w-3 h-3 opacity-60 group-hover/link:opacity-100 transition-opacity shrink-0" />
            </a>
          </Tooltip>
        );
      }
      return <span key={index}>{part}</span>;
    });
  };

  return (
    <div
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`relative flex flex-col h-full bg-[var(--bg)] rounded-2xl lg:rounded-none border border-[var(--border)] lg:border-none shadow-2xl lg:shadow-none shadow-black/40 overflow-hidden ${className}`}
    >
      {/* Drag & Drop Visual Overlay */}
      {isDraggingOver && (
        <div className="absolute inset-0 bg-[var(--bg)]/90 backdrop-blur-md z-30 flex flex-col items-center justify-center border-2 border-dashed border-[var(--accent)] rounded-2xl animate-fade-in pointer-events-none p-4 text-center">
          <UploadCloud className="w-12 h-12 text-[var(--accent)] mb-2 animate-bounce" />
          <p className="text-[var(--fg)] font-bold text-sm sm:text-base">Перетащите файлы сюда</p>
          <p className="text-[var(--muted)] text-xs mt-0.5">
            Изображения, GIF или видео (до 25 МБ)
          </p>
        </div>
      )}

      {/* Header (desktop only - mobile uses unified top bar) */}
      {showHeader && (
        <PanelHeader className="hidden lg:flex">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-[var(--accent-soft)] border border-[var(--accent)]/30 flex items-center justify-center text-[var(--accent)] shrink-0">
              <MessageSquare className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-[var(--fg)] truncate flex items-center gap-2">
                <span>Чат комнаты</span>
                <span className="text-[11px] font-mono text-[var(--muted)] font-normal">#{roomId}</span>
              </h2>
              <p className="text-[11px] text-[var(--muted)] truncate">
                {messages.length === 0
                  ? 'Сообщения видны только участникам'
                  : `${messages.length} ${messages.length === 1 ? 'сообщение' : messages.length < 5 ? 'сообщения' : 'сообщений'}`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {error ? (
              <div className="inline-flex items-center gap-2 pl-2.5 pr-1 py-1 rounded-full border border-rose-500/30 bg-rose-500/10 backdrop-blur-md shadow-xs shadow-rose-950/40 animate-fade-in shrink-0">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse shrink-0" />
                  <span
                    className="text-[11px] text-rose-200 font-medium truncate max-w-44 xl:max-w-64"
                    title={error}
                  >
                    {error}
                  </span>
                </div>

                {handleRetry && (
                  <>
                    <span className="w-px h-3.5 bg-rose-500/30 shrink-0" aria-hidden="true" />
                    <button
                      type="button"
                      onClick={handleRetry}
                      disabled={isRetrying}
                      className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold text-rose-200 hover:text-white bg-rose-500/20 hover:bg-rose-500/35 active:bg-rose-500/45 border border-rose-500/40 hover:border-rose-400/60 transition-all duration-150 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed whitespace-nowrap shrink-0 active:scale-95"
                    >
                      <RefreshCw className={`w-3 h-3 shrink-0 ${isRetrying ? 'animate-spin' : ''}`} />
                      <span>{isRetrying ? 'Подключение...' : 'Повторить'}</span>
                    </button>
                  </>
                )}
              </div>
            ) : !isConnected ? (
              <div className="flex items-center gap-1.5 animate-fade-in">
                <span className="inline-flex items-center gap-1.5 text-[11px] text-yellow-300 bg-yellow-500/10 px-2.5 py-1 rounded-full border border-yellow-500/20 font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse shrink-0" />
                  <span>{connectionStatus || 'Подключение...'}</span>
                </span>
                {reconnectAttempts > 0 && (
                  <span className="text-[10px] text-yellow-400/80 font-mono px-1.5 py-0.5 rounded-md bg-yellow-500/10 border border-yellow-500/20 shrink-0">
                    попытка {reconnectAttempts}
                  </span>
                )}
              </div>
            ) : (
              <Badge variant="pill" size="sm" pulse>
                Подключено
              </Badge>
            )}
          </div>
        </PanelHeader>
      )}

      {/* Stream Viewport (Stacked above chat messages when active) */}
      {streamView}

      {/* Message List */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3.5 min-h-0 select-text custom-scrollbar"
      >
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-4 select-none animate-fade-in text-[var(--muted)]/40">
            <MessageSquare className="w-10 h-10 sm:w-12 sm:h-12 stroke-[1.5]" />
          </div>
        ) : (
          messages.map((msg, index) => {
            const isMe = msg.peerId === myPeerId;
            const attachments = msg.attachments || [];
            const textMediaUrls = attachments.length === 0 ? extractMediaUrlsFromText(msg.text) : [];
            const prevMsg = index > 0 ? messages[index - 1] : null;
            const isFirstInGroup =
              !prevMsg ||
              prevMsg.peerId !== msg.peerId ||
              msg.timestamp - prevMsg.timestamp > 3 * 60 * 1000;

            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} group animate-fade-in ${
                  isFirstInGroup ? 'mt-3.5 first:mt-0' : 'mt-1'
                }`}
              >
                {isFirstInGroup && (
                  <div className="flex items-baseline gap-1.5 mb-1 px-1">
                    <span
                      className={`text-[11px] font-semibold ${
                        isMe ? 'text-[var(--accent)]' : 'text-[var(--fg)]'
                      }`}
                    >
                      {isMe ? 'Вы' : msg.nickname}
                    </span>
                    <span className="text-[10px] text-[var(--muted)] font-mono">
                      {formatTime(msg.timestamp)}
                    </span>
                  </div>
                )}

                <div
                  className={`max-w-[85%] sm:max-w-[75%] px-3.5 py-2.5 rounded-2xl text-xs sm:text-sm wrap-break-word whitespace-pre-wrap leading-relaxed shadow-xs ${
                    isMe
                      ? `bg-[color-mix(in_oklch,var(--accent)_16%,var(--surface))] hover:bg-[color-mix(in_oklch,var(--accent)_20%,var(--surface))] text-[var(--fg)] border border-[var(--accent)]/30 ${
                          isFirstInGroup ? 'rounded-tr-xs' : 'rounded-tr-xl'
                        }`
                      : `bg-[var(--surface)] hover:bg-[var(--elevated)] text-[var(--fg)] border border-[var(--border)] ${
                          isFirstInGroup ? 'rounded-tl-xs' : 'rounded-tl-xl'
                        }`
                  }`}
                >
                  {/* Message Text with styled links */}
                  {msg.text && (
                    <div className="select-text">
                      {renderFormattedText(msg.text)}
                    </div>
                  )}

                  {/* Explicit Attachments (Files uploaded directly) */}
                  {attachments.length > 0 && (
                    <div className={`space-y-2 ${msg.text ? 'mt-2 pt-2 border-t border-white/10' : ''}`}>
                      {attachments.map((att) => {
                        const resolved = resolveMediaUrl(att.url);
                        const isVideo = att.type === 'video';
                        const isExternal = !att.url.startsWith('/api/media/') && !att.url.startsWith('/api/upload');
                        const isRevealed = !isExternal || isMe || revealedMediaUrls.has(att.url);

                        if (!isRevealed) {
                          const host = (() => {
                            try {
                              return new URL(att.url).hostname;
                            } catch {
                              return 'внешний источник';
                            }
                          })();

                          return (
                            <div
                              key={att.id}
                              className="p-2.5 px-3 bg-black/40 border border-white/10 rounded-xl flex items-center justify-between gap-3 text-xs shadow-md animate-fade-in"
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <div className="w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-500/25 flex items-center justify-center text-amber-400 shrink-0">
                                  <ShieldAlert className="w-4 h-4" />
                                </div>
                                <div className="min-w-0">
                                  <div className="text-gray-200 font-medium truncate flex items-center gap-1.5">
                                    <span>Внешнее {att.type === 'video' ? 'видео' : att.type === 'gif' ? 'GIF' : 'вложение'}</span>
                                    <span className="text-[10px] text-gray-400 font-mono">({host})</span>
                                  </div>
                                  <div className="text-[10px] text-gray-400 truncate">
                                    Загрузка раскроет ваш IP стороннему серверу
                                  </div>
                                </div>
                              </div>

                              <Button
                                variant="glass"
                                size="sm"
                                icon={<Eye className="w-3.5 h-3.5 text-blue-400" />}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setRevealedMediaUrls((prev) => {
                                    const next = new Set(prev);
                                    next.add(att.url);
                                    return next;
                                  });
                                  setTimeout(() => {
                                    if (isAtBottomRef.current) scrollToBottom(true);
                                  }, 50);
                                }}
                                className="shrink-0 text-xs py-1 px-2.5"
                              >
                                Показать
                              </Button>
                            </div>
                          );
                        }

                        return (
                          <div
                            key={att.id}
                            onClick={() =>
                              setViewingMedia({
                                url: att.url,
                                type: att.type,
                                name: att.name,
                                senderNickname: isMe ? 'Вы' : msg.nickname,
                                timestamp: msg.timestamp,
                              })
                            }
                            className="relative rounded-xl overflow-hidden cursor-pointer group/media border border-white/15 hover:border-blue-400/50 transition-all bg-black/40 shadow-lg"
                          >
                            {isVideo ? (
                              <div className="relative aspect-video max-h-56 sm:max-h-64 flex items-center justify-center bg-black">
                                <video
                                  src={resolved}
                                  className="max-h-full max-w-full rounded-xl object-contain pointer-events-none"
                                  preload="metadata"
                                  // @ts-expect-error referrerPolicy is valid HTML5 on video
                                  referrerPolicy="no-referrer"
                                  onLoadedMetadata={handleMediaLoad}
                                />
                                <div className="absolute inset-0 bg-black/35 flex items-center justify-center group-hover/media:bg-black/20 transition-colors">
                                  <div className="w-10 h-10 rounded-full bg-emerald-500/90 text-white flex items-center justify-center shadow-lg group-hover/media:scale-110 transition-transform">
                                    <Play className="w-5 h-5 ml-0.5 fill-current" />
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <img
                                src={resolved}
                                alt={att.name || 'Медиа'}
                                loading="lazy"
                                referrerPolicy="no-referrer"
                                onLoad={handleMediaLoad}
                                className="max-h-56 sm:max-h-64 w-auto rounded-xl object-contain group-hover/media:opacity-95 transition-opacity"
                              />
                            )}

                            <div className="absolute top-2 right-2 flex items-center gap-1.5 pointer-events-none">
                              <Badge
                                variant={att.type === 'video' ? 'emerald' : att.type === 'gif' ? 'amber' : 'blue'}
                                size="sm"
                              >
                                {att.type === 'video' ? 'ВИДЕО' : att.type === 'gif' ? 'GIF' : 'ФОТО'}
                              </Badge>
                            </div>

                            {att.size && (
                              <div className="absolute bottom-1.5 left-2 px-1.5 py-0.5 rounded bg-black/60 text-[10px] text-gray-300 font-mono pointer-events-none">
                                {formatFileSize(att.size)}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Smart Embed Previews from Web URLs in text with Privacy Shield */}
                  {textMediaUrls.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-white/10 space-y-2">
                      {textMediaUrls.map((media) => {
                        const isRevealed = isMe || revealedMediaUrls.has(media.url);
                        const isVideo = media.type === 'video';

                        if (!isRevealed) {
                          const host = (() => {
                            try {
                              return new URL(media.url).hostname;
                            } catch {
                              return 'внешний источник';
                            }
                          })();

                          return (
                            <div
                              key={media.url}
                              className="p-2.5 px-3 bg-black/40 border border-white/10 rounded-xl flex items-center justify-between gap-3 text-xs shadow-md animate-fade-in"
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <div className="w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-500/25 flex items-center justify-center text-amber-400 shrink-0">
                                  <ShieldAlert className="w-4 h-4" />
                                </div>
                                <div className="min-w-0">
                                  <div className="text-gray-200 font-medium truncate flex items-center gap-1.5">
                                    <span>Внешнее {media.type === 'video' ? 'видео' : media.type === 'gif' ? 'GIF' : 'изображение'}</span>
                                    <span className="text-[10px] text-gray-400 font-mono">({host})</span>
                                  </div>
                                  <div className="text-[10px] text-gray-400 truncate">
                                    Загрузка раскроет ваш IP стороннему серверу
                                  </div>
                                </div>
                              </div>

                              <Button
                                variant="glass"
                                size="sm"
                                icon={<Eye className="w-3.5 h-3.5 text-blue-400" />}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setRevealedMediaUrls((prev) => {
                                    const next = new Set(prev);
                                    next.add(media.url);
                                    return next;
                                  });
                                  setTimeout(() => {
                                    if (isAtBottomRef.current) scrollToBottom(true);
                                  }, 50);
                                }}
                                className="shrink-0 text-xs py-1 px-2.5"
                              >
                                Показать
                              </Button>
                            </div>
                          );
                        }

                        return (
                          <div
                            key={media.url}
                            onClick={() =>
                              setViewingMedia({
                                url: media.url,
                                type: media.type,
                                senderNickname: isMe ? 'Вы' : msg.nickname,
                                timestamp: msg.timestamp,
                              })
                            }
                            className="relative rounded-xl overflow-hidden cursor-pointer group/embed border border-white/15 hover:border-blue-400/50 transition-all bg-black/40 shadow-lg animate-fade-in"
                          >
                            {isVideo ? (
                              <div className="relative aspect-video max-h-56 sm:max-h-64 flex items-center justify-center bg-black">
                                <video
                                  src={media.url}
                                  className="max-h-full max-w-full rounded-xl object-contain pointer-events-none"
                                  preload="metadata"
                                  // @ts-expect-error referrerPolicy is valid HTML5 on video
                                  referrerPolicy="no-referrer"
                                  onLoadedMetadata={handleMediaLoad}
                                />
                                <div className="absolute inset-0 bg-black/35 flex items-center justify-center group-hover/embed:bg-black/20 transition-colors">
                                  <div className="w-10 h-10 rounded-full bg-emerald-500/90 text-white flex items-center justify-center shadow-lg group-hover/embed:scale-110 transition-transform">
                                    <Play className="w-5 h-5 ml-0.5 fill-current" />
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <img
                                src={media.url}
                                alt="Превью"
                                loading="lazy"
                                referrerPolicy="no-referrer"
                                onLoad={handleMediaLoad}
                                className="max-h-56 sm:max-h-64 w-auto rounded-xl object-contain group-hover/embed:opacity-95 transition-opacity"
                              />
                            )}

                            <div className="absolute top-2 right-2 pointer-events-none">
                              <Badge
                                variant={media.type === 'video' ? 'emerald' : media.type === 'gif' ? 'amber' : 'blue'}
                                size="sm"
                              >
                                {media.type === 'video' ? 'ВИДЕО' : media.type === 'gif' ? 'GIF' : 'ПРЕВЬЮ'}
                              </Badge>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Upload Error Banner */}
      {uploadError && (
        <div className="px-3 py-1.5 bg-red-500/20 border-t border-red-500/30 flex items-center justify-between text-xs text-red-200">
          <div className="flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />
            <span>{uploadError}</span>
          </div>
          <button
            type="button"
            onClick={() => setUploadError(null)}
            className="text-red-400 hover:text-white cursor-pointer p-0.5"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Staged Attachment Preview Bar */}
      {stagedAttachment && (
        <div className="p-2.5 px-3 bg-[var(--surface)] border-t border-[var(--border)] flex items-center justify-between gap-3 animate-slide-up">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-11 h-11 rounded-[var(--radius)] bg-[var(--bg)] border border-[var(--border)] overflow-hidden flex items-center justify-center shrink-0">
              {stagedAttachment.type === 'video' ? (
                <Video className="w-5 h-5 text-[var(--accent)]" />
              ) : (
                <img
                  src={stagedAttachment.previewUrl}
                  alt="Превью"
                  className="w-full h-full object-cover"
                />
              )}
            </div>

            <div className="min-w-0">
              <p className="text-xs text-[var(--fg)] font-medium truncate max-w-50 sm:max-w-xs">
                {stagedAttachment.file.name}
              </p>
              <div className="flex items-center gap-2 text-[10px] text-[var(--muted)] mt-0.5">
                <Badge
                  variant={stagedAttachment.type === 'video' ? 'blue' : stagedAttachment.type === 'gif' ? 'amber' : 'neutral'}
                  size="sm"
                >
                  {stagedAttachment.type.toUpperCase()}
                </Badge>
                <span className="font-mono">{formatFileSize(stagedAttachment.file.size)}</span>
              </div>
            </div>
          </div>

          <Tooltip content="Отменить вложение" position="top">
            <button
              type="button"
              onClick={handleClearStaged}
              disabled={isUploading}
              className="p-1.5 text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--fg-soft)] rounded-[var(--radius)] transition-colors cursor-pointer disabled:opacity-50"
            >
              <X className="w-4 h-4" />
            </button>
          </Tooltip>
        </div>
      )}

      {/* Input Bar */}
      <form
        onSubmit={handleSubmit}
        className="h-[69px] px-3 sm:px-4 bg-[var(--surface)] border-t border-[var(--border)] flex items-center gap-2 shrink-0"
      >
        {/* Hidden file input */}
        <input
          type="file"
          ref={fileInputRef}
          accept="image/*,video/*"
          onChange={handleFileInputChange}
          className="hidden"
        />

        {/* Attachment Button */}
        <Tooltip
          content="Прикрепить файл"
          description="Изображения, GIF или видео (Ctrl+V для вставки скриншота)"
          position="top"
        >
          <Button
            variant="glass"
            size="md"
            icon={<Paperclip className="w-4 h-4 text-[var(--muted)]" />}
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="w-11 h-11 px-0 rounded-[var(--radius)] shrink-0"
          />
        </Tooltip>

        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          maxLength={1000}
          disabled={isUploading}
          placeholder={`Сообщение в #${roomId}... (Enter для отправки)`}
          className="flex-1 h-11 bg-[var(--bg)] hover:bg-[var(--elevated)]/50 focus:bg-[var(--bg)] border border-[var(--border)] focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] rounded-[var(--radius)] px-3.5 text-base sm:text-sm text-[var(--fg)] placeholder:text-[var(--muted)] focus:outline-none transition-all disabled:opacity-50"
        />

        <Tooltip
          content={isUploading ? 'Загрузка...' : 'Отправить'}
          hotkey="Enter"
          position="top"
          disabled={!inputText.trim() && !stagedAttachment}
        >
          <Button
            variant="primary"
            size="md"
            type="submit"
            isLoading={isUploading}
            disabled={(!inputText.trim() && !stagedAttachment) || isUploading}
            icon={!isUploading ? <Send className="w-4 h-4" /> : undefined}
            className="w-11 h-11 px-0 rounded-[var(--radius)] shrink-0"
          />
        </Tooltip>
      </form>

      {/* Media Viewer Modal */}
      <MediaViewerModal
        item={viewingMedia}
        onClose={() => setViewingMedia(null)}
      />

      {/* External Link Warning Modal */}
      <ExternalLinkModal
        url={confirmExternalUrl}
        onClose={() => setConfirmExternalUrl(null)}
      />
    </div>
  );
});

ChatPanel.displayName = 'ChatPanel';
