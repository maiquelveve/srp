import { forwardRef, useState, type ComponentProps } from 'react';
import { EyeIcon, EyeOffIcon } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export type PasswordInputProps = Omit<ComponentProps<typeof Input>, 'type'>;

/**
 * Campo de senha com alternância de mostrar/ocultar (FR-018) — usado no
 * login e na troca de senha. Mesmo padrão de ícone sobreposto de
 * `features/definitive-situations/index.tsx` (`relative` + ícone
 * `absolute`), mas com o ícone clicável em vez de só decorativo.
 *
 * `forwardRef` é obrigatório aqui: o login usa `react-hook-form`
 * (`{...register('password')}`), que inclui um `ref` para o próprio DOM do
 * input. Sem repassar esse `ref` pro `<Input>` de dentro, o React descarta
 * silenciosamente a prop (componente de função não aceita `ref` direto) e o
 * RHF nunca lê o valor digitado — no submit o campo chega como `undefined`
 * e o zod falha com a mensagem padrão em inglês ("Required") em vez da
 * mensagem customizada ('Senha obrigatória'), mesmo com o campo preenchido.
 */
const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ className, ...props }, ref) => {
    const [passwordVisible, setPasswordVisible] = useState(false);

    return (
      <div className="relative">
        <Input
          ref={ref}
          type={passwordVisible ? 'text' : 'password'}
          className={cn('pr-10', className)}
          {...props}
        />
        <button
          type="button"
          onClick={() => setPasswordVisible((currentlyVisible) => !currentlyVisible)}
          className="absolute right-0 top-0 flex h-10 w-10 items-center justify-center text-muted-foreground hover:text-foreground"
        >
          {passwordVisible ? <EyeOffIcon className="size-4" /> : <EyeIcon className="size-4" />}
          <span className="sr-only">{passwordVisible ? 'Ocultar senha' : 'Mostrar senha'}</span>
        </button>
      </div>
    );
  },
);
PasswordInput.displayName = 'PasswordInput';

export default PasswordInput;
