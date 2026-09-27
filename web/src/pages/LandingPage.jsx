import { Helmet } from "react-helmet-async";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Lock, ListChecks, Sparkles, MapPin } from "lucide-react";
import { Logo } from "@/components/Logo";
import { LanguageSelector } from "@/components/LanguageSelector";
import { WhatsAppLink } from "@/components/WhatsAppLink";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAppStore } from "@/store/useAppStore";

export default function LandingPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const setPrefillChat = useAppStore((s) => s.setPrefillChat);

  const cards = [
    { title: t("card1Title"), desc: t("card1Desc"), prefill: "choosing" },
    { title: t("card2Title"), desc: t("card2Desc"), prefill: "side_effects" },
    { title: t("card3Title"), desc: t("card3Desc"), prefill: "compare" },
  ];

  return (
    <>
      <Helmet>
        <title>ContraBot — Your private contraception guide</title>
        <meta name="description" content="Free, private, WHO-based contraception counseling in your language." />
      </Helmet>

      <nav className="mx-auto flex max-w-5xl items-center justify-between px-6 py-6">
        <Logo />
        <div className="flex items-center gap-4">
          <span className="hidden text-sm text-muted sm:inline">{t("tagline")}</span>
          <LanguageSelector className="w-36" />
        </div>
      </nav>

      <main className="mx-auto max-w-5xl px-6 py-8">
        <section className="py-12 text-center">
          <h1 className="text-3xl font-semibold text-ink sm:text-4xl">{t("heroTitle")}</h1>
          <p className="mx-auto mt-4 max-w-xl text-lg text-muted">{t("heroSub")}</p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button size="lg" onClick={() => navigate("/chat")}>
              {t("startCta")}
            </Button>
            <WhatsAppLink label={t("whatsappCta")} />
          </div>
          <div className="mt-8 flex flex-wrap justify-center gap-6 text-sm text-muted">
            <span>🔒 {t("trustPrivate")}</span>
            <span>🌍 {t("trustLang")}</span>
            <span>✅ {t("trustWho")}</span>
          </div>
        </section>

        <section className="grid gap-6 py-12 md:grid-cols-3">
          {[
            { n: 1, icon: ListChecks, title: t("step1Title"), desc: t("step1Desc") },
            { n: 2, icon: Sparkles, title: t("step2Title"), desc: t("step2Desc") },
            { n: 3, icon: MapPin, title: t("step3Title"), desc: t("step3Desc") },
          ].map(({ n, icon: Icon, title, desc }) => (
            <Card key={n} className="text-center">
              <CardContent className="flex flex-col items-center gap-3 pt-6">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-white font-semibold">{n}</div>
                <Icon className="h-6 w-6 text-primary" />
                <h3 className="font-semibold">{title}</h3>
                <p className="text-sm text-muted">{desc}</p>
              </CardContent>
            </Card>
          ))}
        </section>

        <section className="grid gap-6 py-8 md:grid-cols-3">
          {cards.map((c) => (
            <Card key={c.prefill}>
              <CardContent className="space-y-3 pt-6">
                <h3 className="font-semibold text-primary">{c.title}</h3>
                <p className="text-sm text-muted">{c.desc}</p>
                <button
                  type="button"
                  className="text-sm font-medium text-secondary hover:underline"
                  onClick={() => {
                    setPrefillChat(c.prefill);
                    navigate("/chat");
                  }}
                >
                  {t("tryThis")}
                </button>
              </CardContent>
            </Card>
          ))}
        </section>

        <div className="my-12 flex items-center gap-3 rounded-2xl bg-primary/10 px-6 py-4 text-sm text-ink">
          <Lock className="h-5 w-5 shrink-0 text-primary" />
          <p>{t("privacyBanner")}</p>
        </div>
      </main>

      <footer className="border-t border-line py-8 text-center text-sm text-muted">
        <p>{t("footer")}</p>
        <a href="https://github.com" className="mt-2 inline-block text-primary hover:underline" target="_blank" rel="noreferrer">
          GitHub
        </a>
      </footer>
    </>
  );
}
