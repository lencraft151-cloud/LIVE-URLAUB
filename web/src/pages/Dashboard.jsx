import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";
import { getSocket } from "../lib/socket";

export default function Dashboard() {
  const { user, updateUser } = useAuth();
  const [showKey, setShowKey] = useState(false);
  const [title, setTitle] = useState(user?.title || "");
  const [savingTitle, setSavingTitle] = useState(false);
  const [titleSaved, setTitleSaved] = useState(false);
  const [titleError, setTitleError] = useState("");
  const [regenerating, setRegenerating] = useState(false);
  const [regenError, setRegenError] = useState("");
  const [confirmingRegen, setConfirmingRegen] = useState(false);
  const [isLive, setIsLive] = useState(user?.isLive || false);
  const [copyState, setCopyState] = useState({ field: null, ok: false });

  useEffect(() => {
    setTitle(user?.title || "");
    setIsLive(user?.isLive || false);
  }, [user?.title, user?.isLive]);

  useEffect(() => {
    const socket = getSocket();
    function onOnline(data) {
      if (data.username === user?.username) setIsLive(true);
    }
    function onOffline(data) {
      if (data.username === user?.username) setIsLive(false);
    }
    socket.on("channel:online", onOnline);
    socket.on("channel:offline", onOffline);
    return () => {
      socket.off("channel:online", onOnline);
      socket.off("channel:offline", onOffline);
    };
  }, [user?.username]);

  if (!user) return null;

  async function handleTitleSubmit(e) {
    e.preventDefault();
    setSavingTitle(true);
    setTitleError("");
    try {
      const { channel } = await api.updateTitle(title.trim());
      updateUser({ title: channel.title });
      setTitleSaved(true);
      setTimeout(() => setTitleSaved(false), 2000);
    } catch (err) {
      setTitleError(err.message);
    } finally {
      setSavingTitle(false);
    }
  }

  async function handleRegenerate() {
    setRegenerating(true);
    setRegenError("");
    try {
      const { user: updated } = await api.regenerateStreamKey();
      updateUser({ streamKey: updated.streamKey, rtmpStreamKey: updated.rtmpStreamKey });
      setShowKey(true);
      setConfirmingRegen(false);
    } catch (err) {
      setRegenError(err.message);
    } finally {
      setRegenerating(false);
    }
  }

  async function copy(field, value) {
    try {
      await navigator.clipboard.writeText(value);
      setCopyState({ field, ok: true });
    } catch {
      setCopyState({ field, ok: false });
    } finally {
      setTimeout(() => setCopyState({ field: null, ok: false }), 1500);
    }
  }

  return (
    <div className="dashboard">
      <h1>Dashboard</h1>

      <section className="dashboard-card">
        <h2>
          Status: {isLive ? <span className="badge badge-live">LIVE</span> : <span className="badge badge-offline">Offline</span>}
        </h2>
        <p>
          Dein Kanal: <Link to={`/channel/${user.username}`}>/channel/{user.username}</Link>
        </p>
      </section>

      <section className="dashboard-card">
        <h2>Stream-Titel</h2>
        <form className="title-form" onSubmit={handleTitleSubmit}>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={100}
            placeholder="z.B. Sonnenuntergang am Strand"
          />
          <button className="btn btn-primary" type="submit" disabled={savingTitle}>
            {savingTitle ? "Speichern..." : "Speichern"}
          </button>
          {titleSaved && <span className="save-hint">Gespeichert</span>}
        </form>
        {titleError && <p className="error-text">{titleError}</p>}
      </section>

      <section className="dashboard-card">
        <h2>Mit OBS oder deiner Kamera-App live gehen</h2>

        <div className="field-row">
          <label htmlFor="rtmp-url">Server-URL (RTMP)</label>
          <div className="copy-field">
            <code id="rtmp-url">{user.rtmpUrl}</code>
            <button type="button" className="btn btn-ghost" onClick={() => copy("url", user.rtmpUrl)}>
              {copyState.field === "url" && copyState.ok ? "Kopiert!" : "Kopieren"}
            </button>
          </div>
        </div>

        <div className="field-row">
          <label htmlFor="stream-key">Stream-Key</label>
          <div className="copy-field">
            <code id="stream-key">{showKey ? user.rtmpStreamKey : "•".repeat(28)}</code>
            <button type="button" className="btn btn-ghost" onClick={() => setShowKey((v) => !v)}>
              {showKey ? "Verbergen" : "Anzeigen"}
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => copy("key", user.rtmpStreamKey)}>
              {copyState.field === "key" && copyState.ok ? "Kopiert!" : "Kopieren"}
            </button>
          </div>
          <p className="field-hint">
            Behandle deinen Stream-Key wie ein Passwort. Wer ihn kennt, kann in deinem Namen streamen.
          </p>
        </div>

        {!confirmingRegen ? (
          <button type="button" className="btn btn-danger-ghost" onClick={() => setConfirmingRegen(true)}>
            Stream-Key neu generieren
          </button>
        ) : (
          <div className="confirm-box">
            <p>Der alte Stream-Key funktioniert danach nicht mehr. Ein laufender Stream wird getrennt.</p>
            <div className="confirm-actions">
              <button type="button" className="btn btn-danger" onClick={handleRegenerate} disabled={regenerating}>
                {regenerating ? "Wird generiert..." : "Ja, neu generieren"}
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => setConfirmingRegen(false)}>
                Abbrechen
              </button>
            </div>
          </div>
        )}
        {regenError && <p className="error-text">{regenError}</p>}

        <ol className="obs-steps">
          <li>Oeffne OBS Studio (oder eine RTMP-App wie Larix Broadcaster auf dem Handy).</li>
          <li>Gehe zu Einstellungen &rarr; Stream.</li>
          <li>Waehle als Dienst &quot;Benutzerdefiniert&quot;.</li>
          <li>Trage die Server-URL und den Stream-Key von oben ein.</li>
          <li>Klicke auf &quot;Stream starten&quot; - dein Kanal geht automatisch live.</li>
        </ol>
      </section>
    </div>
  );
}
