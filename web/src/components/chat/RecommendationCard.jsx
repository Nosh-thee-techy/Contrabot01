import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, Info, Shield, Compass, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useAppStore } from "@/store/useAppStore";
import { createReferral } from "@/api/client";

export function RecommendationCard({ data, onShowVisualization }) {
  const navigate = useNavigate();
  const setSelectedMethods = useAppStore((s) => s.setSelectedMethods);
  const [district, setDistrict] = useState("");
  const [referralState, setReferralState] = useState({ loading: false, code: null, error: null });

  if (!data?.recommendations?.length) return null;

  const requestChw = async () => {
    const d = district.trim();
    if (!d) {
      setReferralState({ loading: false, code: null, error: "Enter your district first." });
      return;
    }
    setReferralState({ loading: true, code: null, error: null });
    try {
      const row = await createReferral({
        district: d,
        channel: "web",
        method_interest: data.recommendations[0]?.method,
        notes: "Requested from web recommendation card",
      });
      setReferralState({ loading: false, code: row.code, error: null });
    } catch {
      setReferralState({ loading: false, code: null, error: "Could not create referral. Try again." });
    }
  };

  return (
    <div className="w-full bg-white/5 border-t-[3px] border-t-[#0E7A80] border-x border-b border-white/5 rounded-2xl p-5 shadow-2xl space-y-5">
      <div className="flex items-center justify-between border-b border-white/5 pb-3">
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-teal-400" />
          <h3 className="font-bold text-white text-base">Your Top Matches</h3>
        </div>
        <Badge variant="outline" className="bg-[#2E7D32]/10 border-[#2E7D32]/30 text-[#2E7D32] flex items-center gap-1 font-bold text-[10px]">
          <Check className="h-3 w-3" /> WHO Screened
        </Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {data.recommendations.map((m) => (
          <div
            key={m.method}
            className="bg-[#0E7A80]/8 border border-[#0E7A80]/15 rounded-xl p-4 flex flex-col justify-between hover:border-[#0E7A80]/30 transition-all duration-300 shadow-md"
          >
            <div className="space-y-2.5">
              <h4 className="font-bold text-white text-base leading-tight">{m.name}</h4>
              <p className="text-xs text-[#7A9BA8] leading-relaxed line-clamp-3">{m.description}</p>
              <div className="flex flex-wrap gap-1.5 pt-1">
                <Badge variant="outline" className="bg-[#2E7D32]/10 border-[#2E7D32]/20 text-green-400 text-[10px] py-0 px-2 font-medium">
                  {Math.round(m.effectiveness_typical * 100)}% Effective
                </Badge>
                <Badge variant="outline" className="bg-[#0E7A80]/15 border-[#0E7A80]/20 text-[#4DD6DC] text-[10px] py-0 px-2 font-medium">
                  {m.duration}
                </Badge>
                <Badge variant="outline" className="bg-[#5C3C7A]/20 border-[#5C3C7A]/40 text-[#A855F7] text-[10px] py-0 px-2 font-medium">
                  {m.access_required}
                </Badge>
              </div>
            </div>

            {onShowVisualization && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-4 w-full border-[#0E7A80]/50 text-[#4DD6DC] bg-[#0E7A80]/5 hover:bg-[#0E7A80]/20 hover:text-white transition-all text-xs font-semibold"
                onClick={() => onShowVisualization(m.method)}
              >
                See how it works →
              </Button>
            )}
          </div>
        ))}
      </div>

      <div className="bg-[#E07B39]/10 border border-[#E07B39]/30 rounded-xl p-3.5 flex items-start gap-2.5">
        <Info className="h-4.5 w-4.5 text-[#E07B39] shrink-0 mt-0.5" />
        <p className="text-xs text-[#E8F4F5] leading-relaxed">
          <strong className="text-[#E07B39] font-bold">Important:</strong> Please confirm with your nearest clinic or community health worker before starting any contraceptive method.
        </p>
      </div>

      <div className="rounded-xl border border-[#0E7A80]/25 bg-[#0E7A80]/10 p-3.5 space-y-3">
        <p className="text-xs font-semibold text-white flex items-center gap-2">
          <Users className="h-4 w-4 text-teal-300" /> Request CHW follow-up
        </p>
        <p className="text-[11px] text-[#7A9BA8]">
          We create an anonymous code for a CHW in your district. No phone number is stored.
        </p>
        <div className="flex flex-col sm:flex-row gap-2">
          <Input
            value={district}
            onChange={(e) => setDistrict(e.target.value)}
            placeholder="Your district (e.g. Nairobi)"
            className="bg-[#0D1B2A] border-[#0E7A80]/30 text-white placeholder:text-[#7A9BA8]"
          />
          <Button
            type="button"
            disabled={referralState.loading}
            onClick={requestChw}
            className="bg-[#25D366] hover:bg-[#1ebe57] text-white font-bold text-xs whitespace-nowrap"
          >
            {referralState.loading ? "Sending…" : "Request CHW"}
          </Button>
        </div>
        {referralState.code && (
          <p className="text-xs text-teal-200">
            Tell your CHW this code: <strong className="font-mono text-white text-sm">{referralState.code}</strong>
          </p>
        )}
        {referralState.error && <p className="text-xs text-[#E07B39]">{referralState.error}</p>}
      </div>

      <div className="flex flex-col sm:flex-row gap-3 pt-1">
        <Button
          onClick={() => navigate("/facilities")}
          className="flex-1 bg-[#0E7A80] hover:bg-[#0A6268] text-white font-bold text-xs py-2.5 shadow-lg shadow-[#0E7A80]/20 transition-all flex items-center justify-center gap-1.5 rounded-xl"
        >
          <Compass className="h-4 w-4" /> Find Nearest Clinic
        </Button>
        <Button
          variant="outline"
          onClick={() => {
            setSelectedMethods(data.recommendations.map((r) => r.method));
            navigate(`/compare?methods=${data.recommendations.map((r) => r.method).join(",")}`);
          }}
          className="flex-1 border-[#5C3C7A]/60 text-[#D8B4FE] bg-[#5C3C7A]/10 hover:bg-[#5C3C7A]/25 hover:text-white transition-all text-xs font-semibold rounded-xl"
        >
          Compare All Matches
        </Button>
      </div>
    </div>
  );
}
