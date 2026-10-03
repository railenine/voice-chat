/**
 * WebSocket Protocol Validation & Helpers for RVxis Server
 * Provides strict runtime validation, sanitization, and standardized error responses.
 */

export const ROOM_ID_REGEX = /^[a-zA-Z0-9_-]{3,64}$/;
export const PEER_ID_REGEX = /^[a-zA-Z0-9_-]{3,64}$/;

/**
 * Sanitizes and normalizes nicknames:
 * - Strips ASCII control characters (\x00-\x1F, \x7F)
 * - Trims whitespace
 * - Enforces max length 32
 * - Defaults to 'Аноним' if empty
 */
export function sanitizeNickname(rawNick, defaultNick = 'User') {
  if (typeof rawNick !== 'string') return defaultNick;
  const cleaned = rawNick.replace(/[\x00-\x1F\x7F]/g, '').trim().slice(0, 32);
  return cleaned || defaultNick;
}

/**
 * Formats standardized protocol error messages.
 * Never leaks stack traces or internal implementation details.
 */
export function createProtocolError(code, message) {
  return {
    type: 'error',
    code,
    message: String(message || 'An error occurred').slice(0, 200),
  };
}

/**
 * Runtime validation for incoming ClientMessage payloads over WebSocket.
 *
 * @param {any} msg - Parsed JSON payload
 * @param {{ roomId: string, peerId: string } | null} clientMeta - Current connection metadata
 * @returns {{ valid: true, data: any } | { valid: false, code: string, message: string }}
 */
