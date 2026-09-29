import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Room,
  RoomEvent,
  Track,
  RemoteTrack,
  RemoteVideoTrack,
  RemoteAudioTrack,
  LocalVideoTrack,
  LocalAudioTrack,
  RemoteTrackPublication,
  RemoteParticipant,
  LocalTrackPublication,
} from 'livekit-client';
import { getBackendBaseUrl } from '../config';
import { canDeviceShareScreen } from '../utils/device';
import { playStreamStartSound, playStreamStopSound } from '../utils/soundEffects';

export interface RemoteScreenShare {
  participantId: string;
  participantName: string;
  videoTrack: RemoteVideoTrack | null;
  audioTrack: RemoteAudioTrack | null;
  hasAudio: boolean;
}

export type ScreenShareQualityPreset = '1440p30' | '1080p60' | '1080p30' | '720p30';

export interface StartScreenShareOptions {
  quality?: ScreenShareQualityPreset;
  includeAudio?: boolean;
}

export interface ScreenSharePresetInfo {
  id: ScreenShareQualityPreset;
  label: string;
  badge: string;
  desc: string;
  width: number;
  height: number;
  frameRate: number;
}

export const SCREEN_SHARE_PRESETS: Record<ScreenShareQualityPreset, ScreenSharePresetInfo> = {
  '1440p30': {
    id: '1440p30',
    label: '1440p • 30 FPS',
    badge: '2K Ultra',
    desc: 'Максимальная чёткость для 2K-мониторов и текста',
    width: 2560,
    height: 1440,
    frameRate: 30,
  },
  '1080p60': {
    id: '1080p60',
    label: '1080p • 60 FPS',
    badge: 'Плавный',
    desc: 'Идеально для динамичных игр и видео',
    width: 1920,
    height: 1080,
    frameRate: 60,
  },
  '1080p30': {
    id: '1080p30',
    label: '1080p • 30 FPS',
    badge: 'Баланс',
    desc: 'Стандартная чёткость для работы и сёрфинга',
    width: 1920,
    height: 1080,
    frameRate: 30,
  },
  '720p30': {
    id: '720p30',
    label: '720p • 30 FPS',
    badge: 'Экономный',
    desc: 'Минимальная нагрузка на сеть и слабый ПК',
    width: 1280,
    height: 720,
    frameRate: 30,
  },
};

export interface UseScreenShareProps {
  roomId: string | null;
  nickname: string;
  peerId: string;
  isJoined: boolean;
}

