// Included before the application only in the separate TURN test archive.
(() => {
  const NativePeer = window.RTCPeerConnection;
  const peers = [];
  window.RTCPeerConnection = class extends NativePeer {
    constructor(configuration) {
      super({ ...configuration, iceTransportPolicy: 'relay' });
      peers.push(this);
    }
    setConfiguration(configuration) {
      return super.setConfiguration({ ...configuration, iceTransportPolicy: 'relay' });
    }
  };
  window.rvxTurnReport = async () => Promise.all(peers.filter(pc => pc.connectionState !== 'closed').map(async (pc, index) => {
    const stats = await pc.getStats();
    const entries = [...stats.values()];
    const transport = entries.find(s => s.type === 'transport' && s.selectedCandidatePairId);
    const pair = transport ? stats.get(transport.selectedCandidatePairId)
      : entries.find(s => s.type === 'candidate-pair' && s.state === 'succeeded' && s.nominated);
    const local = pair && stats.get(pair.localCandidateId);
    const remote = pair && stats.get(pair.remoteCandidateId);
    const incoming = entries.filter(s => s.type === 'inbound-rtp' && s.kind === 'audio');
    const outgoing = entries.filter(s => s.type === 'outbound-rtp' && s.kind === 'audio');
    const received = incoming.reduce((n, s) => n + (s.bytesReceived || 0), 0);
    const sent = outgoing.reduce((n, s) => n + (s.bytesSent || 0), 0);
    const policy = pc.getConfiguration().iceTransportPolicy;
    return { peer: index + 1, policy, state: pc.connectionState,
      localCandidate: local?.candidateType ?? null, remoteCandidate: remote?.candidateType ?? null,
      protocol: local?.protocol ?? null, relayProtocol: local?.relayProtocol ?? null,
      audioBytesReceived: received, audioBytesSent: sent,
      passed: policy === 'relay' && pc.connectionState === 'connected' &&
        local?.candidateType === 'relay' && remote?.candidateType === 'relay' && received > 0 && sent > 0 };
  }));
  console.info('[STAGING TURN] Relay-only enabled. Report: await rvxTurnReport()');
})();
