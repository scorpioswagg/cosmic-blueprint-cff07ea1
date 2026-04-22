import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/chart")({
  head: () => ({
    meta: [
      { title: "Birth Chart Calculator — Cosmic Blueprint" },
      { name: "description", content: "Enter your birth details to generate your precise astrological birth chart." },
    ],
  }),
  component: ChartPage,
});

function ChartPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-lg">
        <div className="text-center">
          <Link to="/" className="inline-flex items-center gap-2 text-lg font-bold text-foreground">
            Cosmic <span className="text-primary">Blueprint</span>
          </Link>
          <h1 className="mt-6 text-2xl font-bold text-foreground">Generate Your Birth Chart</h1>
          <p className="mt-2 text-sm text-muted-foreground">Enter your birth details for precise calculations</p>
        </div>
        <div className="mt-8 rounded-2xl border border-border/50 bg-card/50 p-6 backdrop-blur-sm">
          <p className="text-center text-sm text-muted-foreground">
            Chart input form coming after database setup.
          </p>
        </div>
      </div>
    </div>
  );
}
