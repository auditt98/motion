import { BrowserRouter, Routes, Route } from "react-router";
import { useAuth } from "./hooks/useAuth";
import { useTheme } from "./hooks/useTheme";
import { AuthPage } from "./components/auth/AuthPage";
import { AppLayout } from "./components/layout/AppLayout";
import { AcceptInvitePage } from "./components/workspace/AcceptInvitePage";
import { PublicPageViewer } from "./components/editor/PublicPageViewer";

export function App() {
  const { user, loading, signIn, signUp, signOut } = useAuth();
  const themeState = useTheme();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-theme-secondary text-sm">Loading...</div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/invite/:token/:pageId?" element={<AcceptInvitePage />} />
        <Route path="/p/:slug" element={<PublicPageViewer />} />
        {user ? (
          <Route
            path="/*"
            element={<AppLayout user={user} onSignOut={signOut} themeState={themeState} />}
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
