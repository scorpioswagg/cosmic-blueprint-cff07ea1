import { Link } from "@tanstack/react-router";

const reports = [
  {
    name: "Natal Chart Report",
    price: "$9.99",
    description: "Complete birth chart analysis with planet positions, house meanings, and aspect interpretations.",
    pages: "30–50 pages",
    icon: "🌟",
    color: "from-primary/20 to-primary/5",
  },
  {
    name: "Compatibility Report",
    price: "$14.99",
    description: "Synastry analysis comparing two charts to reveal relationship dynamics and chemistry.",
    pages: "40–60 pages",
    icon: "💞",
    color: "from-pink-500/20 to-pink-500/5",
  },
  {
    name: "Transit Forecast",
    price: "$19.99",
    description: "12-month forecast of planetary transits and their impact on your life areas.",
    pages: "50–80 pages",
    icon: "🔮",
    color: "from-violet-500/20 to-violet-500/5",
  },
  {
    name: "Soul Purpose Report",
    price: "$29.99",
    description: "Deep dive into your North Node, karmic patterns, and spiritual life mission.",
    pages: "60–100 pages",
    icon: "🧭",
    color: "from-amber-500/20 to-amber-500/5",
  },
];

export function ReportsSection() {
  return (
    <section id="reports" className="relative py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="text-center">
          <span className="text-sm font-semibold uppercase tracking-wider text-accent">
            Our Reports
          </span>
          <h2 className="mt-3 text-3xl font-bold text-foreground sm:text-4xl">
            Deep Cosmic Insights
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
            Each report is generated from precise Swiss Ephemeris calculations and interpreted by AI.
          </p>
        </div>

        <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {reports.map((r) => (
            <div
              key={r.name}
              className="group relative overflow-hidden rounded-2xl border border-border/50 bg-card/50 p-6 backdrop-blur-sm transition-all hover:border-accent/30 hover:shadow-lg hover:shadow-accent/5"
            >
              <div className={`absolute inset-0 bg-gradient-to-b ${r.color} opacity-0 transition-opacity group-hover:opacity-100`} />
              <div className="relative">
                <div className="flex items-start justify-between">
                  <span className="text-2xl">{r.icon}</span>
                  <span className="text-xs font-medium text-muted-foreground">{r.pages}</span>
                </div>
                <h3 className="mt-2 text-lg font-semibold text-foreground">{r.name}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{r.description}</p>
                <div className="mt-4 text-2xl font-bold text-primary">{r.price}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-10 text-center">
          <Link
            to="/reports"
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition-all hover:bg-primary/90 hover:shadow-lg hover:shadow-primary/25"
          >
            View All 13 Reports
            <span aria-hidden>→</span>
          </Link>
        </div>
      </div>
    </section>
  );
}
