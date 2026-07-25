import { useEffect, useRef, useState } from "react";
import Hls from "hls.js";

const MAX_RETRIES = 4;

export default function VideoPlayer({ src }) {
  const videoRef = useRef(null);
  const [fatalError, setFatalError] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return undefined;

    setFatalError(false);
    let hls;
    let retries = 0;

    if (Hls.isSupported()) {
      hls = new Hls({ liveSyncDurationCount: 3, enableWorker: true });
      hls.loadSource(src);
      hls.attachMedia(video);
      hls.on(Hls.Events.FRAG_LOADED, () => {
        retries = 0;
      });
      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (!data.fatal) return;

        if (retries >= MAX_RETRIES) {
          console.error("[VideoPlayer] Wiedergabe nach mehreren Versuchen fehlgeschlagen:", data.type, data.details);
          hls.destroy();
          setFatalError(true);
          return;
        }
        retries += 1;

        switch (data.type) {
          case Hls.ErrorTypes.NETWORK_ERROR:
            setTimeout(() => hls.startLoad(), 1000 * retries);
            break;
          case Hls.ErrorTypes.MEDIA_ERROR:
            hls.recoverMediaError();
            break;
          default:
            hls.destroy();
            setFatalError(true);
            break;
        }
      });
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      // Safari/iOS spielt HLS nativ ab, ganz ohne hls.js.
      video.src = src;
    } else {
      setFatalError(true);
    }

    return () => {
      if (hls) hls.destroy();
    };
  }, [src]);

  if (fatalError) {
    return (
      <div className="offline-placeholder">
        <p>Wiedergabe im Moment nicht moeglich. Bitte lade die Seite neu.</p>
      </div>
    );
  }

  return <video ref={videoRef} className="video-player" controls autoPlay muted playsInline />;
}
