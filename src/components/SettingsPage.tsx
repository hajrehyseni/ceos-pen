import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { ArrowLeft, Save, Linkedin, Zap } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface SettingsPageProps {
  onBack: () => void;
}

export function SettingsPage({ onBack }: SettingsPageProps) {
  const { toast } = useToast();
  const [linkedinToken, setLinkedinToken] = useState("");
  const [autoPublish, setAutoPublish] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    const { data } = await supabase.from("settings").select("*");
    if (data) {
      for (const s of data) {
        if (s.key === "linkedin_access_token") setLinkedinToken(s.value || "");
        if (s.key === "auto_publish_enabled") setAutoPublish(s.value === "true");
      }
    }
    setLoading(false);
  };

  const saveSetting = async (key: string, value: string) => {
    setSaving(true);
    await supabase
      .from("settings")
      .update({ value, updated_at: new Date().toISOString() })
      .eq("key", key);
    setSaving(false);
    toast({ title: "Setting saved" });
  };

  const handleSaveToken = () => saveSetting("linkedin_access_token", linkedinToken);

  const handleToggleAutoPublish = async (checked: boolean) => {
    setAutoPublish(checked);
    await saveSetting("auto_publish_enabled", checked ? "true" : "false");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="w-4 h-4 mr-1" /> Back
        </Button>
        <h1 className="text-xl font-bold text-foreground">Settings</h1>
      </div>

      {/* LinkedIn Integration */}
      <div className="card-surface p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Linkedin className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">Connect LinkedIn</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Paste your LinkedIn access token to enable direct publishing. You can get one from the
          LinkedIn Developer Portal under your app's OAuth settings.
        </p>
        <div className="flex gap-2">
          <Input
            type="password"
            placeholder="LinkedIn access token"
            value={linkedinToken}
            onChange={(e) => setLinkedinToken(e.target.value)}
            className="bg-secondary border-border flex-1"
          />
          <Button onClick={handleSaveToken} disabled={saving}>
            <Save className="w-4 h-4 mr-1" /> Save
          </Button>
        </div>
        {linkedinToken && (
          <p className="text-xs text-success">✓ Token configured</p>
        )}
      </div>

      {/* Auto-publish */}
      <div className="card-surface p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Zap className="w-5 h-5 text-warning" />
          <h2 className="text-lg font-semibold text-foreground">Auto-Publish</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          When enabled, approved posts will automatically publish to LinkedIn at their suggested posting time.
          The system checks every 15 minutes between 08:00–12:00 UTC on weekdays.
        </p>
        <div className="flex items-center justify-between">
          <span className="text-sm text-foreground font-medium">
            Auto-publish approved posts at suggested time
          </span>
          <Switch checked={autoPublish} onCheckedChange={handleToggleAutoPublish} />
        </div>
      </div>

      {/* Schedule info */}
      <div className="card-surface p-6 space-y-3">
        <h2 className="text-lg font-semibold text-foreground">Cron Schedules</h2>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Collect News</span>
            <span className="text-foreground font-medium">07:00 UTC Mon–Fri</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Generate Draft</span>
            <span className="text-foreground font-medium">07:30 UTC Mon–Fri</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Auto-Publish Check</span>
            <span className="text-foreground font-medium">Every 15min, 08:00–12:00 UTC Mon–Fri</span>
          </div>
        </div>
      </div>
    </div>
  );
}
