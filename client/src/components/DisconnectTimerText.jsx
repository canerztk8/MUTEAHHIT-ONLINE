import React, { useState, useEffect } from 'react';

/**
 * Kopma suresini (60sn tolerans) istemci tarafinda saniyede bir yerel olarak sayan bilesen.
 * Sunucunun saniyede bir 15 KB GameState yayini yapmasini engeller.
 */
export function DisconnectTimerText({ expiresAt, fallbackSeconds = 60 }) {
  const [seconds, setSeconds] = useState(() => {
    if (expiresAt) return Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000));
    return fallbackSeconds;
  });

  useEffect(() => {
    if (!expiresAt) return;
    const tick = () => {
      setSeconds(Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000)));
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  return <>{seconds}sn</>;
}

export default DisconnectTimerText;
