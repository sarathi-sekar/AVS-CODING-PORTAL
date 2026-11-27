import { Link } from 'react-router-dom';
export default function NotFound() {
  return (
    <div className="flex flex-col items-center py-20 text-center">
      <p className="text-5xl font-bold text-brand-ink">404</p>
      <p className="mt-2 text-sm text-muted">This page does not exist.</p>
      <Link to="/" className="btn-primary mt-5">Go to dashboard</Link>
    </div>
  );
}
