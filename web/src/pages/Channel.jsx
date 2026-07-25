import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "../lib/api";
import { getSocket } from "../lib/socket";
import { MEDIA_URL } from "../lib/config";
import VideoPlayer from "../components/VideoPlayer";
import ChatBox from "../components/ChatBox";

export default function Channel() {
  const { username } = useParams();
  const [channel, setChannel] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    setChannel(null);
    api
      .getChannel(username)
      .then(({ channel: c }) => {
        if (!cancelled) setChannel(c);
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
  }, [username]);

  useEffect(() => {
    const socket = getSocket();
    function onOnline(data) {
      if (data.username !== username) return;
      setChannel((prev) => (prev ? { ...prev, isLive: true, liveStartedAt: data.liveStartedAt } : prev));
    }
    function onOffline(data) {
      if (data.username !== username) return;
      setChannel((prev) => (prev ? { ...prev, isLive: false } : prev));
    }
    socket.on("channel:online", onOnline);
    socket.on("channel:offline", onOffline);
    return () => {
      socket.off("channel:online", onOnline);
      socket.off("channel:offline", onOffline);
    };
  }, [username]);

  if (loading) return <div className="page-status">Lade Kanal...</div>;
  if (error || !channel) {
    return (
      <div className="page-status">
        <p className="error-text">{error || "Kanal nicht gefunden."}</p>
        <Link to="/">Zurueck zur Startseite</Link>
      </div>
    );
  }

  const hlsUrl = `${MEDIA_URL}${channel.hlsPath}`;

  return (
    <div className="channel-page">
      <div className="channel-main">
        <div className="video-wrapper">
          {channel.isLive ? (
            <VideoPlayer key={hlsUrl} src={hlsUrl} />
          ) : (
            <div className="offline-placeholder">
              <span className="badge badge-offline">Offline</span>
              <p>@{channel.username} streamt gerade nicht.</p>
            </div>
          )}
        </div>
        <div className="channel-meta">
          <h1>{channel.title || `${channel.username}s Kanal`}</h1>
          <p className="channel-owner">@{channel.username}</p>
        </div>
      </div>
      <aside className="channel-sidebar">
        <ChatBox channel={channel.username} />
      </aside>
    </div>
  );
}
