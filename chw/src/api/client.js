import axios from "axios";

const USE_MOCK = import.meta.env.VITE_USE_MOCK === "true";
const BASE = import.meta.env.VITE_API_URL || "";

export const api = axios.create({ baseURL: BASE, timeout: 30000 });

const MOCK = {
  recommendations: [
    {
      method: "implant",
      name: "Contraceptive implant",
      description: "Small rod in the arm — 3-5 years protection.",
      mec_category: 1,
      effectiveness_typical: 0.99,
      effectiveness_perfect: 0.99,
      duration: "3-5 years",
      reversibility: "High",
      cost_band: "Moderate",
      access_required: "Clinic",
      hormonal_type: "Progestogen-only",
      breastfeeding_ok: true,
      side_effects: [
        { name: "Irregular bleeding", severity: "moderate", quadrant: "inform", timeline: "First 3-6 months" },
      ],
      chw_script: "You can tell her: This small rod goes in your upper arm at the clinic. Once it's in, you don't need to think about contraception for 3 years.",
    },
    {
      method: "pop",
      name: "Progestogen-only pill",
      description: "Daily pill — suitable while breastfeeding.",
      mec_category: 1,
      effectiveness_typical: 0.91,
      effectiveness_perfect: 0.99,
      duration: "Daily",
      reversibility: "High",
      cost_band: "Low",
      access_required: "Pharmacy",
      hormonal_type: "Progestogen-only",
      breastfeeding_ok: true,
      side_effects: [{ name: "Irregular bleeding", severity: "moderate", quadrant: "inform", timeline: "First 3 months" }],
      chw_script: "You can tell her: She takes one pill at the same time each day. It's safe while breastfeeding.",
    },
  ],
  safety_eliminations: [],
};

export async function postRecommend(payload) {
  if (USE_MOCK) {
    await new Promise((r) => setTimeout(r, 1000));
    return MOCK;
  }
  const { data } = await api.post("/api/recommend", payload);
  return data;
}

export async function getFacilities(district) {
  if (USE_MOCK) {
    return {
      facilities: [
        { name: "Nairobi West Health Centre", district, services: ["Implant", "IUD"], phone: "+254712345001", hours: "Mon–Fri 8–5", lat: -1.29, lng: 36.82 },
      ],
    };
  }
  const { data } = await api.get("/api/facilities", { params: { district, limit: 3 } });
  return data;
}

export async function postOutcome(payload) {
  if (USE_MOCK) {
    await new Promise((r) => setTimeout(r, 300));
    return { status: "logged", mock: true };
  }
  const { data } = await api.post("/api/outcomes", payload);
  return data;
}

export async function getOutcomeAnalytics(district) {
  if (USE_MOCK) {
    return {
      total: 12,
      accepted: 8,
      acceptance_rate: 67,
      by_method: { implant: 5, pop: 4, condom: 3 },
      by_district: { [district || "Nairobi"]: 12 },
    };
  }
  const { data } = await api.get("/api/analytics/outcomes", { params: district ? { district } : {} });
  return data;
}

export async function createReferral(payload) {
  if (USE_MOCK) {
    return {
      id: Date.now(),
      code: `CB-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
      district: payload.district,
      channel: payload.channel || "web",
      method_interest: payload.method_interest,
      status: "open",
      created_at: new Date().toISOString(),
    };
  }
  const { data } = await api.post("/api/referrals", payload);
  return data;
}

export async function listReferrals(district, status = "open") {
  if (USE_MOCK) {
    return {
      referrals: [
        {
          id: 1,
          code: "CB-DEMO",
          district: district || "Nairobi",
          channel: "whatsapp",
          method_interest: "implant",
          status: "open",
          created_at: new Date().toISOString(),
        },
      ],
      counts: { open: 1, claimed: 0, completed: 0, total: 1 },
    };
  }
  const { data } = await api.get("/api/referrals", { params: { district, status } });
  return data;
}

export async function updateReferral(id, payload) {
  if (USE_MOCK) {
    return { id, ...payload, status: payload.status || "claimed" };
  }
  const { data } = await api.patch(`/api/referrals/${id}`, payload);
  return data;
}

export function getWhatsAppBotUrl(text = "Hi ContraBot") {
  const phone = String(import.meta.env.VITE_WHATSAPP_NUMBER || "").replace(/\D/g, "");
  if (!phone) return null;
  return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
}
