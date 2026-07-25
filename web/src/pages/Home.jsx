import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { getSocket } from "../lib/socket";
import StreamCard from "../components/StreamCard";

export default function Home() {
  const [channels, setChannels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    api
      .listChannels()
      .then(({ channels: list }) => {
        if (!cancelled) setChannels(list);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const socket = getSocket();

    function setLive(username, isLive, liveStartedAt) {
      setChannels((prev) =>
        prev.map((c) => (c.username === username ? { ...c, isLive, liveStartedAt: liveStartedAt ?? c.liveStartedAt } : c))
      );
    }
    function onOnline({ username, liveStartedAt }) {
      setLive(username, true, liveStartedAt);
    }
    function onOffline({ username }) {
      setLive(username, false, null);
    }

    socket.on("channel:online", onOnline);
    socket.on("channel:offline", onOffline);
    return () => {
      socket.off("channel:online", onOnline);
      socket.off("channel:offline", onOffline);
    };
  }, []);

  const liveChannels = channels.filter((c) => c.isLive);
  const offlineChannels = channels.filter((c) => !c.isLive);

  return (
    <div className="home">
      <section className="hero">
        <h1>Willkommen bei LIVE-URLAUB</h1>
        <p>Streame live per RTMP von deiner Kamera und chatte in Echtzeit mit deinen Zuschauern.</p>
      </section>

      {loading && <p className="page-status">Lade Kanaele...</p>}
      {error && <p className="error-text">{error}</p>}

      {!loading && !error && (
        <>
          <h2 className="section-title">
            <span className="live-dot" aria-hidden="true" /> Live jetzt ({liveChannels.length})
          </h2>
          {liveChannels.length === 0 ? (
            <p className="empty-hint">Gerade ist niemand live. Schau spaeter wieder vorbei!</p>
          ) : (
            <div className="stream-grid">
              {liveChannels.map((c) => (
                <StreamCard key={c.username} channel={c} />
              ))}
            </div>
          )}

          <h2 className="section-title">Offline ({offlineChannels.length})</h2>
          {offlineChannels.length === 0 ? (
            <p className="empty-hint">Keine weiteren Kanaele.</p>
          ) : (
            <div className="stream-grid">
              {offlineChannels.map((c) => (
                <StreamCard key={c.username} channel={c} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
