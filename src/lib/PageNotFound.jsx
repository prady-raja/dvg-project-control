import { Link, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';

/** Rendered inside the app layout, so the menu stays available. */
export default function PageNotFound() {
  const location = useLocation();
  const pageName = location.pathname.substring(1);

  return (
    <div className="mx-auto mt-16 max-w-md text-center">
      <p className="text-6xl font-light text-muted-foreground/50">404</p>
      <h1 className="mt-3 font-display text-xl font-semibold">Page not found</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        There is no page called <span className="font-medium text-foreground">"{pageName}"</span> in DVG Project Control.
      </p>
      <Button asChild variant="outline" size="sm" className="mt-6">
        <Link to="/">Go to the home screen</Link>
      </Button>
    </div>
  );
}
