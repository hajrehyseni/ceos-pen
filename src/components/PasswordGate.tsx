import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Lock } from "lucide-react";

interface PasswordGateProps {
  onAuthenticated: () => void;
}

export function PasswordGate({ onAuthenticated }: PasswordGateProps) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const { data, error: fnError } = await supabase.functions.invoke("verify-password", {
        body: { password },
      });
      if (fnError) throw fnError;
      if (!data?.valid || !data?.session) {
        setError("Incorrect password");
        setLoading(false);
        return;
      }
      const { error: setErr } = await supabase.auth.setSession({
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
      });
      if (setErr) throw setErr;
      onAuthenticated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm bg-card border border-border rounded-xl p-8 shadow-lg space-y-6"
      >
        <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-primary/10 mx-auto">
          <Lock className="w-6 h-6 text-primary" />
        </div>
        <div className="text-center">
          <h1 className="text-xl font-semibold">Dashboard access</h1>
          <p className="text-sm text-muted-foreground mt-1">Enter the password to continue.</p>
        </div>
        <Input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoFocus
          required
        />
        {error && <p className="text-sm text-destructive text-center">{error}</p>}
        <Button type="submit" className="w-full" disabled={loading || !password}>
          {loading ? "Verifying..." : "Unlock"}
        </Button>
      </form>
    </div>
  );
}
