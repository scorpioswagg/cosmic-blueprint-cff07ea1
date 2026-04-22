import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Sign In — Cosmic Blueprint" },
      { name: "description", content: "Sign in to your Cosmic Blueprint account." },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        <div className="text-center">
          <Link to="/" className="inline-flex items-center gap-2 text-lg font-bold text-foreground">
            Cosmic <span className="text-primary">Blueprint</span>
          </Link>
          <h1 className="mt-6 text-2xl font-bold text-foreground">Welcome Back</h1>
          <p className="mt-2 text-sm text-muted-foreground">Sign in to access your charts and reports</p>
        </div>
        <div className="mt-8 rounded-2xl border border-border/50 bg-card/50 p-6 backdrop-blur-sm">
          <p className="text-center text-sm text-muted-foreground">
            Authentication will be connected after database setup.
          </p>
        </div>
      </div>
    </div>
  );
}
