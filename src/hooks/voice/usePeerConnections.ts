import { useRef, useCallback, type MutableRefObject } from 'react';
import type { ClientMessage, WebRTCSignalData } from '../../types/protocol';

import { optimizeAudioSdp } from '../../utils/sdp';

export { optimizeAudioSdp };

export interface UsePeerConnectionsProps {
  myPeerIdRef: MutableRefObject<string>;
  streamRef: MutableRefObject<MediaStream | null>;
  sendWsMessage: (msg: ClientMessage) => void;
  handleRemoteStream: (peerId: string, stream: MediaStream) => void;
  teardownPeerAudioGraph: (peerId: string) => void;
  cleanupRemotePeerAudio: (peerId: string) => void;
  removeParticipant: (peerId: string) => void;
  onPeerState: (peerId: string, state: 'connected' | 'reconnecting' | 'disconnected') => void;
  peerConnectionsRef?: MutableRefObject<Map<string, RTCPeerConnection>>;
}

export function usePeerConnections({
  myPeerIdRef,
  streamRef,
  sendWsMessage,
  handleRemoteStream,
  teardownPeerAudioGraph,
  cleanupRemotePeerAudio,
  removeParticipant,
  onPeerState,
  peerConnectionsRef: externalPeerConnectionsRef,
}: UsePeerConnectionsProps) {
  const localPeerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const peerConnectionsRef = externalPeerConnectionsRef || localPeerConnectionsRef;
  const roomGenerationRef = useRef(0);
  const peerGenerationsRef = useRef(new Map<string, number>());
  const signalQueuesRef = useRef(new Map<string, { tail: Promise<void>; pending: number }>());
  const makingOfferRef = useRef<Map<string, boolean>>(new Map());
  const ignoreOfferRef = useRef<Map<string, boolean>>(new Map());
  const pendingCandidatesRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
  const isSettingRemoteAnswerPendingRef = useRef<Map<string, boolean>>(new Map());
  const failedRecoveryTimersRef = useRef<Map<string, any>>(new Map());
  const disconnectedTimersRef = useRef<Map<string, any>>(new Map());
  const rebuildPeerRef = useRef<(peerId: string, notifyRemote?: boolean) => void>(() => {});

  const iceServersRef = useRef<RTCIceServer[]>([
    { urls: 'stun:rvxis.site:3478' },
    { urls: 'stun:stun.cloudflare.com:3478' },
    { urls: 'stun:stun.l.google.com:19302' },
  ]);

  const cleanupPeer = useCallback(
    (peerId: string) => {
      peerGenerationsRef.current.set(peerId, (peerGenerationsRef.current.get(peerId) || 0) + 1);
      signalQueuesRef.current.delete(peerId);
      console.log(`[WebRTC] Cleaning up peer: ${peerId}`);
      const pc = peerConnectionsRef.current.get(peerId);
      if (pc) {
        try {
          pc.close();
        } catch (e) {}
        peerConnectionsRef.current.delete(peerId);
      }

      makingOfferRef.current.delete(peerId);
      ignoreOfferRef.current.delete(peerId);

      const timer = failedRecoveryTimersRef.current.get(peerId);
      if (timer) {
        clearTimeout(timer);
        failedRecoveryTimersRef.current.delete(peerId);
      }
      const discTimer = disconnectedTimersRef.current.get(peerId);
      if (discTimer) {
        clearTimeout(discTimer);
        disconnectedTimersRef.current.delete(peerId);
      }
      pendingCandidatesRef.current.delete(peerId);
      isSettingRemoteAnswerPendingRef.current.delete(peerId);

      cleanupRemotePeerAudio(peerId);
      removeParticipant(peerId);
    },
    [cleanupRemotePeerAudio, removeParticipant]
  );

  const getOrCreatePeerConnection = useCallback(
    (remotePeerId: string): RTCPeerConnection => {
      let pc = peerConnectionsRef.current.get(remotePeerId);
      if (pc) return pc;

      console.log(`[WebRTC] Creating RTCPeerConnection for: ${remotePeerId}`);
      pc = new RTCPeerConnection({
        iceServers: iceServersRef.current,
        bundlePolicy: 'max-bundle',
        rtcpMuxPolicy: 'require',
        iceCandidatePoolSize: 2,
      });
      peerConnectionsRef.current.set(remotePeerId, pc);
      onPeerState(remotePeerId, 'reconnecting');

      const polite = myPeerIdRef.current > remotePeerId;

      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => {
          pc!.addTrack(track, streamRef.current!);
        });
      }

      pc.onnegotiationneeded = async () => {
        if (makingOfferRef.current.get(remotePeerId) || peerConnectionsRef.current.get(remotePeerId) !== pc) return;
        try {
          makingOfferRef.current.set(remotePeerId, true);
          await pc!.setLocalDescription();
          if (peerConnectionsRef.current.get(remotePeerId) !== pc) return;
          const sdp = pc!.localDescription?.sdp
            ? optimizeAudioSdp(pc!.localDescription.sdp)
            : undefined;
          sendWsMessage({
            type: 'signal',
            to: remotePeerId,
            data: {
              description: pc!.localDescription
                ? { type: pc!.localDescription.type, sdp }
                : undefined,
            },
          });
        } catch (err) {
          console.error(`[WebRTC] Negotiation error with ${remotePeerId}:`, err);
        } finally {
          if (peerConnectionsRef.current.get(remotePeerId) === pc) makingOfferRef.current.set(remotePeerId, false);
        }
      };

      pc.onicecandidate = ({ candidate }) => {
        if (peerConnectionsRef.current.get(remotePeerId) !== pc || pc!.connectionState === 'closed') return;
        if (candidate) {
          sendWsMessage({
            type: 'signal',
            to: remotePeerId,
            data: { candidate },
          });
        }
      };

      pc.ontrack = (event) => {
        if (peerConnectionsRef.current.get(remotePeerId) !== pc || pc!.connectionState === 'closed') return;
        console.log(`[WebRTC] ontrack event from ${remotePeerId}`);
        const remoteStream = event.streams[0] || new MediaStream([event.track]);
        handleRemoteStream(remotePeerId, remoteStream);
      };

      const checkStateAndRecover = () => {
        if (peerConnectionsRef.current.get(remotePeerId) !== pc) return;
        const connState = pc!.connectionState;
        const iceState = pc!.iceConnectionState;
        onPeerState(remotePeerId, connState === 'connected' ? 'connected'
          : connState === 'failed' || connState === 'closed' ? 'disconnected' : 'reconnecting');
        console.log(`[WebRTC] Peer ${remotePeerId} state: conn=${connState}, ice=${iceState}`);

        if (
          connState === 'connected' ||
          iceState === 'connected' ||
          iceState === 'completed'
        ) {
          const timer = failedRecoveryTimersRef.current.get(remotePeerId);
          if (timer) {
            clearTimeout(timer);
            failedRecoveryTimersRef.current.delete(remotePeerId);
          }
          const discTimer = disconnectedTimersRef.current.get(remotePeerId);
          if (discTimer) {
            clearTimeout(discTimer);
            disconnectedTimersRef.current.delete(remotePeerId);
          }
          return;
        }

        if (connState === 'disconnected' || iceState === 'disconnected') {
          if (!disconnectedTimersRef.current.has(remotePeerId)) {
            const discTimer = setTimeout(async () => {
              disconnectedTimersRef.current.delete(remotePeerId);
              const curPc = peerConnectionsRef.current.get(remotePeerId);
              if (
                curPc &&
                (curPc.connectionState === 'disconnected' ||
                  curPc.iceConnectionState === 'disconnected')
              ) {
                console.log(
                  `[WebRTC] Peer ${remotePeerId} disconnected >2.5s, triggering ICE restart...`
                );
                try {
                  curPc.restartIce();
                } catch (e) {
                  console.warn(`[WebRTC] ICE restart failed for ${remotePeerId}:`, e);
                }
              }
            }, 2500);
            disconnectedTimersRef.current.set(remotePeerId, discTimer);
          }
        }

        if (connState === 'failed' || iceState === 'failed') {
          if (!failedRecoveryTimersRef.current.has(remotePeerId)) {
            const timer = setTimeout(() => {
              failedRecoveryTimersRef.current.delete(remotePeerId);
              const curPc = peerConnectionsRef.current.get(remotePeerId);
              if (
                curPc &&
                (curPc.connectionState === 'failed' ||
                  curPc.iceConnectionState === 'failed' ||
                  curPc.connectionState === 'disconnected' ||
                  curPc.iceConnectionState === 'disconnected')
              ) {
                console.log(
                  `[WebRTC] Auto-rebuilding failed connection for ${remotePeerId} (coordinated)...`
                );
                rebuildPeerRef.current(remotePeerId, true);
              }
            }, 3500);
            failedRecoveryTimersRef.current.set(remotePeerId, timer);
          }
        }
      };

      pc.onconnectionstatechange = checkStateAndRecover;
      pc.oniceconnectionstatechange = checkStateAndRecover;

      return pc;
    },
    [myPeerIdRef, streamRef, sendWsMessage, handleRemoteStream, onPeerState]
  );

  const rebuildPeer = useCallback(
    (remotePeerId: string, notifyRemote = false) => {
      peerGenerationsRef.current.set(remotePeerId, (peerGenerationsRef.current.get(remotePeerId) || 0) + 1);
      signalQueuesRef.current.delete(remotePeerId);
      console.log(
        `[WebRTC] Rebuilding peer connection for ${remotePeerId} (notifyRemote=${notifyRemote})`
      );

      if (notifyRemote) {
        sendWsMessage({
          type: 'signal',
          to: remotePeerId,
          data: { reconnect: true },
        });
      }

      const oldPc = peerConnectionsRef.current.get(remotePeerId);
      if (oldPc) {
        try {
          oldPc.onconnectionstatechange = null;
          oldPc.oniceconnectionstatechange = null;
          oldPc.onicecandidate = null;
          oldPc.ontrack = null;
          oldPc.onnegotiationneeded = null;
          oldPc.close();
        } catch (e) {}
        peerConnectionsRef.current.delete(remotePeerId);
      }
      makingOfferRef.current.delete(remotePeerId);
      ignoreOfferRef.current.delete(remotePeerId);
      isSettingRemoteAnswerPendingRef.current.delete(remotePeerId);
      pendingCandidatesRef.current.delete(remotePeerId);

      const timer = failedRecoveryTimersRef.current.get(remotePeerId);
      if (timer) {
        clearTimeout(timer);
        failedRecoveryTimersRef.current.delete(remotePeerId);
      }
      const discTimer = disconnectedTimersRef.current.get(remotePeerId);
      if (discTimer) {
        clearTimeout(discTimer);
        disconnectedTimersRef.current.delete(remotePeerId);
      }

      teardownPeerAudioGraph(remotePeerId);

      getOrCreatePeerConnection(remotePeerId);
    },
    [sendWsMessage, teardownPeerAudioGraph, getOrCreatePeerConnection]
  );

  rebuildPeerRef.current = rebuildPeer;

  const processSignal = useCallback(
    async (from: string, data: WebRTCSignalData) => {
      if (data.reconnect) {
        console.log(`[WebRTC] Received coordinated reconnect request from ${from}`);
        rebuildPeer(from, false);
        return;
      }

      const pc = getOrCreatePeerConnection(from);
      const polite = myPeerIdRef.current > from;

      try {
        if (data.description) {
          const description = data.description;
          const isMakingOffer = makingOfferRef.current.get(from) || false;
          const isSettingRemoteAnswerPending =
            isSettingRemoteAnswerPendingRef.current.get(from) || false;

          const readyForOffer =
            !isMakingOffer &&
            (pc.signalingState === 'stable' || isSettingRemoteAnswerPending);
          const offerCollision = description.type === 'offer' && !readyForOffer;

          const ignoreOffer = !polite && offerCollision;
          ignoreOfferRef.current.set(from, ignoreOffer);

          if (ignoreOffer) {
            console.log(`[WebRTC] Collision detected with ${from} (impolite peer ignores offer)`);
            return;
          }

          isSettingRemoteAnswerPendingRef.current.set(from, description.type === 'answer');
          try {
            await pc.setRemoteDescription(description);
          } finally {
            if (peerConnectionsRef.current.get(from) === pc) isSettingRemoteAnswerPendingRef.current.set(from, false);
          }

          if (peerConnectionsRef.current.get(from) !== pc) return;
          if (description.type === 'answer') {
            ignoreOfferRef.current.set(from, false);
          }

          const queue = pendingCandidatesRef.current.get(from);
          if (queue && queue.length > 0) {
            console.log(`[WebRTC] Flushing ${queue.length} queued ICE candidates for ${from}`);
            pendingCandidatesRef.current.delete(from);
            for (const cand of queue) {
              if (peerConnectionsRef.current.get(from) !== pc) return;
              try {
                await pc.addIceCandidate(cand);
              } catch (err) {
                console.warn(`[WebRTC] Error adding queued ICE candidate for ${from}:`, err);
              }
            }
          }

          if (description.type === 'offer') {
            await pc.setLocalDescription();
            if (peerConnectionsRef.current.get(from) !== pc) return;
            const sdp = pc.localDescription?.sdp
              ? optimizeAudioSdp(pc.localDescription.sdp)
              : undefined;
            sendWsMessage({
              type: 'signal',
              to: from,
              data: {
                description: pc.localDescription
                  ? { type: pc.localDescription.type, sdp }
                  : undefined,
              },
            });
          }
        } else if (data.candidate) {
          const isIgnoring = ignoreOfferRef.current.get(from) || false;
          if (isIgnoring) {
            return;
          }

          if (!pc.remoteDescription || !pc.remoteDescription.type) {
            let queue = pendingCandidatesRef.current.get(from);
            if (!queue) {
              queue = [];
              pendingCandidatesRef.current.set(from, queue);
            }
            if (queue.length >= 128) return;
            queue.push(data.candidate);
            console.log(`[WebRTC] Queued early ICE candidate for ${from} (total: ${queue.length})`);
          } else {
            try {
              await pc.addIceCandidate(data.candidate);
            } catch (err) {
              console.warn(`[WebRTC] Error adding ICE candidate from ${from}:`, err);
            }
          }
        }
      } catch (err) {
        console.error(`[WebRTC] Error handling signal from ${from}:`, err);
      }
    },
    [getOrCreatePeerConnection, myPeerIdRef, sendWsMessage, rebuildPeer]
  );

  const handleSignal = useCallback((from: string, data: WebRTCSignalData) => {
    const roomGeneration = roomGenerationRef.current;
    const peerGeneration = peerGenerationsRef.current.get(from) || 0;
    let queue = signalQueuesRef.current.get(from);
    if (!queue) {
      queue = { tail: Promise.resolve(), pending: 0 };
      signalQueuesRef.current.set(from, queue);
    }
    if (queue.pending >= 64) return Promise.resolve();
    const record = queue;
    record.pending++;
    record.tail = record.tail.then(async () => {
      if (roomGeneration === roomGenerationRef.current && peerGeneration === (peerGenerationsRef.current.get(from) || 0)) {
        await processSignal(from, data);
      }
    }).catch(error => console.warn('[WebRTC] Signal handling failed', error)).finally(() => {
      record.pending--;
      if (record.pending === 0 && signalQueuesRef.current.get(from) === record) signalQueuesRef.current.delete(from);
    });
    return record.tail;
  }, [processSignal]);

  const clearAllPeerConnections = useCallback(() => {
    roomGenerationRef.current++;
    signalQueuesRef.current.clear();
    peerGenerationsRef.current.clear();
    peerConnectionsRef.current.forEach((pc) => {
      try {
        pc.close();
      } catch (e) {}
    });
    peerConnectionsRef.current.clear();
    makingOfferRef.current.clear();
    ignoreOfferRef.current.clear();
    failedRecoveryTimersRef.current.forEach((t) => clearTimeout(t));
    failedRecoveryTimersRef.current.clear();
    disconnectedTimersRef.current.forEach((t) => clearTimeout(t));
    disconnectedTimersRef.current.clear();
    pendingCandidatesRef.current.clear();
    isSettingRemoteAnswerPendingRef.current.clear();
  }, []);

  return {
    peerConnectionsRef,
    iceServersRef,
    getOrCreatePeerConnection,
    cleanupPeer,
    rebuildPeer,
    handleSignal,
    clearAllPeerConnections,
  };
}
