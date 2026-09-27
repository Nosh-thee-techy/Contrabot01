import { create } from "zustand";
import { persist } from "zustand/middleware";

const loadSessions = () => {
  try {
    return JSON.parse(localStorage.getItem("chw_sessions") || "[]");
  } catch {
    return [];
  }
};

const loadOutcomes = () => {
  try {
    return JSON.parse(localStorage.getItem("chw_outcomes") || "[]");
  } catch {
    return [];
  }
};

export const useChwStore = create(
  persist(
    (set, get) => ({
      profile: null,
      setProfile: (profile) => set({ profile }),

      sessions: loadSessions(),
      outcomes: loadOutcomes(),

      addSession: (session) => {
        const sessions = [
          {
            ...session,
            id: session.id || `sess-${Date.now()}`,
            at: session.at || new Date().toISOString(),
            started_at: session.started_at || new Date().toISOString(),
            outcome_logged: session.outcome_logged || false,
          },
          ...get().sessions,
        ].slice(0, 100);
        localStorage.setItem("chw_sessions", JSON.stringify(sessions));
        set({ sessions });
        return sessions[0];
      },

      updateSession: (sessionId, patch) => {
        const sessions = get().sessions.map((s) => (s.id === sessionId ? { ...s, ...patch } : s));
        localStorage.setItem("chw_sessions", JSON.stringify(sessions));
        set({ sessions });
      },

      addOutcome: (outcome) => {
        const row = {
          ...outcome,
          id: outcome.id || Date.now(),
          at: outcome.at || new Date().toISOString(),
        };
        const outcomes = [row, ...get().outcomes];
        localStorage.setItem("chw_outcomes", JSON.stringify(outcomes));
        set({ outcomes });

        if (outcome.session_id) {
          get().updateSession(outcome.session_id, {
            outcome_logged: true,
            ended_at: row.at,
            chosen_method: outcome.chosen_method,
            followup: outcome.followup,
            notes: outcome.notes,
          });
        }
        return row;
      },

      refresh: () => set({ sessions: loadSessions(), outcomes: loadOutcomes() }),
    }),
    { name: "chw_profile", partialize: (s) => ({ profile: s.profile }) }
  )
);

export function getStats(sessions) {
  const today = new Date().toDateString();
  const todayCount = sessions.filter((s) => new Date(s.at).toDateString() === today).length;
  const methods = {};
  sessions.forEach((s) => {
    if (s.top_method) methods[s.top_method] = (methods[s.top_method] || 0) + 1;
  });
  const top = Object.entries(methods).sort((a, b) => b[1] - a[1])[0];

  const durations = sessions
    .filter((s) => s.started_at && s.ended_at)
    .map((s) => (new Date(s.ended_at) - new Date(s.started_at)) / 60000)
    .filter((m) => m > 0 && m < 180);
  const avg =
    durations.length > 0
      ? `${Math.max(1, Math.round(durations.reduce((a, b) => a + b, 0) / durations.length))} min`
      : "—";

  return {
    today: todayCount,
    total: sessions.length,
    topMethod: top ? top[0] : "—",
    avgMin: avg,
  };
}

export function getFollowupsDue(outcomes, withinDays = 7) {
  const now = Date.now();
  const windowMs = withinDays * 24 * 60 * 60 * 1000;
  return outcomes.filter((o) => {
    if (o.followup === "scheduled" && o.followup_at) {
      const t = new Date(o.followup_at).getTime();
      return !Number.isNaN(t) && t >= now - 24 * 60 * 60 * 1000 && t <= now + windowMs;
    }
    if (o.followup === "yes" || o.followup === "scheduled") {
      const created = new Date(o.at || o.followup_at || 0).getTime();
      return !Number.isNaN(created) && now - created <= windowMs;
    }
    return false;
  });
}
