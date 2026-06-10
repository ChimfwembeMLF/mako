import { Link } from 'react-router-dom';

interface LegalLayoutProps {
  title: string;
  children: React.ReactNode;
}

export function LegalLayout({ title, children }: LegalLayoutProps) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b px-6 py-4 flex items-center justify-between max-w-3xl mx-auto w-full">
        <Link to="/auth" className="font-display font-semibold text-primary hover:underline">
          Tekrem Innvation Solutions Autopilot
        </Link>
        <nav className="flex gap-4 text-sm text-muted-foreground">
          <Link to="/privacy" className="hover:text-foreground">Privacy</Link>
          <Link to="/terms" className="hover:text-foreground">Terms</Link>
          <Link to="/data-deletion" className="hover:text-foreground">Data deletion</Link>
        </nav>
      </header>
      <main className="max-w-3xl mx-auto px-6 py-10 prose prose-neutral dark:prose-invert">
        <h1>{title}</h1>
        {children}
      </main>
    </div>
  );
}
