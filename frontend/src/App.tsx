import { useEffect, useState } from "react";
import { AuthPage } from "./pages/AuthPage";
import { Dashboard } from "./pages/Dashboard";
import { api, clearToken, getToken } from "./lib/api";
import type { User } from "./lib/types";

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      setCheckingSession(false);
      return;
    }
    api
      .get<{ user: User }>("/auth/me")
      .then((data) => setUser(data.user))
      .catch(() => clearToken())
      .finally(() => setCheckingSession(false));
  }, []);

  if (checkingSession) return null;

  if (!user) return <AuthPage onAuthenticated={setUser} />;

  return <Dashboard user={user} onSignOut={() => setUser(null)} />;
}
