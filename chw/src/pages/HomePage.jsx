import { useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectItem } from "@/components/ui/select";
import { useChwStore, getStats, getFollowupsDue } from "@/store/useChwStore";
import { DISTRICTS } from "@/lib/constants";
import { getOutcomeAnalytics, listReferrals, updateReferral, getWhatsAppBotUrl } from "@/api/client";

export default function HomePage() {
  const navigate = useNavigate();
  const { profile, setProfile, sessions, outcomes, refresh } = useChwStore();
  const [showOnboard, setShowOnboard] = useState(false);
  const [form, setForm] = useState({ name: "", district: "Nairobi", chw_id: "", role: "chw" });
  const [viewSession, setViewSession] = useState(null);
  const [referrals, setReferrals] = useState([]);
  const [referralCounts, setReferralCounts] = useState({ open: 0 });
  const [analytics, setAnalytics] = useState(null);
  const [claimingId, setClaimingId] = useState(null);

  const isSupervisor = profile?.role === "supervisor";

  useEffect(() => {
    refresh();
    if (!profile) {
      setShowOnboard(true);
    } else {
      setForm({
        name: profile.name || "",
        district: profile.district || "Nairobi",
        chw_id: profile.chw_id || "",
        role: profile.role || "chw",
      });
    }
  }, [profile]);

  useEffect(() => {
    if (!profile?.district) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await listReferrals(profile.district, "open");
        if (!cancelled) {
          setReferrals(data.referrals || []);
          setReferralCounts(data.counts || { open: 0 });
        }
      } catch {
        if (!cancelled) setReferrals([]);
      }
      if (isSupervisor) {
        try {
          const a = await getOutcomeAnalytics(profile.district);
          if (!cancelled) setAnalytics(a);
        } catch {
          if (!cancelled) setAnalytics(null);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [profile?.district, isSupervisor]);

  const stats = getStats(sessions);
  const followups = useMemo(() => getFollowupsDue(outcomes), [outcomes]);
  const waBot = getWhatsAppBotUrl("Hi ContraBot — CHW checking in");

  const saveProfile = () => {
    if (!form.name.trim()) return;
    if (form.role === "chw" && !form.chw_id.trim()) return;
    setProfile({
      name: form.name.trim(),
      district: form.district,
      chw_id: form.chw_id.trim(),
      role: form.role,
    });
    setShowOnboard(false);
  };

  const claimReferral = async (ref) => {
    setClaimingId(ref.id);
    try {
      await updateReferral(ref.id, { status: "claimed", chw_id: profile?.chw_id });
      setReferrals((list) => list.filter((r) => r.id !== ref.id));
      navigate(`/consult?district=${encodeURIComponent(ref.district)}&referral=${encodeURIComponent(ref.code)}`);
    } catch {
      // stay on page
    } finally {
      setClaimingId(null);
    }
  };

  return (
    <>
      <Helmet>
        <title>CHW Dashboard — ContraBot</title>
      </Helmet>

      <div className="mx-auto max-w-5xl px-6 py-8">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-white font-semibold">CB</div>
            <div>
              <h1 className="text-xl font-semibold">ContraBot CHW Dashboard</h1>
              {isSupervisor && <p className="text-xs text-muted">Supervisor view · {profile?.district}</p>}
            </div>
          </div>
          {profile && (
            <div className="flex items-center gap-2">
              <Badge variant="secondary">
                {profile.name} · {profile.district}
                {profile.role === "supervisor" ? " · Supervisor" : ""}
              </Badge>
              <button type="button" className="text-sm text-primary" onClick={() => setShowOnboard(true)}>
                Change details
              </button>
            </div>
          )}
        </header>

        {isSupervisor ? (
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: "District outcomes", value: analytics?.total ?? "—" },
              { label: "Acceptance rate", value: analytics ? `${analytics.acceptance_rate}%` : "—" },
              { label: "Open referrals", value: referralCounts.open ?? 0 },
              { label: "Top method", value: Object.entries(analytics?.by_method || {}).sort((a, b) => b[1] - a[1])[0]?.[0] || "—" },
            ].map((s) => (
              <Card key={s.label} className="p-6 text-center">
                <p className="text-2xl font-semibold text-primary">{s.value}</p>
                <p className="text-sm text-muted">{s.label}</p>
              </Card>
            ))}
          </div>
        ) : (
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: "Sessions today", value: stats.today },
              { label: "Total sessions", value: stats.total },
              { label: "Top recommended", value: stats.topMethod },
              { label: "Avg. session time", value: stats.avgMin },
            ].map((s) => (
              <Card key={s.label} className="p-6 text-center">
                <p className="text-2xl font-semibold text-primary">{s.value}</p>
                <p className="text-sm text-muted">{s.label}</p>
              </Card>
            ))}
          </div>
        )}

        {!isSupervisor && followups.length > 0 && (
          <Card className="mt-6 border-secondary/30 bg-secondary/5 p-4">
            <h2 className="font-semibold text-sm">Follow-ups due (7 days)</h2>
            <ul className="mt-2 space-y-1 text-sm text-muted">
              {followups.slice(0, 5).map((o) => (
                <li key={o.id}>
                  {o.chosen_method || o.recommended_method} · {o.district}
                  {o.followup_at ? ` · ${new Date(o.followup_at).toLocaleDateString()}` : ""}
                </li>
              ))}
            </ul>
          </Card>
        )}

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {!isSupervisor && (
            <Link to="/consult">
              <Card className="flex h-32 cursor-pointer items-center justify-center bg-primary p-6 text-center text-white hover:bg-primary/90">
                <span className="text-lg font-semibold">New consultation →</span>
              </Card>
            </Link>
          )}
          <Link to="/outcomes">
            <Card
              className={`flex h-32 cursor-pointer items-center justify-center border-2 border-primary bg-white p-6 text-center text-primary hover:bg-page ${
                isSupervisor ? "md:col-span-2" : ""
              }`}
            >
              <span className="text-lg font-semibold">{isSupervisor ? "District outcomes →" : "View outcomes →"}</span>
            </Card>
          </Link>
        </div>

        {waBot && (
          <a href={waBot} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex text-sm text-[#25D366] hover:underline">
            Message ContraBot on WhatsApp
          </a>
        )}

        <Card className="mt-8 overflow-hidden">
          <div className="flex items-center justify-between border-b border-line px-6 py-4">
            <h2 className="font-semibold">Open referrals · {profile?.district || "—"}</h2>
            <Badge variant="secondary">{referralCounts.open ?? referrals.length} open</Badge>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-page text-muted">
              <tr>
                <th className="p-3 text-left">Code</th>
                <th className="p-3 text-left">Channel</th>
                <th className="p-3 text-left">Interest</th>
                <th className="p-3 text-left">Created</th>
                <th className="p-3 text-left" />
              </tr>
            </thead>
            <tbody>
              {referrals.map((r) => (
                <tr key={r.id} className="border-t border-line">
                  <td className="p-3 font-mono font-semibold">{r.code}</td>
                  <td className="p-3 capitalize">{r.channel}</td>
                  <td className="p-3">{r.method_interest || "—"}</td>
                  <td className="p-3">{r.created_at ? new Date(r.created_at).toLocaleString() : "—"}</td>
                  <td className="p-3">
                    {!isSupervisor && (
                      <Button size="sm" disabled={claimingId === r.id} onClick={() => claimReferral(r)}>
                        Claim
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
              {!referrals.length && (
                <tr>
                  <td colSpan={5} className="p-6 text-center text-muted">
                    No open referrals in this district.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </Card>

        {!isSupervisor && (
          <Card className="mt-8 overflow-hidden">
            <div className="border-b border-line px-6 py-4 font-semibold">Recent sessions</div>
            <table className="w-full text-sm">
              <thead className="bg-page text-muted">
                <tr>
                  <th className="p-3 text-left">Time</th>
                  <th className="p-3 text-left">Age</th>
                  <th className="p-3 text-left">Top method</th>
                  <th className="p-3 text-left">Outcome</th>
                  <th className="p-3 text-left" />
                </tr>
              </thead>
              <tbody>
                {sessions.slice(0, 10).map((s) => (
                  <tr key={s.id} className="border-t border-line">
                    <td className="p-3">{new Date(s.at).toLocaleString()}</td>
                    <td className="p-3">{s.age_group}</td>
                    <td className="p-3">{s.top_method}</td>
                    <td className="p-3">
                      <Badge variant={s.outcome_logged ? "success" : "muted"}>{s.outcome_logged ? "Yes" : "No"}</Badge>
                    </td>
                    <td className="p-3">
                      <button type="button" className="text-primary hover:underline" onClick={() => setViewSession(s)}>
                        View
                      </button>
                    </td>
                  </tr>
                ))}
                {!sessions.length && (
                  <tr>
                    <td colSpan={5} className="p-6 text-center text-muted">
                      No sessions yet. Start a new consultation.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </Card>
        )}
      </div>

      <Dialog open={showOnboard} onOpenChange={setShowOnboard}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Welcome</DialogTitle>
            <DialogDescription>Set your role and district. No password required for this MVP.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Your name</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Mary" />
            </div>
            <div>
              <Label>Role</Label>
              <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                <SelectItem value="chw">Community Health Worker</SelectItem>
                <SelectItem value="supervisor">Supervisor</SelectItem>
              </Select>
            </div>
            <div>
              <Label>Your district</Label>
              <Select value={form.district} onValueChange={(v) => setForm({ ...form, district: v })}>
                {DISTRICTS.map((d) => (
                  <SelectItem key={d} value={d}>
                    {d}
                  </SelectItem>
                ))}
              </Select>
            </div>
            <div>
              <Label>CHW ID {form.role === "chw" ? "(required)" : "(optional)"}</Label>
              <Input value={form.chw_id} onChange={(e) => setForm({ ...form, chw_id: e.target.value })} placeholder="e.g. CHW-042" />
            </div>
            <Button className="w-full" onClick={saveProfile} disabled={!form.name.trim() || (form.role === "chw" && !form.chw_id.trim())}>
              Continue →
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!viewSession} onOpenChange={(open) => !open && setViewSession(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Session detail</DialogTitle>
            <DialogDescription>Anonymous consult summary</DialogDescription>
          </DialogHeader>
          {viewSession && (
            <div className="space-y-2 text-sm">
              <p>
                <strong>When:</strong> {new Date(viewSession.at).toLocaleString()}
              </p>
              <p>
                <strong>Age group:</strong> {viewSession.age_group || "—"}
              </p>
              <p>
                <strong>Top method:</strong> {viewSession.top_method || "—"}
              </p>
              <p>
                <strong>Outcome logged:</strong> {viewSession.outcome_logged ? "Yes" : "No"}
              </p>
              {viewSession.chosen_method && (
                <p>
                  <strong>Chosen:</strong> {viewSession.chosen_method}
                </p>
              )}
              {viewSession.followup && (
                <p>
                  <strong>Follow-up:</strong> {viewSession.followup}
                </p>
              )}
              {viewSession.started_at && viewSession.ended_at && (
                <p>
                  <strong>Duration:</strong>{" "}
                  {Math.max(1, Math.round((new Date(viewSession.ended_at) - new Date(viewSession.started_at)) / 60000))} min
                </p>
              )}
              {viewSession.notes && (
                <p>
                  <strong>Notes:</strong> {viewSession.notes}
                </p>
              )}
              {viewSession.referral_code && (
                <p>
                  <strong>Referral code:</strong> {viewSession.referral_code}
                </p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
