import { useState, useEffect, useCallback, useRef } from 'react';
import { setSoundOutputDevice, playTestSound } from '../utils/soundEffects';

export interface AudioDevice {
  deviceId: string;
  label: string;
  groupId: string;
}

const STORAGE_KEY_INPUT = 'voice_chat_audio_input';
const STORAGE_KEY_OUTPUT = 'voice_chat_audio_output';

export function useAudioDevices() {
  const [audioInputs, setAudioInputs] = useState<AudioDevice[]>([]);
  const [audioOutputs, setAudioOutputs] = useState<AudioDevice[]>([]);
  const [selectedInput, setSelectedInputState] = useState<string>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY_INPUT) || '';
    } catch {
      return '';
    }
  });
  const [selectedOutput, setSelectedOutputState] = useState<string>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY_OUTPUT) || '';
    } catch {
      return '';
    }
  });
  const [hasPermission, setHasPermission] = useState<boolean>(false);
  const [isTestingMic, setIsTestingMic] = useState<boolean>(false);
  const [micVolume, setMicVolume] = useState<number>(0);

  const testStreamRef = useRef<MediaStream | null>(null);
  const testAudioCtxRef = useRef<AudioContext | null>(null);
  const testAnimFrameRef = useRef<number | null>(null);

  const isSinkSupported =
    typeof window !== 'undefined' &&
    typeof HTMLMediaElement !== 'undefined' &&
    'setSinkId' in HTMLMediaElement.prototype;

  const enumerate = useCallback(async () => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.enumerateDevices) {
      return;
    }

    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const inputs: AudioDevice[] = [];
      const outputs: AudioDevice[] = [];

      let hasLabels = false;

      devices.forEach((device) => {
        if (device.kind === 'audioinput') {
          if (device.label) hasLabels = true;
          inputs.push({
            deviceId: device.deviceId,
            label: device.label || `Микрофон ${inputs.length + 1}`,
            groupId: device.groupId,
          });
        } else if (device.kind === 'audiooutput') {
          if (device.label) hasLabels = true;
          outputs.push({
            deviceId: device.deviceId,
            label: device.label || `Динамики ${outputs.length + 1}`,
            groupId: device.groupId,
          });
        }
      });

      setAudioInputs(inputs);
      setAudioOutputs(outputs);
      setHasPermission(hasLabels);

      // If stored deviceId is no longer valid, fallback to default / first
      setSelectedInputState((prev) => {
        if (prev && inputs.some((d) => d.deviceId === prev)) return prev;
        return inputs[0]?.deviceId || '';
      });

      setSelectedOutputState((prev) => {
        if (prev && outputs.some((d) => d.deviceId === prev)) return prev;
        return outputs[0]?.deviceId || '';
      });
    } catch (err) {
      console.warn('[AudioDevices] Error enumerating devices:', err);
    }
  }, []);

  // Request mic permission to get real device names and enumerate
  const requestPermission = useCallback(async () => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Stop temporary stream immediately
      stream.getTracks().forEach((track) => track.stop());
      setHasPermission(true);
      await enumerate();
    } catch (err) {
      console.warn('[AudioDevices] User denied microphone access:', err);
    }
  }, [enumerate]);

  // Set selected microphone
  const setSelectedInput = useCallback((deviceId: string) => {
    setSelectedInputState(deviceId);
    try {
      localStorage.setItem(STORAGE_KEY_INPUT, deviceId);
    } catch {}
  }, []);

  // Set selected speaker/headphones
  const setSelectedOutput = useCallback((deviceId: string) => {
    setSelectedOutputState(deviceId);
    try {
      localStorage.setItem(STORAGE_KEY_OUTPUT, deviceId);
    } catch {}
    setSoundOutputDevice(deviceId);
  }, []);

  // Start / stop microphone test meter
  const stopMicTest = useCallback(() => {
    if (testAnimFrameRef.current) {
      cancelAnimationFrame(testAnimFrameRef.current);
      testAnimFrameRef.current = null;
    }
    if (testStreamRef.current) {
      testStreamRef.current.getTracks().forEach((t) => t.stop());
      testStreamRef.current = null;
    }
    if (testAudioCtxRef.current) {
      testAudioCtxRef.current.close().catch(() => {});
      testAudioCtxRef.current = null;
    }
    setIsTestingMic(false);
    setMicVolume(0);
  }, []);

  const startMicTest = useCallback(async () => {
    stopMicTest();
    try {
      let stream: MediaStream;
      try {
        const constraints: MediaStreamConstraints = {
          audio: selectedInput ? { deviceId: { exact: selectedInput } } : true,
        };
        stream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch (err) {
        console.warn('[AudioDevices] Failed with selectedInput, falling back to default mic:', err);
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      }
      testStreamRef.current = stream;

      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioCtx();
      testAudioCtxRef.current = ctx;

      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      setIsTestingMic(true);

      let lastUpdate = 0;
      const checkVolume = (now: number) => {
        analyser.getByteFrequencyData(dataArray);
        if (now - lastUpdate >= 45) {
          lastUpdate = now;
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i];
          }
          const avg = sum / dataArray.length;
          // Normalize 0 to 100
          const level = Math.min(100, Math.round((avg / 128) * 100));
          setMicVolume(level);
        }
        testAnimFrameRef.current = requestAnimationFrame(checkVolume);
      };
      testAnimFrameRef.current = requestAnimationFrame(checkVolume);
    } catch (err) {
      console.warn('[AudioDevices] Failed to start mic test:', err);
      stopMicTest();
    }
  }, [selectedInput, stopMicTest]);

  const toggleMicTest = useCallback(() => {
    if (isTestingMic) {
      stopMicTest();
    } else {
      startMicTest();
    }
  }, [isTestingMic, startMicTest, stopMicTest]);

  // Initial enumeration and listen for plug/unplug
  useEffect(() => {
    enumerate();

    if (typeof navigator !== 'undefined' && navigator.mediaDevices) {
      navigator.mediaDevices.addEventListener('devicechange', enumerate);
      return () => {
        navigator.mediaDevices.removeEventListener('devicechange', enumerate);
        stopMicTest();
      };
    }
    return () => {
      stopMicTest();
    };
  }, [enumerate, stopMicTest]);

  // Sync initial sound output
  useEffect(() => {
    if (selectedOutput) {
      setSoundOutputDevice(selectedOutput);
    }
  }, [selectedOutput]);

  return {
    audioInputs,
    audioOutputs,
    selectedInput,
    selectedOutput,
    hasPermission,
    isSinkSupported,
    isTestingMic,
    micVolume,
    setSelectedInput,
    setSelectedOutput,
    requestPermission,
    toggleMicTest,
    playTestSound,
    refreshDevices: enumerate,
  };
}
