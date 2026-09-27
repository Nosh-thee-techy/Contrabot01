import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectItem } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ChwRecommendPanel } from "@/components/ChwRecommendPanel";
import { postRecommend, getFacilities, postOutcome } from "@/api/client";
import { useChwStore } from "@/store/useChwStore";
import { AGE_GROUPS, HEALTH_OPTS, RED_FLAGS, METHODS_LIST, toApiPayload } from "@/lib/constants";

const emptyForm = {
  age_group: "",
  parity: "",
  breastfeeding: "",
  health_flags: [],
  preference: "",
  access: "",
  sensitivity: "none",
  pregnancy_goal: "unsure",
  district: "",
};

function defaultFollowupAt() {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return d.toISOString().slice(0, 10);
}

export default function ConsultPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { profile, addSession, addOutcome } = useChwStore();
  const referralCode = searchParams.get("referral") || "";
  const districtParam = searchParams.get("district") || "";

  const [form, setForm] = useState({
    ...emptyForm,
    district: districtParam || profile?.district || "",
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [facilities, setFacilities] = useState(null);
  const [activeSessionId, setActiveSessionId] = useState(null);
  const [outcome, setOutcome] = useState({
    accepted: "yes",
    method: "",
    followup: "yes",
    followup_at: defaultFollowupAt(),
    notes: "",
  });

  useEffect(() => {
    if (profile?.role === "supervisor") {
      navigate("/");
    }
  }, [profile, navigate]);

  useEffect(() => {
    if (districtParam || profile?.district) {
      setForm((f) => ({ ...f, district: districtParam || profile?.district || f.district }));
    }
  }, [districtParam, profile?.district]);

  const hasRedFlag = form.health_flags.some((f) => RED_FLAGS.has(f));
  const valid =
    form.age_group &&
    form.parity &&
    form.breastfeeding &&
    form.preference &&
    form.access &&
    (form.health_flags.length > 0 || form.none_health);

  const toggleHealth = (id) => {
    if (id === "none") {
      setForm({ ...form, health_flags: [], none_health: true });
      return;
    }
    setForm((f) => ({
      ...f,
      none_health: false,
      health_flags: f.health_flags.includes(id) ? f.health_flags.filter((x) => x !== id) : [...f.health_flags, id],
    }));
  };

  const submit = async () => {
    setError("");
    setLoading(true);
    try {
      const payload = toApiPayload(form);
      const data = await postRecommend(payload);
      setResult(data);
      const started = new Date().toISOString();
      const session = addSession({
        age_group: form.age_group,
        top_method: data.recommendations?.[0]?.method,
        outcome_logged: false,
        notes: "",
        started_at: started,
        at: started,
        referral_code: referralCode || undefined,
        district: form.district || profile?.district,
      });
      setActiveSessionId(session.id);
    } catch {
      setError("Could not generate recommendation. Check your connection or try mock mode.");
    } finally {
      setLoading(false);
    }
  };

  const saveOutcome = async () => {
    const top = result?.recommendations?.[0]?.method;
    const followup = outcome.followup === "yes" ? "scheduled" : outcome.followup;
    const payload = {
      district: profile?.district || form.district || "Unknown",
      recommended_method: top,
      accepted: outcome.accepted === "yes",
      chosen_method: outcome.method || top,
      followup,
      followup_at: followup === "scheduled" ? outcome.followup_at : null,
      notes: outcome.notes?.slice(0, 200),
      chw_id: profile?.chw_id || null,
      session_id: activeSessionId,
    };

    setSaving(true);
    setError("");
    try {
      await postOutcome(payload);
      addOutcome({ ...payload, at: new Date().toISOString() });
      navigate("/");
    } catch {
      // Still keep local copy so field work isn't lost offline
      addOutcome({ ...payload, at: new Date().toISOString(), sync_failed: true });
      setError("Saved locally. Could not sync to server — check API connection.");
    } finally {
      setSaving(false);
      setForm({ ...emptyForm, district: profile?.district || "" });
      setResult(null);
      setActiveSessionId(null);
      setOutcome({ accepted: "yes", method: "", followup: "yes", followup_at: defaultFollowupAt(), notes: "" });
    }
  };

  const findFacility = async () => {
    const d = profile?.district || form.district || "Nairobi";
    const data = await getFacilities(d);
    setFacilities(data.facilities);
  };

  return (
    <>
      <Helmet>
        <title>New consultation — ContraBot CHW</title>
      </Helmet>

      <div className="mx-auto max-w-6xl px-6 py-8">
        <Link to="/" className="text-sm text-primary hover:underline">
          ← Dashboard
        </Link>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold">New consultation</h1>
          {referralCode && <Badge variant="secondary">Referral {referralCode}</Badge>}
        </div>

        <div className="mt-8 grid gap-8 lg:grid-cols-2">
          <div className="space-y-6">
            <Card className="p-6 space-y-4">
              <h2 className="font-semibold">Client profile</h2>
              <p className="text-xs text-muted">No personal names collected.</p>
              <div>
                <Label>Age group</Label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {AGE_GROUPS.map((a) => (
                    <button
                      key={a}
                      type="button"
                      onClick={() => setForm({ ...form, age_group: a })}
                      className={`rounded-xl border px-3 py-2 text-sm ${form.age_group === a ? "border-primary bg-primary/10 text-primary" : "border-line"}`}
                    >
                      {a}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Been pregnant before?</Label>
                  <div className="mt-2 flex gap-2">
                    {["yes", "no"].map((v) => (
                      <button key={v} type="button" onClick={() => setForm({ ...form, parity: v })} className={`rounded-xl border px-4 py-2 text-sm capitalize ${form.parity === v ? "border-primary bg-primary/10" : ""}`}>
                        {v}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <Label>Breastfeeding (&lt;6 mo)?</Label>
                  <div className="mt-2 flex gap-2">
                    {["yes", "no"].map((v) => (
                      <button key={v} type="button" onClick={() => setForm({ ...form, breastfeeding: v })} className={`rounded-xl border px-4 py-2 text-sm capitalize ${form.breastfeeding === v ? "border-primary bg-primary/10" : ""}`}>
                        {v}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </Card>

            <Card className="p-6 space-y-4">
              <h2 className="font-semibold">Health screening</h2>
              {HEALTH_OPTS.map((h) => (
                <label key={h.id} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={form.health_flags.includes(h.id)} onChange={() => toggleHealth(h.id)} />
                  {h.label}
                </label>
              ))}
              <label className="flex items-center gap-2 text-sm font-medium">
                <input type="checkbox" checked={form.none_health} onChange={() => toggleHealth("none")} />
                None of the above
              </label>
              {hasRedFlag && (
                <p className="rounded-xl border border-accent/30 bg-accent/10 p-3 text-sm text-accent">
                  Combined hormonal methods are contraindicated. Recommendation engine will exclude them.
                </p>
              )}
            </Card>

            <Card className="p-6 space-y-4">
              <h2 className="font-semibold">Preferences & access</h2>
              <div>
                <Label>Preference</Label>
                <div className="mt-2 space-y-2">
                  {[
                    ["forget", "Set & forget"],
                    ["daily", "Daily control"],
                    ["non_hormonal", "Non-hormonal"],
                    ["unsure", "Unsure"],
                  ].map(([v, l]) => (
                    <label key={v} className="flex items-center gap-2 text-sm">
                      <input type="radio" name="pref" checked={form.preference === v} onChange={() => setForm({ ...form, preference: v })} />
                      {l}
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <Label>Access</Label>
                <div className="mt-2 space-y-2">
                  {[
                    ["clinic", "Clinic accessible"],
                    ["pharmacy", "Pharmacy only"],
                    ["chw", "CHW-administered only"],
                  ].map(([v, l]) => (
                    <label key={v} className="flex items-center gap-2 text-sm">
                      <input type="radio" name="access" checked={form.access === v} onChange={() => setForm({ ...form, access: v })} />
                      {l}
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <Label>Hormonal sensitivity</Label>
                <Select value={form.sensitivity} onValueChange={(v) => setForm({ ...form, sensitivity: v })}>
                  <SelectItem value="none">No concerns</SelectItem>
                  <SelectItem value="mild">Mild sensitivity reported</SelectItem>
                  <SelectItem value="high">High sensitivity reported</SelectItem>
                </Select>
              </div>
              <div>
                <Label>Pregnancy goal</Label>
                <Select value={form.pregnancy_goal} onValueChange={(v) => setForm({ ...form, pregnancy_goal: v })}>
                  <SelectItem value="avoid_long">Avoid pregnancy — long term</SelectItem>
                  <SelectItem value="spacing_1_3">Spacing 1–3 years</SelectItem>
                  <SelectItem value="spacing_3_plus">Spacing 3+ years</SelectItem>
                  <SelectItem value="unsure">Unsure</SelectItem>
                </Select>
              </div>
            </Card>

            {error && <p className="text-sm text-accent">{error}</p>}
            <Button size="lg" className="w-full" disabled={!valid || loading} onClick={submit}>
              Get recommendation →
            </Button>
          </div>

          <div className="space-y-6">
            <ChwRecommendPanel loading={loading} result={result} onFindFacility={findFacility} />

            {facilities && (
              <Card className="p-4 space-y-2">
                <h3 className="font-semibold">Nearby facilities</h3>
                {facilities.map((f) => (
                  <div key={f.name} className="text-sm border-t border-line pt-2">
                    <strong>{f.name}</strong> — {f.phone}
                  </div>
                ))}
              </Card>
            )}

            {result && (
              <Card className="p-6 space-y-4">
                <h3 className="font-semibold">Log outcome</h3>
                <div>
                  <Label>Accepted recommendation?</Label>
                  <div className="mt-2 flex gap-4 text-sm">
                    {["yes", "no", "undecided"].map((v) => (
                      <label key={v}>
                        <input type="radio" name="acc" checked={outcome.accepted === v} onChange={() => setOutcome({ ...outcome, accepted: v })} className="mr-1" />
                        {v}
                      </label>
                    ))}
                  </div>
                </div>
                {outcome.accepted === "yes" && (
                  <div>
                    <Label>Method chosen</Label>
                    <Select value={outcome.method} onValueChange={(v) => setOutcome({ ...outcome, method: v })} placeholder="Select method">
                      {METHODS_LIST.map((m) => (
                        <SelectItem key={m} value={m}>
                          {m}
                        </SelectItem>
                      ))}
                    </Select>
                  </div>
                )}
                <div>
                  <Label>Follow-up?</Label>
                  <div className="mt-2 flex flex-wrap gap-4 text-sm">
                    {[
                      ["yes", "Schedule"],
                      ["no", "No"],
                      ["referred", "Referred to clinic"],
                    ].map(([v, l]) => (
                      <label key={v}>
                        <input type="radio" name="fu" checked={outcome.followup === v} onChange={() => setOutcome({ ...outcome, followup: v })} className="mr-1" />
                        {l}
                      </label>
                    ))}
                  </div>
                </div>
                {outcome.followup === "yes" && (
                  <div>
                    <Label>Follow-up date</Label>
                    <Input type="date" value={outcome.followup_at} onChange={(e) => setOutcome({ ...outcome, followup_at: e.target.value })} />
                  </div>
                )}
                <div>
                  <Label>Notes (optional)</Label>
                  <Textarea maxLength={200} value={outcome.notes} onChange={(e) => setOutcome({ ...outcome, notes: e.target.value })} />
                </div>
                <Button variant="outline" className="w-full" disabled={saving} onClick={saveOutcome}>
                  {saving ? "Saving…" : "Save & return to dashboard →"}
                </Button>
              </Card>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
