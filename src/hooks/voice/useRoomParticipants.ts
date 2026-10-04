import { useState, useRef, useCallback } from 'react';
import type { PeerInfo } from '../../types/protocol';

export function useRoomParticipants() {
  const peersInfoRef = useRef<Map<string, PeerInfo>>(new Map());
  const [peers, setPeers] = useState<PeerInfo[]>([]);

  const syncPeersState = useCallback(() => {
    setPeers(Array.from(peersInfoRef.current.values()));
  }, []);

  const setParticipants = useCallback((peerList: PeerInfo[]) => {
    peersInfoRef.current.clear();
    if (Array.isArray(peerList)) {
      for (const p of peerList) {
        peersInfoRef.current.set(p.peerId, p);
      }
    }
    syncPeersState();
  }, [syncPeersState]);

  const upsertParticipant = useCallback((peer: PeerInfo) => {
    peersInfoRef.current.set(peer.peerId, peer);
    syncPeersState();
  }, [syncPeersState]);

  const removeParticipant = useCallback((peerId: string) => {
    const deleted = peersInfoRef.current.delete(peerId);
    if (deleted) {
      syncPeersState();
    }
  }, [syncPeersState]);

  const updateParticipantNickname = useCallback((peerId: string, nickname: string) => {
    const info = peersInfoRef.current.get(peerId);
    if (info) {
      info.nickname = nickname;
      peersInfoRef.current.set(peerId, info);
      syncPeersState();
    }
  }, [syncPeersState]);

  const updateParticipantMute = useCallback((peerId: string, isMuted: boolean) => {
    const info = peersInfoRef.current.get(peerId);
    if (info) {
      info.isMuted = isMuted;
      peersInfoRef.current.set(peerId, info);
      syncPeersState();
    }
  }, [syncPeersState]);

  const updateParticipantDeafen = useCallback((peerId: string, isDeafened: boolean) => {
    const info = peersInfoRef.current.get(peerId);
    if (info) {
      info.isDeafened = isDeafened;
      if (isDeafened) {
        info.isMuted = true;
        info.isSpeaking = false;
      }
      peersInfoRef.current.set(peerId, info);
      syncPeersState();
    }
  }, [syncPeersState]);

  const updateParticipantSpeaking = useCallback((peerId: string, isSpeaking: boolean) => {
    const info = peersInfoRef.current.get(peerId);
    if (info) {
      if (info.isSpeaking === isSpeaking) return;
      info.isSpeaking = isSpeaking;
      peersInfoRef.current.set(peerId, info);
      syncPeersState();
    }
  }, [syncPeersState]);

  const clearParticipants = useCallback(() => {
    peersInfoRef.current.clear();
    setPeers([]);
  }, []);

  return {
    peers,
    peersInfoRef,
    setParticipants,
    upsertParticipant,
    removeParticipant,
    updateParticipantNickname,
    updateParticipantMute,
    updateParticipantDeafen,
    updateParticipantSpeaking,
    clearParticipants,
    syncPeersState,
  };
}
