import { BrowserRouter, Routes, Route } from "react-router";
import { useAuth } from "./hooks/useAuth";
import { AuthPage } from "./components/auth/AuthPage";
import { AppLayout } from "./components/layout/AppLayout";
import { AcceptInvitePage } from "./components/workspace/AcceptInvitePage";

export function App() {
  const { user, loading, signIn, signUp, signOut } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-400 text-sm">Loading...</div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/invite/:token/:pageId?" element={<AcceptInvitePage />} />
        {user ? (
          <Route
            path="/*"
            element={<AppLayout user={user} onSignOut={signOut} />}
          />
        ) : (
          <Route
            path="/*"
            element={<AuthPage onSignIn={signIn} onSignUp={signUp} />}
          />
        )}
      </Routes>
    </BrowserRouter>
  );
}
