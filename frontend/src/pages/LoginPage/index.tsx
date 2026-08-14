import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '@/hooks/useAuth';
import { notify } from '@/lib/notify';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import logoPpRs from '@/assets/logo-pp-rs.png';

const loginSchema = z.object({
  email: z.string().email('E-mail inválido'),
  password: z.string().min(1, 'Senha obrigatória'),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function LoginPage(): JSX.Element {
  const { login } = useAuth();
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({ resolver: zodResolver(loginSchema) });

  async function onSubmit(values: LoginFormValues): Promise<void> {
    try {
      await login(values.email, values.password);
      navigate('/inicio');
    } catch {
      notify({ title: 'Credenciais Inválidas', message: 'E-mail ou senha inválido', type: 'error', size: 'sm', position: 'top-right', duration: 3000 });
    }
  }

  return (
    <div className="flex min-h-svh flex-col items-center justify-center bg-muted p-6 md:p-10">
      <div className="w-full max-w-sm md:max-w-3xl">
        <Card className="overflow-hidden">
          <CardContent className="grid p-0 md:grid-cols-2">
            <form onSubmit={(e) => void handleSubmit(onSubmit)(e)} className="p-6 md:p-8">
              <div className="flex flex-col gap-6">
                <div className="flex flex-col items-center text-center">
                  <h1 className="text-2xl font-bold">Bem-vindo</h1>
                  <p className="text-muted-foreground">Entre na sua conta</p>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="email">E-mail</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="nome@srp.rs.gov.br"
                    {...register('email')}
                  />
                  {errors.email && (
                    <p className="text-sm text-destructive">{errors.email.message}</p>
                  )}
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="password">Senha</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="********"
                    {...register('password')}
                  />
                  {errors.password && (
                    <p className="text-sm text-destructive">{errors.password.message}</p>
                  )}
                </div>

                <Button type="submit" disabled={isSubmitting} className="w-full">
                  {isSubmitting ? 'Entrando...' : 'Entrar'}
                </Button>

                <div className="relative text-center text-sm after:absolute after:inset-0 after:top-1/2 after:z-0 after:flex after:items-center after:border-t after:border-border">
                  <span className="relative z-10 bg-card px-2 text-muted-foreground">
                    Esqueci minha senha
                  </span>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  className="w-full border border-sidebar-foreground/25 bg-sidebar text-sidebar-foreground hover:bg-sidebar/70 hover:text-sidebar-foreground"
                >
                  Recuperar senha
                </Button>
              </div>
            </form>
            <div className="relative hidden flex-col items-center justify-center gap-4 bg-sidebar p-8 md:flex">
              <img src={logoPpRs} alt="Polícia Penal RS" className="w-2/3 max-w-[220px]" />
              <span className="text-center text-sm font-medium text-sidebar-foreground">
                Sistema de Rotinas Penitenciárias
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
