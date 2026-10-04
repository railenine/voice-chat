import React, { useState, useCallback, useRef, useEffect, memo } from 'react';
import { useVoiceChat } from '../hooks/useVoiceChat';
import {
  useHotkey,
  isHotkeyMatch,
  isSameHotkey,
  DEFAULT_MUTE_HOTKEY,
  DEFAULT_DEAFEN_HOTKEY,
  HotkeyConfig,
} from '../hooks/useHotkey';
import { Volume2 } from 'lucide-react';
import { useAudioDevices } from '../hooks/useAudioDevices';
import { useScreenShare } from '../hooks/useScreenShare';
import { ScreenShareView } from './ScreenShareView';
import { ScreenShareModal } from './ScreenShareModal';
import { ChatPanel } from './ChatPanel';
import { getShareUrl, isTauri } from '../config';
import { playLeaveSound } from '../utils/soundEffects';
import { JellyBackground } from './JellyBackground';
import { useIsSmartphone } from '../utils/device';
import type { PeerInfo } from '../types/protocol';

import { VoiceConnectionBanner, type BannerState } from './voice/VoiceConnectionBanner';
import { VoiceSharePanel } from './voice/VoiceSharePanel';
import { VoiceMobileHeader } from './voice/VoiceMobileHeader';
import { VoiceMobileParticipants } from './voice/VoiceMobileParticipants';
import { VoiceMobileControls } from './voice/VoiceMobileControls';
import { VoiceSidebar } from './voice/VoiceSidebar';
import { VoiceSettingsModal } from './voice/VoiceSettingsModal';
import { MobilePeerVolumeModal } from './voice/MobilePeerVolumeModal';
import { MobileNicknameModal } from './voice/MobileNicknameModal';

interface VoiceChatScreenProps {
  nickname: string;
  roomId: string;
  deviceState?: ReturnType<typeof useAudioDevices>;
  onLeave?: () => void;
  onCheckUpdates?: () => void;
  hasUpdate?: boolean;
  updateVersion?: string;
}

