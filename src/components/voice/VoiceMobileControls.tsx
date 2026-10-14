import React, { memo } from 'react';
import { VoiceControlBar, VoiceControlBarProps } from './VoiceControlBar';

export type VoiceMobileControlsProps = VoiceControlBarProps;

export const VoiceMobileControls: React.FC<VoiceMobileControlsProps> = memo((props) => {
  return (
    <div
      style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 0.625rem)' }}
      className="lg:hidden p-2.5 sm:p-3 bg-slate-950/60 backdrop-blur-xl border-t border-white/10 flex items-center justify-center shrink-0 z-20"
    >
      <VoiceControlBar
        {...props}
        className="flex items-center justify-center gap-2.5 sm:gap-3"
      />
    </div>
  );
});

VoiceMobileControls.displayName = 'VoiceMobileControls';
