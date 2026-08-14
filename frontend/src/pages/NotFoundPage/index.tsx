import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

/**
 * Catch-all for unknown routes (tasks.md T034j-404page). Standalone — not
 * nested inside AppShell/ProtectedRoute — since an unauthenticated visitor
 * hitting a bad URL should still see this instead of a blind redirect; the
 * "Início" link below still bounces them to /login via ProtectedRoute if
 * they aren't authenticated.
 */
export default function NotFoundPage(): JSX.Element {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-muted p-6 text-center">
      <span className="text-[11rem] font-bold leading-none tracking-tight text-muted-foreground">
        404
      </span>
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">Página não encontrada</h1>
        <p className="max-w-md text-muted-foreground">
          O endereço acessado não existe. Verifique o endereço ou entre em contato com o
          administrador do sistema.
        </p>
      </div>
      <Button asChild>
        <Link to="/inicio">Voltar para o Início</Link>
      </Button>
    </div>
  );
}
