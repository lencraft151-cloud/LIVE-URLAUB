import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate("/");
  }

  return (
    <header className="navbar">
      <Link to="/" className="brand">
        <span className="brand-dot" aria-hidden="true" />
        LIVE-URLAUB
      </Link>
      <nav className="nav-links">
        {user ? (
          <>
            <Link to="/dashboard">Dashboard</Link>
            <Link to={`/channel/${user.username}`} className="nav-username">
              @{user.username}
            </Link>
            <button type="button" className="btn btn-ghost" onClick={handleLogout}>
              Abmelden
            </button>
          </>
        ) : (
          <>
            <Link to="/login">Anmelden</Link>
            <Link to="/register" className="btn btn-primary">
              Registrieren
            </Link>
          </>
        )}
      </nav>
    </header>
  );
}
