import { Link } from "@tanstack/react-router";

export function Footer() {
  return (
    <footer className="border-t border-border/50 bg-background/50 py-12">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="grid gap-8 md:grid-cols-4">
          <div>
            <span className="text-lg font-bold text-foreground">
              Cosmic <span className="text-primary">Blueprint</span>
            </span>
            <p className="mt-3 text-sm text-muted-foreground">
              Discover your destiny through precise astrological analysis powered by Swiss Ephemeris.
            </p>
          </div>
          <div>
            <h4 className="mb-3 text-sm font-semibold text-foreground">Reports</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><a href="#reports" className="hover:text-foreground">Natal Chart</a></li>
              <li><a href="#reports" className="hover:text-foreground">Compatibility</a></li>
              <li><a href="#reports" className="hover:text-foreground">Transit Forecast</a></li>
              <li><a href="#reports" className="hover:text-foreground">Soul Purpose</a></li>
            </ul>
          </div>
          <div>
            <h4 className="mb-3 text-sm font-semibold text-foreground">Company</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><a href="#features" className="hover:text-foreground">Features</a></li>
              <li><a href="#pricing" className="hover:text-foreground">Pricing</a></li>
              <li><a href="#testimonials" className="hover:text-foreground">Testimonials</a></li>
            </ul>
          </div>
          <div>
            <h4 className="mb-3 text-sm font-semibold text-foreground">Account</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link to="/login" className="hover:text-foreground">Sign In</Link></li>
              <li><Link to="/chart" className="hover:text-foreground">Get Your Chart</Link></li>
            </ul>
          </div>
        </div>
        <div className="mt-10 border-t border-border/50 pt-6 text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} Cosmic Blueprint. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
