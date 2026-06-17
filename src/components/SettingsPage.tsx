import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { ArrowLeft, Save, Linkedin, Zap, User, Megaphone, Trash2, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { CeoContext, CtaItem } from "@/types/database";

interface SettingsPageProps {
  onBack: () => void;
}

export function SettingsPage({ onBack }: SettingsPageProps) {
  const { toast } = useToast();
  const [linkedinToken, setLinkedinToken] = useState("");
  const [personUrn, setPersonUrn] = useState("");
  const [autoPublish, setAutoPublish] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // CEO context
  const [ceo, setCeo] = useState<CeoContext | null>(null);
  // CTA library
  const [ctas, setCtas] = useState<CtaItem[]>([]);
  const [newCtaCopy, setNewCtaCopy] = useState("");
  const [newCtaType, setNewCtaType] = useState<"soft" | "hard">("soft");

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    setLoading(true);
    const [settingsRes, ceoRes, ctaRes] = await Promise.all([
      supabase.from("settings").select("*"),
      supabase.from("ceo_context").select("*").limit(1).maybeSingle(),
      supabase.from("cta_library").select("*").order("created_at", { ascending: false }),
    ]);
    if (settingsRes.data) {
      for (const s of settingsRes.data) {
        if (s.key === "linkedin_access_token") setLinkedinToken(s.value || "");
        if (s.key === "linkedin_person_urn") setPersonUrn(s.value || "");
        if (s.key === "auto_publish_enabled") setAutoPublish(s.value === "true");
      }
    }
    if (ceoRes.data) setCeo(ceoRes.data as CeoContext);
    if (ctaRes.data) setCtas(ctaRes.data as CtaItem[]);
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
  const handleSaveUrn = () => saveSetting("linkedin_person_urn", personUrn);

  const handleToggleAutoPublish = async (checked: boolean) => {
    setAutoPublish(checked);
    await saveSetting("auto_publish_enabled", checked ? "true" : "false");
  };

  // ===== CEO context =====
  const saveCeo = async () => {
    if (!ceo) return;
    setSaving(true);
    await supabase.from("ceo_context").update({
      bio: ceo.bio,
      worldview: ceo.worldview,
      recurring_stories: ceo.recurring_stories,
      forbidden_phrases: ceo.forbidden_phrases,
      lead_magnet_url: ceo.lead_magnet_url,
      auto_first_comment: ceo.auto_first_comment,
      hard_cta_ratio: ceo.hard_cta_ratio,
      competitor_urls: ceo.competitor_urls,
      trend_keywords: ceo.trend_keywords,
      updated_at: new Date().toISOString(),
    }).eq("id", ceo.id);
    setSaving(false);
    toast({ title: "CEO context saved" });
  };

  // ===== CTA library =====
  const addCta = async () => {
    if (!newCtaCopy.trim()) return;
    const { data, error } = await supabase.from("cta_library").insert({
      copy: newCtaCopy.trim(),
      cta_type: newCtaType,
      weight: 1,
      enabled: true,
    }).select("*").single();
    if (error) {
      toast({ title: "Couldn't add CTA", description: error.message, variant: "destructive" });
      return;
    }
    setCtas([data as CtaItem, ...ctas]);
    setNewCtaCopy("");
  };

  const updateCta = async (id: string, patch: Partial<CtaItem>) => {
    setCtas(ctas.map((c) => (c.id === id ? { ...c, ...patch } : c)));
    await supabase.from("cta_library").update(patch as any).eq("id", id);
  };

  const deleteCta = async (id: string) => {
    setCtas(ctas.filter((c) => c.id !== id));
    await supabase.from("cta_library").delete().eq("id", id);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="w-4 h-4 mr-1" /> Back
        </Button>
        <h1 className="text-xl font-bold text-foreground">Settings</h1>
      </div>

      {/* CEO Context */}
      {ceo && (
        <div className="card-surface p-6 space-y-4">
          <div className="flex items-center gap-2">
            <User className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">CEO Context (Hajre)</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            This block is injected into every draft. The more specific you are, the more your posts sound like you.
          </p>

          <label className="block text-sm font-medium text-foreground">Bio (one sentence)</label>
          <Textarea
            rows={2}
            value={ceo.bio}
            onChange={(e) => setCeo({ ...ceo, bio: e.target.value })}
            className="bg-secondary border-border"
          />

          <label className="block text-sm font-medium text-foreground">Worldview / point of view</label>
          <Textarea
            rows={4}
            value={ceo.worldview}
            onChange={(e) => setCeo({ ...ceo, worldview: e.target.value })}
            className="bg-secondary border-border"
          />

          <label className="block text-sm font-medium text-foreground">
            Recurring stories you can draw from
          </label>
          <Textarea
            rows={4}
            value={ceo.recurring_stories}
            onChange={(e) => setCeo({ ...ceo, recurring_stories: e.target.value })}
            className="bg-secondary border-border"
          />

          <label className="block text-sm font-medium text-foreground">
            Forbidden phrases (semicolon-separated, instant rejection)
          </label>
          <Textarea
            rows={3}
            value={ceo.forbidden_phrases}
            onChange={(e) => setCeo({ ...ceo, forbidden_phrases: e.target.value })}
            className="bg-secondary border-border font-mono text-xs"
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-foreground">Lead-magnet URL</label>
              <Input
                value={ceo.lead_magnet_url}
                onChange={(e) => setCeo({ ...ceo, lead_magnet_url: e.target.value })}
                className="bg-secondary border-border"
              />
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-medium text-foreground">
                Hard CTA ratio ({Math.round(ceo.hard_cta_ratio * 100)}% in-body, rest first-comment)
              </label>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={ceo.hard_cta_ratio}
                onChange={(e) =>
                  setCeo({ ...ceo, hard_cta_ratio: parseFloat(e.target.value) })
                }
                className="w-full"
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-border">
            <span className="text-sm text-foreground font-medium">
              Auto-post lead-magnet link as the first comment
            </span>
            <Switch
              checked={ceo.auto_first_comment}
              onCheckedChange={(v) => setCeo({ ...ceo, auto_first_comment: v })}
            />
          </div>

          <Button onClick={saveCeo} disabled={saving} className="w-full">
            <Save className="w-4 h-4 mr-1" /> Save CEO context
          </Button>
        </div>
      )}

      {/* CTA Library */}
      <div className="card-surface p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Megaphone className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">Lead-magnet CTA library</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          <strong>Soft</strong> CTAs go in the first comment under the post.{" "}
          <strong>Hard</strong> CTAs get woven into the post body. Weighted random selection per draft.
        </p>

        <div className="flex gap-2">
          <Input
            placeholder="New CTA copy…"
            value={newCtaCopy}
            onChange={(e) => setNewCtaCopy(e.target.value)}
            className="bg-secondary border-border flex-1"
          />
          <select
            value={newCtaType}
            onChange={(e) => setNewCtaType(e.target.value as "soft" | "hard")}
            className="bg-secondary border border-border rounded-md px-2 text-sm"
          >
            <option value="soft">Soft (comment)</option>
            <option value="hard">Hard (in body)</option>
          </select>
          <Button onClick={addCta} disabled={!newCtaCopy.trim()}>
            <Plus className="w-4 h-4" />
          </Button>
        </div>

        <div className="space-y-2">
          {ctas.length === 0 && (
            <p className="text-sm text-muted-foreground italic">No CTAs yet. Add one above.</p>
          )}
          {ctas.map((c) => (
            <div
              key={c.id}
              className="flex items-start gap-2 p-3 rounded-md bg-secondary/40 border border-border"
            >
              <Textarea
                rows={2}
                value={c.copy}
                onChange={(e) => updateCta(c.id, { copy: e.target.value })}
                className="bg-background border-border flex-1 text-sm"
              />
              <div className="flex flex-col gap-2 items-end min-w-[120px]">
                <select
                  value={c.cta_type}
                  onChange={(e) =>
                    updateCta(c.id, { cta_type: e.target.value as "soft" | "hard" })
                  }
                  className="bg-background border border-border rounded-md px-2 py-1 text-xs"
                >
                  <option value="soft">Soft</option>
                  <option value="hard">Hard</option>
                </select>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>Used {c.times_used}×</span>
                  <Switch
                    checked={c.enabled}
                    onCheckedChange={(v) => updateCta(c.id, { enabled: v })}
                  />
                </div>
                <button
                  onClick={() => deleteCta(c.id)}
                  className="text-destructive hover:opacity-80"
                  title="Delete"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* LinkedIn Integration */}
      <div className="card-surface p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Linkedin className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">Connect LinkedIn</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Paste your LinkedIn access token to enable direct publishing.
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
        {linkedinToken && <p className="text-xs text-success">✓ Token configured</p>}
        <div className="pt-2 border-t border-border space-y-2">
          <p className="text-sm text-muted-foreground">
            Your LinkedIn Person URN (e.g. urn:li:person:123456).
          </p>
          <div className="flex gap-2">
            <Input
              placeholder="urn:li:person:YOUR_ID"
              value={personUrn}
              onChange={(e) => setPersonUrn(e.target.value)}
              className="bg-secondary border-border flex-1"
            />
            <Button onClick={handleSaveUrn} disabled={saving}>
              <Save className="w-4 h-4 mr-1" /> Save
            </Button>
          </div>
          {personUrn && <p className="text-xs text-success">✓ Person URN configured</p>}
        </div>
      </div>

      {/* Auto-publish */}
      <div className="card-surface p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Zap className="w-5 h-5 text-warning" />
          <h2 className="text-lg font-semibold text-foreground">Auto-Publish</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          When enabled, approved posts will automatically publish to LinkedIn at their suggested posting time.
          Only drafts that passed fact-checking AND scored 'high' engagement will auto-publish.
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
