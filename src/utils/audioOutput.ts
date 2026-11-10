import { normalizeSinkId } from './devicePolicy';

type OutputTarget = { setSinkId?: (id: string) => Promise<void>; readonly sinkId?: string };
const pending = new WeakMap<OutputTarget, Promise<boolean>>();
const listeners = new Set<(message: string) => void>();

export function subscribeAudioOutputErrors(listener: (message: string) => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

function report(error: unknown, onError?: (message: string) => void) {
  const name = (error as { name?: string })?.name;
  const message = name === 'NotAllowedError'
    ? 'Браузер не разрешил выбранное устройство вывода. Проверьте разрешения сайта.'
    : name === 'NotFoundError'
      ? 'Выбранное устройство вывода недоступно. Выберите подключённое устройство.'
      : name === 'NotSupportedError'
        ? 'Этот браузер не поддерживает выбор устройства вывода.'
        : 'Не удалось переключить устройство вывода. Попробуйте выбрать его снова.';
  if (onError) onError(message);
  else for (const listener of listeners) listener(message);
}

// Serialize per playback target: a slow older switch must not overwrite a newer
// choice. Never silently substitute the Windows default for a requested device.
export function applyAudioOutput(target: OutputTarget, deviceId?: string | null,
  onError?: (message: string) => void): Promise<boolean> {
  const sinkId = normalizeSinkId(deviceId);
  const apply = async () => {
    try {
      if (typeof target.setSinkId !== 'function') {
        if (!sinkId) return true;
        throw new DOMException('setSinkId unavailable', 'NotSupportedError');
      }
      await target.setSinkId(sinkId);
      if (typeof target.sinkId === 'string' && target.sinkId !== sinkId) {
        throw new Error('Output device was not applied');
      }
      return true;
    } catch (error) { report(error, onError); return false; }
  };
  const previous = pending.get(target);
  const job = previous ? previous.then(apply) : apply();
  pending.set(target, job);
  void job.finally(() => { if (pending.get(target) === job) pending.delete(target); });
  return job;
}