export function validateClientMessage(msg, clientMeta = null) {
  if (!msg || typeof msg !== 'object' || Array.isArray(msg)) {
    return {
      valid: false,
      code: 'invalid_message',
      message: 'Message payload must be a JSON object',
    };
  }

  const { type } = msg;
  if (!type || typeof type !== 'string') {
    return {
      valid: false,
      code: 'invalid_message',
      message: 'Message type must be a non-empty string',
    };
  }

  switch (type) {
    case 'join': {
      const { roomId, peerId, nickname, isMuted, isDeafened } = msg;

      if (!roomId || typeof roomId !== 'string' || !ROOM_ID_REGEX.test(roomId)) {
        return {
          valid: false,
          code: 'invalid_message',
          message: 'roomId must be 3-64 characters matching [a-zA-Z0-9_-]',
        };
      }

      if (!peerId || typeof peerId !== 'string' || !PEER_ID_REGEX.test(peerId)) {
        return {
          valid: false,
          code: 'invalid_message',
          message: 'peerId must be 3-64 characters matching [a-zA-Z0-9_-]',
        };
      }

      return {
        valid: true,
        data: {
          type: 'join',
          roomId,
          peerId,
          nickname: sanitizeNickname(nickname),
          isMuted: Boolean(isMuted),
          isDeafened: Boolean(isDeafened),
        },
      };
    }

    case 'signal': {
      if (!clientMeta) {
        return {
          valid: false,
          code: 'unauthorized',
          message: 'Must join a room before sending WebRTC signals',
        };
      }

      const { to, data } = msg;
      if (!to || typeof to !== 'string' || !PEER_ID_REGEX.test(to)) {
        return {
          valid: false,
          code: 'invalid_message',
          message: 'Invalid recipient peerId in signal',
        };
      }

      if (to === clientMeta.peerId) {
        return {
          valid: false,
          code: 'invalid_signal',
          message: 'Cannot send WebRTC signal to yourself',
        };
      }

      if (!data || typeof data !== 'object') {
        return {
          valid: false,
          code: 'invalid_signal',
          message: 'Signal data payload is required',
        };
      }

      // Check description (SDP offer/answer)
      const isDescription =
        data.description &&
        typeof data.description === 'object' &&
        typeof data.description.type === 'string' &&
        ['offer', 'answer', 'pranswer', 'rollback'].includes(data.description.type) &&
        (data.description.sdp === undefined ||
          (typeof data.description.sdp === 'string' && data.description.sdp.length <= 65536));

      // Direct SDP object
      const isDirectSdp =
        (data.type === 'offer' || data.type === 'answer') &&
        typeof data.sdp === 'string' &&
        data.sdp.length <= 65536;

      // ICE candidate
      const isCandidate =
        data.candidate !== undefined &&
        (data.candidate === null ||
          typeof data.candidate === 'object' ||
          (typeof data.candidate === 'string' && data.candidate.length <= 8192));

      // Coordinated reconnect
      const isReconnect = data.reconnect === true;

      if (!isDescription && !isDirectSdp && !isCandidate && !isReconnect) {
        return {
          valid: false,
          code: 'invalid_signal',
          message: 'Signal data must contain a valid description, candidate, or reconnect instruction',
        };
      }

      return {
        valid: true,
        data: {
          type: 'signal',
          to,
          data,
        },
      };
    }

    case 'update-nickname': {
      if (!clientMeta) {
        return {
          valid: false,
          code: 'unauthorized',
          message: 'Must join a room before updating nickname',
        };
      }

      const { nickname } = msg;
      if (!nickname || typeof nickname !== 'string' || !nickname.trim()) {
        return {
          valid: false,
          code: 'invalid_message',
          message: 'Nickname must be a non-empty string',
        };
      }

      return {
        valid: true,
        data: {
          type: 'update-nickname',
          nickname: sanitizeNickname(nickname),
        },
      };
    }

    case 'update-mute': {
      if (!clientMeta) {
        return {
          valid: false,
          code: 'unauthorized',
          message: 'Must join a room before updating mute status',
        };
      }

      if (typeof msg.isMuted !== 'boolean') {
        return {
          valid: false,
          code: 'invalid_message',
          message: 'isMuted must be a boolean',
        };
      }

      return {
        valid: true,
        data: {
          type: 'update-mute',
          isMuted: msg.isMuted,
        },
      };
    }

    case 'update-deafen': {
      if (!clientMeta) {
        return {
          valid: false,
          code: 'unauthorized',
          message: 'Must join a room before updating deafen status',
        };
      }

      if (typeof msg.isDeafened !== 'boolean') {
        return {
          valid: false,
          code: 'invalid_message',
          message: 'isDeafened must be a boolean',
        };
      }

      return {
        valid: true,
        data: {
          type: 'update-deafen',
          isDeafened: msg.isDeafened,
        },
      };
    }

    case 'speaking': {
      if (!clientMeta) {
        return {
          valid: false,
          code: 'unauthorized',
          message: 'Must join a room before sending speaking state',
        };
      }

      if (typeof msg.isSpeaking !== 'boolean') {
        return {
          valid: false,
          code: 'invalid_message',
          message: 'isSpeaking must be a boolean',
        };
      }

      return {
        valid: true,
        data: {
          type: 'speaking',
          isSpeaking: msg.isSpeaking,
        },
      };
    }

    case 'chat-message': {
      if (!clientMeta) {
        return {
          valid: false,
          code: 'unauthorized',
          message: 'Must join a room before sending chat messages',
        };
      }

      const { text } = msg;
      if (!text || typeof text !== 'string') {
        return {
          valid: false,
          code: 'invalid_message',
          message: 'Chat text must be a string',
        };
      }

      const trimmedText = text.trim();
      if (!trimmedText) {
        return {
          valid: false,
          code: 'invalid_message',
          message: 'Chat message cannot be empty',
        };
      }

      if (trimmedText.length > 1000) {
        return {
          valid: false,
          code: 'invalid_message',
          message: 'Chat message exceeds maximum length of 1000 characters',
        };
      }

      return {
        valid: true,
        data: {
          type: 'chat-message',
          text: trimmedText,
        },
      };
    }

    case 'leave': {
      return {
        valid: true,
        data: {
          type: 'leave',
        },
      };
    }

    default: {
      return {
        valid: false,
        code: 'invalid_message',
        message: `Unknown message type: ${String(type).slice(0, 32)}`,
      };
    }
  }
}
