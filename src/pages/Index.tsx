import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Post, PostMetrics, AgentLog } from "@/types/database";
import { PasswordGate } from "@/components/PasswordGate";
import { HeaderBar } from "@/components/HeaderBar";
import { DraftQueue } from "@/components/DraftQueue";
import { PublishedView } from "@/components/PublishedView";
import { AnalyticsView } from "@/components/AnalyticsView";
import { SettingsPage } from "@/components/SettingsPage";
import { BottomTabBar, MobileTab } from "@/components/mobile/BottomTabBar";
import { CostStrip } from "@/components/mobile/CostStrip";
import { HeroDraftCard } from "@/components/mobile/HeroDraftCard";
import { CompactNewsList } from "@/components/mobile/CompactNewsList";
import { AgentStatusFooter } from "@/components/mobile/AgentStatusFooter";
import { ReplyPill } from "@/components/mobile/ReplyPill";

type Tab = MobileTab | "settings";

function scoreRank(p: Post): number {
  const base = typeof p.virality_score === "number" ? p.virality_score : 0;
  const eng = p.engagement_estimate === "high" ? 2 : p.engagement_estimate === "medium" ? 1 : 0;
  const verified = p.verification_status === "passed" ? 1 : 0;
  return base + eng + verified;
}

export default function Index() {
  const [authenticated, setAuthenticated] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("today");
  const [posts, setPosts] = useState<Post[]>([]);
  const [metrics, setMetrics] = useState<PostMetrics[]>([]);
  const [agentLogs, setAgentLogs] = useState<AgentLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthenticated(!!session);
      setAuthChecked(true);
    });
    supabase.auth.getSession().then(({ data }) => {
      setAuthenticated(!!data.session);
      setAuthChecked(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [postsRes, metricsRes, logsRes] = await Promise.all([
      supabase.from("posts").select("*").order("created_at", { ascending: false }),
      supabase.from("post_metrics").select("*"),
      supabase.from("agent_log").select("*").order("created_at", { ascending: false }),
    ]);
    if (postsRes.data) setPosts(postsRes.data);
    if (metricsRes.data) setMetrics(metricsRes.data);
    if (logsRes.data) setAgentLogs(logsRes.data);
    setLoading(false);
  }, []);

  useEffect(() => { if (authenticated) fetchData(); }, [authenticated, fetchData]);

  useEffect(() => {
    if (!authenticated) return;
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, [authenticated, fetchData]);

  if (!authChecked) return <div className="min-h-screen bg-background" />;
  if (!authenticated) return <PasswordGate onAuthenticated={() => setAuthenticated(true)} />;

  // Weekly count
  const now = new Date();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  monday.setHours(0, 0, 0, 0);
  const weeklyCount = posts.filter(
    (p) => (p.status === "published" || p.status === "approved") && new Date(p.created_at) >= monday
  ).length;

  const queuedDrafts = posts
    .filter((p) => p.status === "draft" || p.status === "approved")
    .sort((a, b) => scoreRank(b) - scoreRank(a));

  return (
    <div className="min-h-screen bg-background pb-[calc(env(safe-area-inset-bottom)+72px)]">
      <HeaderBar
        weeklyCount={weeklyCount}
        onSettingsClick={() => setActiveTab("settings")}
        onDataRefresh={fetchData}
      />

      <main className="max-w-screen-sm mx-auto px-4 py-4 space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : activeTab === "settings" ? (
          <SettingsPage onBack={() => setActiveTab("today")} />
        ) : activeTab === "today" ? (
          <>
            <CostStrip agentLogs={agentLogs} />
            <HeroDraftCard drafts={queuedDrafts} onUpdate={fetchData} />
            <CompactNewsList />
            <AgentStatusFooter agentLogs={agentLogs} />
          </>
        ) : activeTab === "drafts" ? (
          <DraftQueue posts={posts} onUpdate={fetchData} />
        ) : activeTab === "published" ? (
          <PublishedView posts={posts} metrics={metrics} />
        ) : (
          <AnalyticsView posts={posts} metrics={metrics} agentLogs={agentLogs} />
        )}
      </main>

      {activeTab === "today" && <ReplyPill />}

      {activeTab !== "settings" && (
        <BottomTabBar
          active={activeTab as MobileTab}
          onChange={(t) => setActiveTab(t)}
          draftCount={queuedDrafts.length}
        />
      )}
    </div>
  );
}
