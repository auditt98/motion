import { useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";

interface AcceptResult {
  workspace_id?: string;
  already_member?: boolean;
  error?: string;
}

export function useAcceptInvite() {
  const [accepting, setAccepting] = useState(false);
  const [result, setResult] = useState<AcceptResult | null>(null);

  const acceptEmailInvite = useCallback(async (token: string) => {
    setAccepting(true);
    setResult(null);

    const { data, error } = await supabase.rpc("accept_email_invitation", {
      invite_token: token,
    });

    setAccepting(false);

    if (error) {
      const res = { error: error.message };
      setResult(res);
      return res;
    }

    setResult(data as AcceptResult);
    return data as AcceptResult;
  }, []);

  const acceptLinkInvite = useCallback(async (token: string) => {
    setAccepting(true);
    setResult(null);

    const { data, error } = await supabase.rpc("accept_invite_link", {
      link_token: token,
    });

    setAccepting(false);

    if (error) {
      const res = { error: error.message };
      setResult(res);
      return res;
    }

    setResult(data as AcceptResult);
    return data as AcceptResult;
  }, []);

  return { accepting, result, acceptEmailInvite, acceptLinkInvite };
}
