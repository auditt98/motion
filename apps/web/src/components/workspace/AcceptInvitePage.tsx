import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router";
import { useAuth } from "@/hooks/useAuth";
import { useAcceptInvite } from "@/hooks/useAcceptInvite";
import { AuthPage } from "../auth/AuthPage";

export function AcceptInvitePage() {
  const { token, pageId } = useParams<{ token: string; pageId?: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading, signIn, signUp } = useAuth();
  const { accepting, result, acceptEmailInvite, acceptLinkInvite } =
    useAcceptInvite();
  const [tried, setTried] = useState(false);

  // Once authenticated, try to accept the invitation
  useEffect(() => {
    if (!user || !token || tried) return;
    setTried(true);

    // Store the token so we can retry if auth just completed
    async function tryAccept() {
      // Try email invitation first, then fall back to link invitation
      let res = await acceptEmailInvite(token!);

      if (res?.error && res.error.includes("not found")) {
        res = await acceptLinkInvite(token!);
      }

      if (res && !res.error && "workspace_id" in res && res.workspace_id) {
        // Redirect to workspace after short delay for UX
        setTimeout(() => navigate(pageId ? `/page/${pageId}` : "/"), 500);
      }
    }

    tryAccept();
  }, [user, token, tried, acceptEmailInvite, acceptLinkInvite, navigate]);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-400 text-sm">Loading...</div>
      </div>
    );
  }

  // Not authenticated — show auth form with context message
  if (!user) {
    return (
      <div>
        <div className="fixed top-0 left-0 right-0 bg-blue-50 border-b border-blue-100 px-4 py-2.5 text-center z-50">
          <p className="text-sm text-blue-700">
            Sign in or create an account to accept this invitation.
          </p>
        </div>
        <div className="pt-10">
          <AuthPage onSignIn={signIn} onSignUp={signUp} />
        </div>
      </div>
    );
  }

  // Accepting in progress
  if (accepting) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-2 border-gray-900 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-sm text-gray-600">Accepting invitation...</p>
        </div>
      </div>
    );
  }

  // Show result
  if (result) {
    if (result.error) {
      return (
        <div className="min-h-screen flex items-center justify-center">
          <div className="max-w-sm w-full bg-white p-8 rounded-xl shadow-sm border text-center">
            <div className="text-4xl mb-4">:(</div>
            <h2 className="text-lg font-semibold mb-2">
              Couldn't accept invitation
            </h2>
            <p className="text-sm text-gray-500 mb-4">{result.error}</p>
            <button
              onClick={() => navigate("/")}
              className="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm hover:bg-gray-800"
            >
              Go to workspace
            </button>
          </div>
        </div>
      );
    }

    if (result.already_member) {
      return (
        <div className="min-h-screen flex items-center justify-center">
          <div className="max-w-sm w-full bg-white p-8 rounded-xl shadow-sm border text-center">
            <h2 className="text-lg font-semibold mb-2">
              You're already a member!
            </h2>
            <p className="text-sm text-gray-500 mb-4">
              Redirecting to your workspace...
            </p>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="max-w-sm w-full bg-white p-8 rounded-xl shadow-sm border text-center">
          <h2 className="text-lg font-semibold mb-2">
            You've joined the workspace!
          </h2>
          <p className="text-sm text-gray-500 mb-4">
            Redirecting...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-gray-400 text-sm">Processing invitation...</div>
    </div>
  );
}
