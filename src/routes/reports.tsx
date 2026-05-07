import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getReportProducts, checkAdminAccess } from "@/utils/reports/reports.functions";
import { supabase } from "@/integrations/supabase/client";
import { Starfield } from "@/components/Starfield";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";

export const Route = createFileRoute("/reports")({
  head: () => ({
    meta: [
      { title: "Astrology Reports — Cosmic Blueprint" },
      {
        name: "description",
        content:
          "Browse 13 powerful in-depth astrology reports. Natal charts, compatibility, transits, career, past life, and more.",
      },
    ],
  }),
  component: ReportsPage,
});

const iconMap: Record<string, string> = {
  natal: "🌟",
  compatibility: "💞",
  transit: "🔮",
  soul_purpose: "🧭",
  solar_return: "☀️",
  lunar_return: "🌙",
  progressed: "🦋",
  career_vocation: "💼",
  relocation: "🌍",
  child_profile: "👶",
  past_life_karma: "🔄",
  health_wellness: "🌿",
  financial_abundance: "💰",
};

const gradientMap: Record<string, string> = {
  natal: "from-primary/20 to-primary/5",
  compatibility: "from-pink-500/20 to-pink-500/5",
  transit: "from-violet-500/20 to-violet-500/5",
  soul_purpose: "from-amber-500/20 to-amber-500/5",
  solar_return: "from-yellow-500/20 to-yellow-500/5",
  lunar_return: "from-indigo-500/20 to-indigo-500/5",
  progressed: "from-teal-500/20 to-teal-500/5",
  career_vocation: "from-blue-500/20 to-blue-500/5",
  relocation: "from-emerald-500/20 to-emerald-500/5",
  child_profile: "from-rose-500/20 to-rose-500/5",
  past_life_karma: "from-purple-500/20 to-purple-500/5",
  health_wellness: "from-green-500/20 to-green-500/5",
  financial_abundance: "from-orange-500/20 to-orange-500/5",
};

interface ReportProduct {
  id: string;
  report_type: string;
  name: string;
  tagline: string;
  description: string;
  price_cents: number;
  page_estimate: string;
  sort_order: number;
}

function ReportsPage() {
  const fetchProducts = useServerFn(getReportProducts);
  const fetchAdmin = useServerFn(checkAdminAccess);
  const [products, setProducts] = useState<ReportProduct[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProducts().then((data) => {
      setProducts(data as ReportProduct[]);
      setLoading(false);
    });

    supabase.auth.getSession().then(async ({ data }) => {
      if (data.session) {
        setIsSignedIn(true);
        try {
          const token = data.session.access_token;
          const result = await fetchAdmin({
            headers: { Authorization: `Bearer ${token}` },
          });
          setIsAdmin(result.isAdmin);
        } catch {
          // not admin
        }
      }
    });
  }, []);

  return (
    <div className="relative min-h-screen bg-background">
      <Starfield />
      <Header />
      <main className="relative z-10 px-4 py-20 sm:px-6">
        <div className="mx-auto max-w-7xl">
          <div className="text-center">
            <span className="text-sm font-semibold uppercase tracking-wider text-accent">
              Our Reports
            </span>
            <h1 className="mt-3 text-3xl font-bold text-foreground sm:text-5xl">
              13 Powerful Astrology Reports
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
              Each report is generated from precise Swiss Ephemeris calculations and interpreted
              with deep astrological expertise. Choose the insights that speak to your journey.
            </p>
            {isAdmin && (
              <div className="mx-auto mt-4 inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary">
                <span>👑</span> Admin — All reports are free for you
              </div>
            )}
          </div>

          {loading ? (
            <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="h-72 animate-pulse rounded-2xl border border-border/30 bg-card/30"
                />
              ))}
            </div>
          ) : (
            <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {products.map((p) => (
                <ReportCard
                  key={p.id}
                  product={p}
                  isAdmin={isAdmin}
                  isSignedIn={isSignedIn}
                />
              ))}
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}

function ReportCard({
  product,
  isAdmin,
  isSignedIn,
}: {
  product: ReportProduct;
  isAdmin: boolean;
  isSignedIn: boolean;
}) {
  const icon = iconMap[product.report_type] ?? "✨";
  const gradient = gradientMap[product.report_type] ?? "from-primary/20 to-primary/5";
  const price = isAdmin ? "Free" : `$${(product.price_cents / 100).toFixed(2)}`;

  return (
    <div className="group relative flex flex-col overflow-hidden rounded-2xl border border-border/50 bg-card/50 p-6 backdrop-blur-sm transition-all hover:border-accent/30 hover:shadow-lg hover:shadow-accent/5">
      <div
        className={`absolute inset-0 bg-gradient-to-b ${gradient} opacity-0 transition-opacity group-hover:opacity-100`}
      />
      <div className="relative flex flex-1 flex-col">
        <div className="flex items-start justify-between">
          <span className="text-3xl">{icon}</span>
          <span className="rounded-full bg-background/60 px-2.5 py-0.5 text-xs text-muted-foreground backdrop-blur-sm">
            {product.page_estimate}
          </span>
        </div>
        <h3 className="mt-3 text-lg font-semibold text-foreground">{product.name}</h3>
        <p className="mt-0.5 text-xs font-medium italic text-accent">{product.tagline}</p>
        <p className="mt-3 flex-1 text-sm leading-relaxed text-muted-foreground">
          {product.description}
        </p>
        <div className="mt-5 flex items-end justify-between">
          <div>
            {isAdmin ? (
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold text-primary">Free</span>
                <span className="text-xs text-muted-foreground line-through">
                  ${(product.price_cents / 100).toFixed(2)}
                </span>
              </div>
            ) : (
              <span className="text-2xl font-bold text-primary">{price}</span>
            )}
          </div>
          {isSignedIn ? (
            <button className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-all hover:bg-primary/90 hover:shadow-md hover:shadow-primary/25">
              {isAdmin ? "Generate" : "Purchase"}
            </button>
          ) : (
            <Link
              to="/login"
              className="rounded-lg border border-primary/50 bg-primary/10 px-4 py-2 text-sm font-semibold text-primary transition-all hover:bg-primary/20"
            >
              Sign in
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
