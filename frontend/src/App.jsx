import { useEffect, useState } from "react";
import Dashboard from "./Dashboard.jsx";
import LoginPage from "./components/LoginPage.jsx";
import { clearSession, getMe, getStoredSession } from "./services/api.js";

export default function App() {
  const [user, setUser] = useState(() => getStoredSession()?.user);
  const [checkingSession, setCheckingSession] = useState(Boolean(getStoredSession()));

  useEffect(() => {
    if (!getStoredSession()) {
      setCheckingSession(false);
      return;
    }

    getMe()
      .then(setUser)
      .catch(() => {
        clearSession();
        setUser(null);
      })
      .finally(() => setCheckingSession(false));
  }, []);

  const handleLogout = () => {
    clearSession();
    setUser(null);
  };

  if (checkingSession) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center text-sm font-semibold text-slate-500">
        Memeriksa sesi...
      </div>
    );
  }

  if (!user) return <LoginPage onLogin={setUser} />;

  return (
    <Dashboard
      user={user}
      onLogout={handleLogout}
      onSessionExpired={handleLogout}
    />
  );
}
