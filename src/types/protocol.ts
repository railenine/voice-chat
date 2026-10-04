/**
 * WebSocket Signaling Protocol Types for RVxis
 * Single source of truth for client <-> server signaling communication.
 */

export interface PeerInfo {
  peerId: string;
  nickname: string;
  isMuted: boolean;
  isDeafened?: boolean;
  isSpeaking: boolean;
  connectionState?: 'connected' | 'reconnecting' | 'disconnected';
}

export interface ChatMessage {
  id: string;
  peerId: string;
  nickname: string;
  text: string;
  timestamp: number;
}

export interface WebRTCSessionDescription {
  type: 'offer' | 'answer' | 'pranswer' | 'rollback';
  sdp?: string;
}

export interface WebRTCSignalData {
  description?: WebRTCSessionDescription;
  candidate?: RTCIceCandidateInit;
  reconnect?: boolean;
}

export type ProtocolErrorCode =
  | 'invalid_message'
  | 'rate_limit_exceeded'
  | 'unauthorized'
  | 'room_not_found'
  | 'target_not_found'
  | 'invalid_signal'
  | 'room_full'
  | 'internal_error';

// -------------------------------------------------------------
// Client -> Server Messages
// -------------------------------------------------------------

export interface JoinMessage {
  type: 'join';
  roomId: string;
  peerId: string;
  nickname?: string;
  isMuted?: boolean;
  isDeafened?: boolean;
}

export interface SignalClientMessage {
  type: 'signal';
  to: string;
  data: WebRTCSignalData;
}

export interface UpdateNicknameMessage {
  type: 'update-nickname';
  nickname: string;
}

export interface UpdateMuteMessage {
  type: 'update-mute';
  isMuted: boolean;
}

export interface UpdateDeafenMessage {
  type: 'update-deafen';
  isDeafened: boolean;
}

export interface SpeakingMessage {
  type: 'speaking';
  isSpeaking: boolean;
}

export interface ChatClientMessage {
  type: 'chat-message';
  text: string;
}

export interface LeaveMessage {
  type: 'leave';
  roomId?: string;
}

export type ClientMessage =
  | JoinMessage
  | SignalClientMessage
  | UpdateNicknameMessage
  | UpdateMuteMessage
  | UpdateDeafenMessage
  | SpeakingMessage
  | ChatClientMessage
  | LeaveMessage;

// -------------------------------------------------------------
// Server -> Client Messages
// -------------------------------------------------------------

export interface RoomStateMessage {
  type: 'room-state';
  peers: PeerInfo[];
  messages: ChatMessage[];
  iceServers: RTCIceServer[];
}

export interface UserJoinedMessage {
  type: 'user-joined';
  peer: PeerInfo;
  iceServers: RTCIceServer[];
}

export interface UserLeftMessage {
  type: 'user-left';
  peerId: string;
}

export interface UserUpdatedMessage {
  type: 'user-updated';
  peerId: string;
  nickname: string;
}

export interface UserMutedMessage {
  type: 'user-muted';
  peerId: string;
  isMuted: boolean;
}

export interface UserDeafenedMessage {
  type: 'user-deafened';
  peerId: string;
  isDeafened: boolean;
}

export interface UserSpeakingMessage {
  type: 'user-speaking';
  peerId: string;
  isSpeaking: boolean;
}

export interface SignalServerMessage {
  type: 'signal';
  from: string;
  data: WebRTCSignalData;
}

export interface ChatServerMessage {
  type: 'chat-message';
  message: ChatMessage;
}

export interface ProtocolErrorMessage {
  type: 'error';
  code: ProtocolErrorCode;
  message: string;
}

export type ServerMessage =
  | RoomStateMessage
  | UserJoinedMessage
  | UserLeftMessage
  | UserUpdatedMessage
  | UserMutedMessage
  | UserDeafenedMessage
  | UserSpeakingMessage
  | SignalServerMessage
  | ChatServerMessage
  | ProtocolErrorMessage;
