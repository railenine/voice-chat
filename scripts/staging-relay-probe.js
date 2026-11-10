// Included before the application only in the separate TURN test archive.
(() => {
  const NativePeer = window.RTCPeerConnection;
  const peers = [];
  const profile = new URLSearchParams(window.location?.search || '').get('turn') || 'all';
  const constrain = (configuration = {}) => {
    const matches = url => {
      try {
        const parsed = new URL(url);
        const transport = parsed.searchParams.get('transport');
        if (profile === 'udp') return parsed.protocol === 'turn:' && (!transport || transport === 'udp');
        if (profile === 'tcp') return parsed.protocol === 'turn:' && transport === 'tcp';
        if (profile === 'tls') return parsed.protocol === 'turns:' && (!transport || transport === 'tcp');
      } catch {}
      return false;
    };
    const iceServers = profile === 'all' ? configuration.iceServers : (configuration.iceServers || [])
      .map(server => ({ ...server, urls: (Array.isArray(server.urls) ? server.urls : [server.urls]).filter(matches) }))
      .filter(server => server.urls.length);
    return { ...configuration, iceServers, iceTransportPolicy: 'relay' };
  };
  window.RTCPeerConnection = class extends NativePeer {
    constructor(configuration) {
      super(constrain(configuration));
      peers.push(this);
    }
    setConfiguration(configuration) {
      return super.setConfiguration(constrain(configuration));
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
    return { peer: index + 1, profile, policy, state: pc.connectionState,
      localCandidate: local?.candidateType ?? null, remoteCandidate: remote?.candidateType ?? null,
      protocol: local?.protocol ?? null, relayProtocol: local?.relayProtocol ?? null,
      audioBytesReceived: received, audioBytesSent: sent,
      passed: policy === 'relay' && pc.connectionState === 'connected' &&
        local?.candidateType === 'relay' && remote?.candidateType === 'relay' && received > 0 && sent > 0 &&
        (profile === 'all' || (['udp', 'tcp', 'tls'].includes(profile) && local?.relayProtocol === profile)) };
  }));
  console.info(`[STAGING TURN] Relay-only profile: ${profile}. Report: await rvxTurnReport()`);
})();
