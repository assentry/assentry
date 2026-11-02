import { useEffect, useState } from "react";
import { AuthPage } from "./pages/AuthPage";
import { Dashboard } from "./pages/Dashboard";
import { LandingPage } from "./pages/LandingPage";
import { api, clearToken, getToken } from "./lib/api";
import type { User } from "./lib/types";

type View = "landing" | "auth";

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [view, setView] = useState<View>("landing");
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");

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

  if (!user) {
    if (view === "landing") {
      return (
        <LandingPage
          onGetStarted={() => {
            setAuthMode("signup");
            setView("auth");
          }}
          onLogIn={() => {
            setAuthMode("login");
            setView("auth");
          }}
        />
      );
    }
    return <AuthPage onAuthenticated={setUser} initialMode={authMode} onBack={() => setView("landing")} />;
  }

  return <Dashboard user={user} onSignOut={() => setUser(null)} />;
}
