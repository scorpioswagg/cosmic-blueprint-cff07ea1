const testimonials = [
  {
    name: "Sarah M.",
    role: "Yoga Instructor",
    content: "The natal chart report was incredibly detailed. It explained patterns in my life I'd never understood before. The career insights were spot-on!",
    rating: 5,
  },
  {
    name: "James R.",
    role: "Software Engineer",
    content: "I was skeptical, but the accuracy of the planetary calculations convinced me. The compatibility report helped my relationship tremendously.",
    rating: 5,
  },
  {
    name: "Luna K.",
    role: "Artist & Healer",
    content: "The Soul Purpose report changed my life direction. Knowing my North Node path gave me the courage to pursue my true calling.",
    rating: 5,
  },
];

export function TestimonialsSection() {
  return (
    <section id="testimonials" className="relative py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="text-center">
          <span className="text-sm font-semibold uppercase tracking-wider text-accent">
            Testimonials
          </span>
          <h2 className="mt-3 text-3xl font-bold text-foreground sm:text-4xl">
            What Our Users Say
          </h2>
        </div>

        <div className="mt-16 grid gap-6 sm:grid-cols-3">
          {testimonials.map((t) => (
            <div
              key={t.name}
              className="rounded-2xl border border-border/50 bg-card/30 p-6 backdrop-blur-sm"
            >
              <div className="flex gap-1">
                {Array.from({ length: t.rating }).map((_, i) => (
                  <svg key={i} viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4 text-primary">
                    <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
                  </svg>
                ))}
              </div>
              <p className="mt-4 text-sm leading-relaxed text-muted-foreground">"{t.content}"</p>
              <div className="mt-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/20 text-sm font-bold text-accent">
                  {t.name[0]}
                </div>
                <div>
                  <div className="text-sm font-semibold text-foreground">{t.name}</div>
                  <div className="text-xs text-muted-foreground">{t.role}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
