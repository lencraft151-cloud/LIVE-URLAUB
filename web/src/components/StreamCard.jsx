import { Link } from "react-router-dom";

export default function StreamCard({ channel }) {
  return (
    <Link to={`/channel/${channel.username}`} className="stream-card">
      <div className={`stream-thumb${channel.isLive ? " is-live" : ""}`}>
        {channel.isLive ? (
          <span className="badge badge-live">LIVE</span>
        ) : (
          <span className="badge badge-offline">Offline</span>
        )}
      </div>
      <div className="stream-info">
        <div className="stream-title">{channel.title || `${channel.username}s Kanal`}</div>
        <div className="stream-username">@{channel.username}</div>
      </div>
    </Link>
  );
}
