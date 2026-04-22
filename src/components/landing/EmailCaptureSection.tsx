import { useState } from "react";

export function EmailCaptureSection() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    // TODO: save to email_signups table
    setSubmitted(true);
  };

  return (
    <section className="relative py-24">
      <div className="mx-auto max-w-2xl px-4 text-center sm:px-6">
        <div className="rounded-2xl border border-primary/20 bg-gradient-to-b from-primary/10 to-transparent p-10">
          <h2 className="text-2xl font-bold text-foreground sm:text-3xl">
            Stay Aligned with the Stars
          </h2>
          <p className="mt-3 text-muted-foreground">
            Get weekly cosmic insights, transit alerts, and exclusive report discounts.
          </p>

          {submitted ? (
            <div className="mt-6 rounded-xl bg-primary/10 p-4 text-sm text-primary">
              ✨ Welcome to the cosmic community! Check your inbox soon.
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-3 sm:flex-row">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                required
                className="flex-1 rounded-xl border border-border bg-background/50 px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <button
                type="submit"
                className="rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition-all hover:bg-primary/90 hover:shadow-lg hover:shadow-primary/25"
              >
                Subscribe
              </button>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}
