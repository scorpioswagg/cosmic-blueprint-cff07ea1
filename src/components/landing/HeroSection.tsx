import { Link } from "@tanstack/react-router";

export function HeroSection() {
  return (
    <section className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 pt-16">
      {/* Gradient orbs */}
      <div className="absolute left-1/4 top-1/4 h-96 w-96 rounded-full bg-violet/10 blur-3xl" />
      <div className="absolute bottom-1/4 right-1/4 h-96 w-96 rounded-full bg-primary/10 blur-3xl" />

      <div className="relative z-10 mx-auto max-w-4xl text-center">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-sm text-primary">
          <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
            <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
          </svg>
          Powered by Swiss Ephemeris
        </div>

        <h1 className="text-5xl font-bold leading-tight tracking-tight text-foreground sm:text-6xl lg:text-7xl">
          Unlock Your{" "}
          <span className="bg-gradient-to-r from-primary via-primary to-accent bg-clip-text text-transparent">
            Cosmic Blueprint
          </span>
        </h1>

        <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground sm:text-xl">
          Discover your destiny, relationships, and life purpose through precise
          astrological analysis. Real calculations. Real insights.
        </p>

        <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Link
            to="/chart"
            className="group inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-8 py-3.5 text-base font-semibold text-primary-foreground shadow-lg shadow-primary/25 transition-all hover:bg-primary/90 hover:shadow-xl hover:shadow-primary/30"
          >
            Get Your Free Chart
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4 transition-transform group-hover:translate-x-0.5">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </Link>
          <a
            href="#pricing"
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-accent/50 bg-accent/10 px-8 py-3.5 text-base font-semibold text-accent-foreground transition-all hover:bg-accent/20"
          >
            Unlock Full Report
          </a>
        </div>

        {/* Stats */}
        <div className="mx-auto mt-16 grid max-w-lg grid-cols-3 gap-8">
          {[
            { value: "10K+", label: "Charts Generated" },
            { value: "99.9%", label: "Accuracy" },
            { value: "4.9★", label: "User Rating" },
          ].map((stat) => (
            <div key={stat.label}>
              <div className="text-2xl font-bold text-primary">{stat.value}</div>
              <div className="mt-1 text-xs text-muted-foreground">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
