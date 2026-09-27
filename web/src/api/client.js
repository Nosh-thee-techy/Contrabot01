import axios from "axios";
import { MOCK_RECOMMEND, MOCK_METHODS, MOCK_FACILITIES, MOCK_CHAT } from "./mock";

const USE_MOCK = import.meta.env.VITE_USE_MOCK === "true";
const BASE = import.meta.env.VITE_API_URL || "";

export const api = axios.create({
  baseURL: BASE,
  headers: { "Content-Type": "application/json" },
  timeout: 30000,
});

export async function postRecommend(payload) {
  if (USE_MOCK) {
    await delay(1200);
    return MOCK_RECOMMEND;
  }
  const { data } = await api.post("/api/recommend", payload);
  return data;
}

export async function postChat(payload) {
  if (USE_MOCK) {
    await delay(800);
    return MOCK_CHAT;
  }
  const { data } = await api.post("/api/chat", payload);
  return data;
}

export async function getFacilities(district) {
  if (USE_MOCK) {
    await delay(500);
    return MOCK_FACILITIES;
  }
  const { data } = await api.get("/api/facilities", { params: { district, limit: 5 } });
  return data;
}

export async function getMethods() {
  if (USE_MOCK) {
    return { methods: MOCK_METHODS };
  }
  const { data } = await api.get("/api/methods");
  return data;
}

export async function createReferral(payload) {
  if (USE_MOCK) {
    await delay(400);
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

function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