export function useScreenShare({
  roomId,
  nickname,
  peerId,
  isJoined,
}: UseScreenShareProps) {
  const [isAvailable, setIsAvailable] = useState<boolean>(false);
  const [isSharing, setIsSharing] = useState<boolean>(false);
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Active remote screen shares from other users: participantId -> RemoteScreenShare
  const [activeStreams, setActiveStreams] = useState<RemoteScreenShare[]>([]);
  // Set of participant identities who are currently streaming (used for badges)
  const [streamingPeerIds, setStreamingPeerIds] = useState<Set<string>>(new Set());

  // Volume for each remote stream (0 to 100, default 100)
  const [streamVolumes, setStreamVolumes] = useState<Record<string, number>>({});

  // Local tracks
  const [localVideoTrack, setLocalVideoTrack] = useState<LocalVideoTrack | null>(null);
  const [localAudioTrack, setLocalAudioTrack] = useState<LocalAudioTrack | null>(null);

  const roomRef = useRef<Room | null>(null);
  const isJoinedRef = useRef(isJoined);
  isJoinedRef.current = isJoined;

  const initialSyncDoneRef = useRef(false);
  const knownStreamingIdsRef = useRef<Set<string>>(new Set());

  // 1. Check if LiveKit SFU is enabled and configured on the backend
  useEffect(() => {
    let mounted = true;
    const checkStatus = async () => {
      try {
        const res = await fetch(`${getBackendBaseUrl()}/api/livekit/status`);
        if (!res.ok) return;
        const data = await res.json();
        if (mounted) {
          setIsAvailable(Boolean(data.available));
        }
      } catch (err) {
        if (mounted) setIsAvailable(false);
      }
    };
    checkStatus();
    return () => {
      mounted = false;
    };
  }, []);

  // Helper to sync active remote screen shares from connected room
  const syncRemoteStreams = useCallback((room: Room) => {
    const streams: RemoteScreenShare[] = [];
    const broadcastingIds = new Set<string>();

    room.remoteParticipants.forEach((participant: RemoteParticipant) => {
      let videoTrack: RemoteVideoTrack | null = null;
      let audioTrack: RemoteAudioTrack | null = null;
      participant.trackPublications.forEach((pub: RemoteTrackPublication) => {
        if (
          pub.source === Track.Source.ScreenShare &&
          pub.track instanceof RemoteVideoTrack &&
          pub.track.mediaStreamTrack &&
          pub.track.mediaStreamTrack.readyState === 'live'
        ) {
          videoTrack = pub.track;
          if (!pub.track.mediaStreamTrack.onended) {
            pub.track.mediaStreamTrack.onended = () => {
              syncRemoteStreams(room);
            };
          }
        } else if (
          pub.source === Track.Source.ScreenShareAudio &&
          pub.track instanceof RemoteAudioTrack &&
          pub.track.mediaStreamTrack &&
          pub.track.mediaStreamTrack.readyState === 'live'
        ) {
          audioTrack = pub.track;
        }
      });

      const hasLiveScreenPub = participant.getTrackPublications().some(
        (p) => p.source === Track.Source.ScreenShare && !p.isMuted
      );
      const isBroadcasting = Boolean(videoTrack) || participant.isScreenShareEnabled || hasLiveScreenPub;

      if (isBroadcasting) {
        broadcastingIds.add(participant.identity);
      }

      if (videoTrack) {
        streams.push({
          participantId: participant.identity,
          participantName: participant.name || participant.identity,
          videoTrack,
          audioTrack,
          hasAudio: Boolean(audioTrack),
        });
      }
    });

    setActiveStreams(streams);
    setStreamingPeerIds(broadcastingIds);

    // Audio cues: only trigger AFTER initial sync is complete (never on room entry)
    if (!initialSyncDoneRef.current) {
      initialSyncDoneRef.current = true;
      knownStreamingIdsRef.current = new Set(broadcastingIds);
    } else {
      let newStreamerStarted = false;
      for (const id of broadcastingIds) {
        if (!knownStreamingIdsRef.current.has(id)) {
          newStreamerStarted = true;
          break;
        }
      }

      if (newStreamerStarted) {
        playStreamStartSound();
      } else if (knownStreamingIdsRef.current.size > 0 && broadcastingIds.size === 0) {
        playStreamStopSound();
      }

      knownStreamingIdsRef.current = new Set(broadcastingIds);
    }
  }, []);

  // 2. Connect to LiveKit Room when user enters the voice room
  useEffect(() => {
    if (!isJoined || !roomId || !isAvailable) {
      if (roomRef.current) {
        roomRef.current.disconnect();
        roomRef.current = null;
      }
      setIsSharing(false);
      setActiveStreams([]);
      setStreamingPeerIds(new Set());
      setLocalVideoTrack(null);
      setLocalAudioTrack(null);
      return;
    }

    let isCancelled = false;

    const connectLiveKit = async () => {
      try {
        setError(null);
        // Request token from backend
        const tokenRes = await fetch(`${getBackendBaseUrl()}/api/livekit/token`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ roomId, nickname, peerId }),
        });

        if (!tokenRes.ok) {
          const errData = await tokenRes.json().catch(() => ({}));
          console.warn('[LiveKit] Token request failed:', errData);
          return;
        }

        const { token, livekitUrl } = await tokenRes.json();
        if (isCancelled || !isJoinedRef.current) return;

        // Initialize LiveKit room with adaptive streaming (conserves CPU and bandwidth automatically)
        const room = new Room({
          adaptiveStream: true,
          dynacast: true,
        });

        roomRef.current = room;

        // Listen for track subscription and publication events
        room.on(RoomEvent.TrackPublished, () => syncRemoteStreams(room));
        room.on(RoomEvent.TrackUnpublished, () => syncRemoteStreams(room));
        room.on(RoomEvent.TrackSubscribed, () => syncRemoteStreams(room));
        room.on(RoomEvent.TrackUnsubscribed, () => syncRemoteStreams(room));
        room.on(RoomEvent.TrackMuted, () => syncRemoteStreams(room));
        room.on(RoomEvent.TrackUnmuted, () => syncRemoteStreams(room));

        room.on(RoomEvent.ParticipantConnected, () => syncRemoteStreams(room));
        room.on(RoomEvent.ParticipantDisconnected, () => syncRemoteStreams(room));

        room.on(RoomEvent.LocalTrackPublished, () => syncRemoteStreams(room));
        room.on(RoomEvent.LocalTrackUnpublished, (pub: LocalTrackPublication) => {
          if (pub.source === Track.Source.ScreenShare) {
            setIsSharing(false);
            setLocalVideoTrack(null);
          } else if (pub.source === Track.Source.ScreenShareAudio) {
            setLocalAudioTrack(null);
          }
          syncRemoteStreams(room);
        });

        room.on(RoomEvent.Disconnected, () => {
          initialSyncDoneRef.current = false;
          knownStreamingIdsRef.current = new Set();
          setIsSharing(false);
          setActiveStreams([]);
          setStreamingPeerIds(new Set());
        });

        await room.connect(livekitUrl, token, {
          autoSubscribe: true,
        });
        console.log('[LiveKit] Successfully connected to SFU room:', roomId);
        if (!isCancelled) {
          syncRemoteStreams(room);
        }
      } catch (err: any) {
        if (!isCancelled) {
          console.error('[LiveKit] Connection error:', err);
          setError(err?.message || 'Failed to connect to LiveKit');
        }
      }
    };

    connectLiveKit();

    return () => {
      isCancelled = true;
      initialSyncDoneRef.current = false;
      knownStreamingIdsRef.current = new Set();
      if (roomRef.current) {
        roomRef.current.disconnect();
        roomRef.current = null;
      }
    };
  }, [isJoined, roomId, nickname, peerId, isAvailable, syncRemoteStreams]);

  // 3. Start Screen Sharing
  const startScreenShare = useCallback(async (options?: StartScreenShareOptions) => {
    if (!canDeviceShareScreen()) {
      setError('Демонстрация экрана доступна только на ПК (Windows, macOS, Linux). С мобильных устройств стриминг запрещен.');
      return;
    }

    const room = roomRef.current;
    if (!room) {
      setError('LiveKit room is not connected');
      return;
    }

    const quality = options?.quality || '1080p30';
    const includeAudio = options?.includeAudio ?? true;
    const preset = SCREEN_SHARE_PRESETS[quality] || SCREEN_SHARE_PRESETS['1080p30'];

    try {
      setIsConnecting(true);
      setError(null);

      // setScreenShareEnabled handles getDisplayMedia with specified quality & audio
      await room.localParticipant.setScreenShareEnabled(true, {
        audio: includeAudio,
        selfBrowserSurface: 'include',
        surfaceSwitching: 'include',
        systemAudio: includeAudio ? 'include' : 'exclude',
        resolution: {
          width: preset.width,
          height: preset.height,
          frameRate: preset.frameRate,
        },
      });

      // Extract local tracks for UI preview and state
      let vTrack: LocalVideoTrack | null = null;
      let aTrack: LocalAudioTrack | null = null;

      room.localParticipant.trackPublications.forEach((pub) => {
        if (pub.source === Track.Source.ScreenShare && pub.track instanceof LocalVideoTrack) {
          vTrack = pub.track;
        } else if (
          pub.source === Track.Source.ScreenShareAudio &&
          pub.track instanceof LocalAudioTrack
        ) {
          aTrack = pub.track;
        }
      });

      setLocalVideoTrack(vTrack);
      setLocalAudioTrack(aTrack);
      setIsSharing(true);
      playStreamStartSound();

      // Handle native browser "Stop sharing" bar click
      if (vTrack) {
        (vTrack as LocalVideoTrack).mediaStreamTrack.onended = () => {
          console.log('[LiveKit] Screen share stopped by user via browser bar');
          stopScreenShare();
        };
      }
    } catch (err: any) {
      if (err?.name === 'NotAllowedError' || err?.name === 'AbortError') {
        console.log('[LiveKit] Screen sharing cancelled by user');
      } else {
        console.error('[LiveKit] Error starting screen share:', err);
        setError(err?.message || 'Failed to share screen');
      }
      setIsSharing(false);
    } finally {
      setIsConnecting(false);
    }
  }, []);

  // 4. Stop Screen Sharing
  const stopScreenShare = useCallback(async () => {
    const room = roomRef.current;
    if (!room) return;

    try {
      if (localVideoTrack) {
        localVideoTrack.mediaStreamTrack.stop();
      }
      if (localAudioTrack) {
        localAudioTrack.mediaStreamTrack.stop();
      }
      await room.localParticipant.setScreenShareEnabled(false);
      playStreamStopSound();
    } catch (err) {
      console.warn('[LiveKit] Error disabling screen share:', err);
    } finally {
      setIsSharing(false);
      setLocalVideoTrack(null);
      setLocalAudioTrack(null);
      if (room) {
        syncRemoteStreams(room);
      }
    }
  }, [localVideoTrack, localAudioTrack, syncRemoteStreams]);

  // 5. Volume control for remote streams
  const setStreamVolume = useCallback((participantId: string, volume: number) => {
    const clamped = Math.max(0, Math.min(100, volume));
    setStreamVolumes((prev) => ({ ...prev, [participantId]: clamped }));

    // Find remote audio track and apply volume
    const stream = activeStreams.find((s) => s.participantId === participantId);
    if (stream && stream.audioTrack) {
      // livekit-client setVolume takes 0.0 to 1.0 (with headroom up to 2.0)
      stream.audioTrack.setVolume(clamped / 100);
    }
  }, [activeStreams]);

  return {
    isAvailable,
    canShareScreen: canDeviceShareScreen(),
    isSharing,
    isConnecting,
    error,
    localVideoTrack,
    localAudioTrack,
    activeStreams,
    streamingPeerIds,
    streamVolumes,
    startScreenShare,
    stopScreenShare,
    setStreamVolume,
  };
}
