import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Post, PostMetrics, AgentLog } from "@/types/database";
import { PasswordGate } from "@/components/PasswordGate";
import { HeaderBar } from "@/components/HeaderBar";
import { DraftQueue } from "@/components/DraftQueue";
import { SidebarPanel } from "@/components/SidebarPanel";
import { PublishedView } from "@/components/PublishedView";
import { AnalyticsView } from "@/components/AnalyticsView";
import { SettingsPage } from "@/components/SettingsPage";

type Tab = "today" | "drafts" | "published" | "analytics" | "settings";

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

  useEffect(() => {
    if (authenticated) fetchData();
  }, [authenticated, fetchData]);

  // Auto-refresh every 60 seconds
  useEffect(() => {
    if (!authenticated) return;
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, [authenticated, fetchData]);

  if (!authChecked) {
    return <div className="min-h-screen bg-background" />;
  }

  if (!authenticated) {
    return <PasswordGate onAuthenticated={() => setAuthenticated(true)} />;
  }

  // Weekly count
  const now = new Date();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  monday.setHours(0, 0, 0, 0);
  const weeklyCount = posts.filter(
    (p) =>
      (p.status === "published" || p.status === "approved") &&
      new Date(p.created_at) >= monday
  ).length;

  const tabs: { key: Tab; label: string }[] = [
    { key: "today", label: "Today" },
    { key: "drafts", label: "Drafts" },
    { key: "published", label: "Published" },
    { key: "analytics", label: "Analytics" },
  ];

  const todayStr = new Date().toISOString().split("T")[0];
  const todaysDrafts = posts.filter(
    (p) => (p.status === "draft" || p.status === "approved") && p.created_at.startsWith(todayStr)
  );

  return (
    <div className="min-h-screen bg-background">
      <HeaderBar
        weeklyCount={weeklyCount}
        onSettingsClick={() => setActiveTab("settings")}
        onDataRefresh={fetchData}
      />

      {activeTab === "settings" ? (
        <div className="max-w-screen-2xl mx-auto px-3 sm:px-6 py-4 sm:py-6">
          <SettingsPage onBack={() => setActiveTab("today")} />
        </div>
      ) : (
        <>
          {/* Tab bar — horizontal scroll on mobile */}
          <div className="max-w-screen-2xl mx-auto px-3 sm:px-6 pt-4 sm:pt-6">
            <div className="flex gap-1 p-1 bg-secondary/50 rounded-lg w-full sm:w-fit overflow-x-auto">
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex-1 sm:flex-none min-h-11 px-4 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${
                    activeTab === tab.key
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Content */}
          <div className="max-w-screen-2xl mx-auto px-3 sm:px-6 py-4 sm:py-6">
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : activeTab === "today" ? (
              <div className="flex flex-col lg:flex-row gap-4 sm:gap-6">
                <div className="flex-1 lg:w-[70%] order-2 lg:order-1 space-y-4">
                  <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                    Today's Drafts ({todaysDrafts.length})
                  </h2>
                  {todaysDrafts.length === 0 ? (
                    <div className="card-surface p-8 text-center text-sm text-muted-foreground">
                      Nothing yet for today. Tap <span className="text-foreground font-medium">New Draft</span> in the header to write one now.
                    </div>
                  ) : (
                    <DraftQueue posts={todaysDrafts} onUpdate={fetchData} />
                  )}
                </div>
                <div className="lg:w-[30%] order-1 lg:order-2">
                  <SidebarPanel posts={posts} metrics={metrics} agentLogs={agentLogs} />
                </div>
              </div>
            ) : activeTab === "drafts" ? (
              <div className="flex flex-col lg:flex-row gap-4 sm:gap-6">
                <div className="flex-1 lg:w-[70%] order-2 lg:order-1">
                  <DraftQueue posts={posts} onUpdate={fetchData} />
                </div>
                <div className="lg:w-[30%] order-1 lg:order-2">
                  <SidebarPanel posts={posts} metrics={metrics} agentLogs={agentLogs} />
                </div>
              </div>
            ) : activeTab === "published" ? (
              <PublishedView posts={posts} metrics={metrics} />
            ) : (
              <AnalyticsView posts={posts} metrics={metrics} agentLogs={agentLogs} />
            )}
          </div>
        </>
      )}
    </div>
  );
}
