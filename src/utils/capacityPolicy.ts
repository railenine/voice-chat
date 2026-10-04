/**
 * Room capacity and WebRTC mesh load status policy.
 */

export const MAX_ROOM_CAPACITY = 12;

export interface CapacityStatus {
  count: number;
  max: number;
  isFull: boolean;
  isMeshHeavy: boolean;
}

/**
 * Calculates whether a room is full, near capacity, or in high-mesh territory (>= 8 peers).
 */
export function getRoomCapacityStatus(count: number, max = MAX_ROOM_CAPACITY): CapacityStatus {
  const isFull = count >= max;
  const isMeshHeavy = count >= 8 && !isFull;
  return { count, max, isFull, isMeshHeavy };
}
