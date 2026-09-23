import React, { memo } from 'react';

export const JellyBackground: React.FC = memo(() => {
  // If global jelly background is already in index.html, avoid rendering duplicate DOM blobs
  if (typeof document !== 'undefined' && document.getElementById('jelly-bg')) {
    return null;
  }

  return (
    <div className="jelly-background jelly-dispersed" aria-hidden="true">
      <div className="jelly-blob jelly-blob-1" />
      <div className="jelly-blob jelly-blob-2" />
      <div className="jelly-blob jelly-blob-3" />
      <div className="jelly-blob jelly-blob-4" />
      <div className="jelly-blob jelly-blob-5" />
      <div className="jelly-blob jelly-blob-6" />
      <div className="jelly-blob jelly-blob-7" />
    </div>
  );
});

JellyBackground.displayName = 'JellyBackground';
