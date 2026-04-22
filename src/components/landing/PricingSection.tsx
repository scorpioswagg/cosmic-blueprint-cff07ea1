import { Link } from "@tanstack/react-router";

const tiers = [
  {
    name: "Free",
    price: "$0",
    description: "Get started with your basic chart",
    features: [
      "Sun, Moon & Rising signs",
      "Basic planet positions",
      "Quick chart summary",
      "Zodiac overview",
    ],
    cta: "Get Your Free Chart",
    href: "/chart",
    highlighted: false,
  },
  {
    name: "Premium",
    price: "$9.99",
    period: "starting at",
    description: "Full astrological deep-dive reports",
    features: [
      "Complete natal chart analysis",
      "All planet interpretations",
      "House & aspect breakdowns",
      "30–100 page PDF report",
      "Career & relationship insights",
      "Life purpose guidance",
    ],
    cta: "Unlock Full Report",
    href: "/chart",
    highlighted: true,
  },
];

export function PricingSection() {
  return (
    <section id="pricing" className="relative py-24">
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <div className="text-center">
          <span className="text-sm font-semibold uppercase tracking-wider text-primary">
            Pricing
          </span>
          <h2 className="mt-3 text-3xl font-bold text-foreground sm:text-4xl">
            Start Free, Go Deep
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
            Get your basic chart for free. Unlock premium reports for the full cosmic picture.
          </p>
        </div>

        <div className="mt-16 grid gap-8 sm:grid-cols-2">
          {tiers.map((tier) => (
            <div
              key={tier.name}
              className={`relative rounded-2xl border p-8 transition-all ${
                tier.highlighted
                  ? "border-primary/50 bg-card/80 shadow-lg shadow-primary/10"
                  : "border-border/50 bg-card/30"
              }`}
            >
              {tier.highlighted && (
                <div className="absolute -top-3 left-6 rounded-full bg-primary px-3 py-0.5 text-xs font-semibold text-primary-foreground">
                  Most Popular
                </div>
              )}
              <div>
                <h3 className="text-xl font-bold text-foreground">{tier.name}</h3>
                <div className="mt-2 flex items-baseline gap-1">
                  {tier.period && (
                    <span className="text-sm text-muted-foreground">{tier.period}</span>
                  )}
                  <span className="text-4xl font-bold text-foreground">{tier.price}</span>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{tier.description}</p>
              </div>

              <ul className="mt-6 space-y-3">
                {tier.features.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm text-foreground">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4 shrink-0 text-primary">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    {f}
                  </li>
                ))}
              </ul>

              <Link
                to={tier.href}
                className={`mt-8 block w-full rounded-xl py-3 text-center text-sm font-semibold transition-all ${
                  tier.highlighted
                    ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25 hover:bg-primary/90"
                    : "border border-border bg-secondary text-secondary-foreground hover:bg-secondary/80"
                }`}
              >
                {tier.cta}
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