export const VoiceChatScreen: React.FC<VoiceChatScreenProps> = memo(({
  nickname,
  roomId,
  deviceState,
  onLeave,
  onCheckUpdates,
  hasUpdate,
  updateVersion,
}) => {
  const {
    isConnected,
    isMuted,
    isDeafened,
    isSpeaking,
    peers,
    error,
    connectionStatus,
    reconnectAttempts,
    retryConnection,
    needsAudioUnlock,
    unlockAudio,
    toggleMute,
    toggleDeafen,
    changeNickname,
    peerVolumes,
    setPeerVolume,
    isNoiseSuppression,
    toggleNoiseSuppression,
    messages,
    sendChatMessage,
    myPeerId,
  } = useVoiceChat({
    roomId,
    nickname,
    audioInputDeviceId: deviceState?.selectedInput,
    audioOutputDeviceId: deviceState?.selectedOutput,
  });

  const [hotkeyConflictNotice, setHotkeyConflictNotice] = useState<string | null>(null);

  const deafenHotkeyRef = useRef<HotkeyConfig>(DEFAULT_DEAFEN_HOTKEY);
  const updateDeafenHotkeyRef = useRef<(cfg: HotkeyConfig) => void>(() => {});
  const muteHotkeyRef = useRef<HotkeyConfig>(DEFAULT_MUTE_HOTKEY);
  const updateMuteHotkeyRef = useRef<(cfg: HotkeyConfig) => void>(() => {});

  const handleBeforeMuteUpdate = useCallback((newConfig: HotkeyConfig) => {
    const currentDeafen = deafenHotkeyRef.current;
    if (isSameHotkey(newConfig, currentDeafen)) {
      const replacement = isSameHotkey(newConfig, DEFAULT_DEAFEN_HOTKEY)
        ? muteHotkeyRef.current
        : DEFAULT_DEAFEN_HOTKEY;
      updateDeafenHotkeyRef.current(replacement);
      setHotkeyConflictNotice(
        `Клавиша «${newConfig.label}» была назначена на микрофон. Для глушения звука установлена «${replacement.label}».`
      );
    }
  }, []);

  const handleBeforeDeafenUpdate = useCallback((newConfig: HotkeyConfig) => {
    const currentMute = muteHotkeyRef.current;
    if (isSameHotkey(newConfig, currentMute)) {
      const replacement = isSameHotkey(newConfig, DEFAULT_MUTE_HOTKEY)
        ? deafenHotkeyRef.current
        : DEFAULT_MUTE_HOTKEY;
      updateMuteHotkeyRef.current(replacement);
      setHotkeyConflictNotice(
        `Клавиша «${newConfig.label}» была назначена на глушение звука. Для микрофона установлена «${replacement.label}».`
      );
    }
  }, []);

  const {
    hotkey: muteHotkey,
    isRecording: isMuteRecording,
    isDesktop,
    startRecording: startMuteRecording,
    cancelRecording: cancelMuteRecording,
    resetHotkey: resetMuteHotkey,
    updateHotkey: updateMuteHotkey,
  } = useHotkey({
    onTrigger: toggleMute,
    enabled: true,
    storageKey: 'voice_chat_mute_hotkey',
    defaultHotkey: DEFAULT_MUTE_HOTKEY,
    onBeforeUpdate: handleBeforeMuteUpdate,
  });

  const {
    hotkey: deafenHotkey,
    isRecording: isDeafenRecording,
    startRecording: startDeafenRecording,
    cancelRecording: cancelDeafenRecording,
    resetHotkey: resetDeafenHotkey,
    updateHotkey: updateDeafenHotkey,
  } = useHotkey({
    onTrigger: toggleDeafen,
    enabled: true,
    storageKey: 'voice_chat_deafen_hotkey',
    defaultHotkey: DEFAULT_DEAFEN_HOTKEY,
    onBeforeUpdate: handleBeforeDeafenUpdate,
  });

  useEffect(() => {
    deafenHotkeyRef.current = deafenHotkey;
    updateDeafenHotkeyRef.current = updateDeafenHotkey;
  }, [deafenHotkey, updateDeafenHotkey]);

  useEffect(() => {
    muteHotkeyRef.current = muteHotkey;
    updateMuteHotkeyRef.current = updateMuteHotkey;
  }, [muteHotkey, updateMuteHotkey]);

  const isSmartphone = useIsSmartphone();
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [settingsTab, setSettingsTab] = useState<'audio' | 'hotkeys'>('audio');

  const [showConnectedToast, setShowConnectedToast] = useState(false);
  const prevConnectedRef = useRef(isConnected);

  useEffect(() => {
    if (!prevConnectedRef.current && isConnected) {
      setShowConnectedToast(true);
      const timer = setTimeout(() => {
        setShowConnectedToast(false);
      }, 1200);
      return () => clearTimeout(timer);
    }
    prevConnectedRef.current = isConnected;
  }, [isConnected]);

  const showBanner = !isConnected || Boolean(error) || showConnectedToast;
  const [isRetrying, setIsRetrying] = useState(false);

  const handleRetry = useCallback(() => {
    setIsRetrying(true);
    retryConnection();
    setTimeout(() => {
      setIsRetrying(false);
    }, 1200);
  }, [retryConnection]);

  // Retain banner state during smooth collapse animation so content does not flash-disappear
  const lastBannerStateRef = useRef<BannerState>({
    error,
    showConnectedToast,
    connectionStatus,
    reconnectAttempts,
    isConnected,
  });

  if (showBanner) {
    lastBannerStateRef.current = {
      error,
      showConnectedToast,
      connectionStatus,
      reconnectAttempts,
      isConnected,
    };
  }

  const currentBannerState = showBanner
    ? { error, showConnectedToast, connectionStatus, reconnectAttempts, isConnected }
    : lastBannerStateRef.current;

  const prevVolumesRef = useRef<Map<string, number>>(new Map());

  const [copied, setCopied] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [shareKey, setShareKey] = useState(0);
  const shareTimerRef = useRef<number | null>(null);
  const [myNickname, setMyNickname] = useState(nickname);
  const [isEditingNick, setIsEditingNick] = useState(false);
  const [isMobileEditingNick, setIsMobileEditingNick] = useState(false);
  const [newNickInput, setNewNickInput] = useState(nickname);

  // Screen Sharing via LiveKit SFU (completely isolated from voice WebRTC)
  const screenShare = useScreenShare({
    roomId,
    nickname: myNickname,
    peerId: myPeerId,
    isJoined: isConnected,
  });

  const [watchedPeerId, setWatchedPeerId] = useState<string | null>(null);
  const [showScreenShareModal, setShowScreenShareModal] = useState<boolean>(false);

  // If the peer we are watching stopped streaming, close the view automatically
  useEffect(() => {
    if (watchedPeerId && watchedPeerId !== 'local') {
      const stillStreaming =
        screenShare.streamingPeerIds.has(watchedPeerId) ||
        screenShare.activeStreams.some((s) => s.participantId === watchedPeerId);
      if (!stillStreaming) {
        setWatchedPeerId(null);
      }
    }
  }, [watchedPeerId, screenShare.streamingPeerIds, screenShare.activeStreams]);

  // Selected peer for mobile volume modal
  const [selectedMobilePeer, setSelectedMobilePeer] = useState<PeerInfo | null>(null);
  const [cachedMobilePeer, setCachedMobilePeer] = useState<PeerInfo | null>(null);

  useEffect(() => {
    if (selectedMobilePeer) {
      setCachedMobilePeer(selectedMobilePeer);
    }
  }, [selectedMobilePeer]);

  const closeShare = useCallback(() => {
    if (shareTimerRef.current) {
      clearTimeout(shareTimerRef.current);
      shareTimerRef.current = null;
    }
    setShowShare(false);
  }, []);

  const triggerShare = useCallback(() => {
    if (showShare) {
      closeShare();
      return;
    }

    const url = getShareUrl(roomId);
    navigator.clipboard
      .writeText(url)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      })
      .catch(() => {});

    setShowShare(true);
    setShareKey((k) => k + 1);

    if (shareTimerRef.current) clearTimeout(shareTimerRef.current);
    shareTimerRef.current = window.setTimeout(() => {
      setShowShare(false);
    }, 10000);
  }, [showShare, closeShare, roomId]);

  useEffect(() => {
    return () => {
      if (shareTimerRef.current) clearTimeout(shareTimerRef.current);
    };
  }, []);

  const copyRoomId = useCallback(() => {
    const url = getShareUrl(roomId);
    navigator.clipboard
      .writeText(url)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => {
        const input = document.createElement('input');
        input.value = url;
        document.body.appendChild(input);
        input.select();
        document.execCommand('copy');
        document.body.removeChild(input);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
  }, [roomId]);

  const shareLink = getShareUrl(roomId);

  const handleLeave = () => {
    playLeaveSound();
    if (onLeave) {
      onLeave();
    } else {
      setTimeout(() => {
        if (isTauri()) {
          window.history.replaceState({}, '', window.location.pathname);
          window.location.reload();
        } else {
          window.location.href = window.location.origin;
        }
      }, 200);
    }
  };

  const handleDesktopNickSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newNickInput.trim();
    if (trimmed) {
      changeNickname(trimmed);
      setMyNickname(trimmed);
      try {
        localStorage.setItem('voice_chat_nickname', trimmed);
      } catch (err) {}
      setIsEditingNick(false);
    }
  };

  const handleMobileNickSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newNickInput.trim();
    if (trimmed) {
      changeNickname(trimmed);
      setMyNickname(trimmed);
      try {
        localStorage.setItem('voice_chat_nickname', trimmed);
      } catch (err) {}
      setIsMobileEditingNick(false);
    }
  };

  return (
    <>
      <JellyBackground />

      <div
        className="content-wrapper h-full w-full flex-1 flex flex-col overflow-hidden text-white font-sans animate-fade-in"
        onClick={() => {
          if (needsAudioUnlock) unlockAudio();
        }}
      >
        {/* Audio Unlock Banner */}
        {needsAudioUnlock && (
          <div
            onClick={(e) => {
              e.stopPropagation();
              unlockAudio();
            }}
            className="cursor-pointer bg-gradient-to-r from-amber-600 via-yellow-600 to-amber-600 hover:from-amber-500 hover:to-yellow-500 text-white px-3 sm:px-4 py-2 text-center text-xs sm:text-sm font-medium shadow-lg flex items-center justify-center gap-2 border-b border-amber-400/40 transition-all z-50 animate-slide-down-fade flex-shrink-0"
          >
            <Volume2 className="w-4 h-4 flex-shrink-0 text-white" />
            <span>
              Браузер приостановил звук собеседников.{' '}
              <strong className="underline">Нажмите сюда</strong>, чтобы включить звук.
            </span>
            <button
              type="button"
              className="px-2.5 py-0.5 bg-white text-amber-900 rounded-md font-bold text-xs shadow hover:bg-amber-100 transition-all flex-shrink-0 ml-1"
            >
              Включить
            </button>
          </div>
        )}

        {/* Global Share Panel */}
        <VoiceSharePanel
          showShare={showShare}
          shareLink={shareLink}
          shareKey={shareKey}
          copied={copied}
          copyRoomId={copyRoomId}
          closeShare={closeShare}
        />

        {/* Mobile Header (< 1024px) */}
        <VoiceMobileHeader
          roomId={roomId}
          copied={copied}
          copyRoomId={copyRoomId}
          triggerShare={triggerShare}
          showShare={showShare}
          onOpenSettings={() => {
            setSettingsTab('audio');
            setShowSettingsModal(true);
          }}
          isSmartphone={isSmartphone}
          participantCount={peers.length + 1}
        />

        {/* Mobile Connection / Error Banner (< 1024px) */}
        <VoiceConnectionBanner
          isMobile={true}
          showBanner={showBanner}
          currentBannerState={currentBannerState}
          handleRetry={handleRetry}
          isRetrying={isRetrying}
        />

        {/* Clubhouse-Style Mobile Participants Card (< 1024px) */}
        <VoiceMobileParticipants
          myNickname={myNickname}
          isSpeaking={isSpeaking}
          isMuted={isMuted}
          isDeafened={isDeafened}
          isSharing={screenShare.isSharing}
          peers={peers}
          peerVolumes={peerVolumes}
          streamingPeerIds={screenShare.streamingPeerIds}
          watchedPeerId={watchedPeerId}
          copied={copied}
          copyRoomId={copyRoomId}
          onOpenMobileNickEdit={() => {
            setNewNickInput(myNickname);
            setIsMobileEditingNick(true);
          }}
          onSelectPeer={(peer) => setSelectedMobilePeer(peer)}
          onToggleWatchPeer={(peerId) =>
            setWatchedPeerId((prev) => (prev === peerId ? null : peerId))
          }
        />

        {/* Desktop Sidebar & Main Split */}
        <div className="flex-1 flex min-h-0 overflow-hidden relative">
          <VoiceSidebar
            roomId={roomId}
            myNickname={myNickname}
            isEditingNick={isEditingNick}
            newNickInput={newNickInput}
            setNewNickInput={setNewNickInput}
            onStartEditingNick={() => setIsEditingNick(true)}
            onCancelEditingNick={() => setIsEditingNick(false)}
            onSubmitNick={handleDesktopNickSubmit}
            peers={peers}
            peerVolumes={peerVolumes}
            setPeerVolume={setPeerVolume}
            prevVolumesRef={prevVolumesRef}
            streamingPeerIds={screenShare.streamingPeerIds}
            watchedPeerId={watchedPeerId}
            onToggleWatchPeer={(peerId) =>
              setWatchedPeerId((prev) => (prev === peerId ? null : peerId))
            }
            isSpeaking={isSpeaking}
            isMuted={isMuted}
            isDeafened={isDeafened}
            isNoiseSuppression={isNoiseSuppression}
            canShareScreen={screenShare.isAvailable && screenShare.canShareScreen}
            isSharingScreen={screenShare.isSharing}
            isConnectingScreen={screenShare.isConnecting}
            muteHotkeyLabel={muteHotkey.label}
            deafenHotkeyLabel={deafenHotkey.label}
            toggleMute={toggleMute}
            toggleDeafen={toggleDeafen}
            toggleNoiseSuppression={toggleNoiseSuppression}
            onScreenShareClick={
              screenShare.isSharing
                ? screenShare.stopScreenShare
                : () => setShowScreenShareModal(true)
            }
            handleLeave={handleLeave}
            triggerShare={triggerShare}
            onOpenSettings={() => {
              setSettingsTab('audio');
              setShowSettingsModal(true);
            }}
            isConnected={isConnected}
            error={error}
            connectionStatus={connectionStatus}
            reconnectAttempts={reconnectAttempts}
            showConnectedToast={showConnectedToast}
            isRetrying={isRetrying}
            handleRetry={handleRetry}
            copied={copied}
            copyRoomId={copyRoomId}
          />

          {/* Main Chat & Stream Area */}
          <main className="flex-1 flex flex-col min-w-0 p-2 pt-2 sm:p-4 sm:pt-3 lg:p-5 overflow-hidden gap-3">
            <ScreenShareView
              activeStreams={screenShare.activeStreams}
              localVideoTrack={screenShare.localVideoTrack}
              localAudioTrack={screenShare.localAudioTrack}
              isSharing={screenShare.isSharing}
              myNickname={myNickname}
              watchedPeerId={watchedPeerId}
              onStopSharing={screenShare.stopScreenShare}
              onCloseView={() => setWatchedPeerId(null)}
              onSelectStream={(peerId) => setWatchedPeerId(peerId)}
              streamVolumes={screenShare.streamVolumes}
              onVolumeChange={screenShare.setStreamVolume}
            />

            <ChatPanel
              roomId={roomId}
              messages={messages}
              myPeerId={myPeerId}
              onSendMessage={sendChatMessage}
              participantCount={peers.length + 1}
              className="flex-1 min-h-0"
            />
          </main>
        </div>

        {/* Mobile Sticky Bottom Controls (< 1024px) */}
        <VoiceMobileControls
          isMuted={isMuted}
          isDeafened={isDeafened}
          isNoiseSuppression={isNoiseSuppression}
          canShareScreen={screenShare.isAvailable && screenShare.canShareScreen}
          isSharingScreen={screenShare.isSharing}
          isConnectingScreen={screenShare.isConnecting}
          muteHotkeyLabel={muteHotkey.label}
          deafenHotkeyLabel={deafenHotkey.label}
          toggleMute={toggleMute}
          toggleDeafen={toggleDeafen}
          toggleNoiseSuppression={toggleNoiseSuppression}
          onScreenShareClick={
            screenShare.isSharing
              ? screenShare.stopScreenShare
              : () => setShowScreenShareModal(true)
          }
          handleLeave={handleLeave}
        />
      </div>

      {/* Mobile Peer Volume Modal */}
      <MobilePeerVolumeModal
        selectedMobilePeer={selectedMobilePeer}
        cachedMobilePeer={cachedMobilePeer}
        onClose={() => setSelectedMobilePeer(null)}
        peerVolume={
          cachedMobilePeer ? peerVolumes[cachedMobilePeer.peerId] ?? 100 : 100
        }
        setPeerVolume={setPeerVolume}
        isStreaming={
          cachedMobilePeer
            ? screenShare.streamingPeerIds.has(cachedMobilePeer.peerId)
            : false
        }
        watchedPeerId={watchedPeerId}
        onToggleWatchPeer={(peerId) =>
          setWatchedPeerId((prev) => (prev === peerId ? null : peerId))
        }
        streamVolume={
          cachedMobilePeer
            ? screenShare.streamVolumes[cachedMobilePeer.peerId] ?? 100
            : 100
        }
        onStreamVolumeChange={screenShare.setStreamVolume}
      />

      {/* Mobile Nickname Edit Modal */}
      <MobileNicknameModal
        isOpen={isMobileEditingNick}
        onClose={() => setIsMobileEditingNick(false)}
        newNickInput={newNickInput}
        setNewNickInput={setNewNickInput}
        onSubmit={handleMobileNickSubmit}
      />

      {/* Screen Share Settings Modal */}
      <ScreenShareModal
        isOpen={showScreenShareModal}
        onClose={() => setShowScreenShareModal(false)}
        onConfirm={(options) => {
          setShowScreenShareModal(false);
          screenShare.startScreenShare(options);
        }}
        isConnecting={screenShare.isConnecting}
      />

      {/* Settings Modal */}
      <VoiceSettingsModal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
        isSmartphone={isSmartphone}
        settingsTab={settingsTab}
        setSettingsTab={setSettingsTab}
        deviceState={deviceState}
        hotkeyConflictNotice={hotkeyConflictNotice}
        onCloseConflictNotice={() => setHotkeyConflictNotice(null)}
        muteHotkey={muteHotkey}
        isMuteRecording={isMuteRecording}
        startMuteRecording={startMuteRecording}
        cancelMuteRecording={cancelMuteRecording}
        resetMuteHotkey={resetMuteHotkey}
        updateMuteHotkey={updateMuteHotkey}
        deafenHotkey={deafenHotkey}
        isDeafenRecording={isDeafenRecording}
        startDeafenRecording={startDeafenRecording}
        cancelDeafenRecording={cancelDeafenRecording}
        resetDeafenHotkey={resetDeafenHotkey}
        updateDeafenHotkey={updateDeafenHotkey}
        isDesktop={isDesktop}
        onCheckUpdates={onCheckUpdates}
        hasUpdate={hasUpdate}
        updateVersion={updateVersion}
      />
    </>
  );
});

VoiceChatScreen.displayName = 'VoiceChatScreen';
