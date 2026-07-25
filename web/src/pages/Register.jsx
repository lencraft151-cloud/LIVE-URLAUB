import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await register(username.trim().toLowerCase(), email.trim(), password);
      navigate("/dashboard");
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-page">
      <form className="auth-form" onSubmit={handleSubmit}>
        <h1>Konto erstellen</h1>
        {error && <p className="error-text">{error}</p>}
        <label>
          Benutzername
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            minLength={3}
            maxLength={20}
            pattern="[a-z0-9_\-]+"
            title="3-20 Zeichen: Kleinbuchstaben, Zahlen, - und _"
            autoFocus
          />
        </label>
        <label>
          E-Mail
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label>
          Passwort
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
          />
        </label>
        <button className="btn btn-primary" type="submit" disabled={submitting}>
          {submitting ? "Bitte warten..." : "Registrieren"}
        </button>
        <p className="auth-switch">
          Schon ein Konto? <Link to="/login">Anmelden</Link>
        </p>
      </form>
    </div>
  );
}
