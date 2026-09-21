import logoPpRs from '@/assets/logo-pp-rs.png';

/**
 * "Início" — landing page após o login (tasks.md T034j/T034k). Conteúdo
 * decidido pelo usuário: logo da Polícia Penal RS centralizado com o nome do
 * sistema abaixo — mesmo par logo+nome já usado em `LoginPage`/`AppShell`.
 */
export default function HomePage(): JSX.Element {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6">
      <img src={logoPpRs} alt="Polícia Penal RS" className="w-48 max-w-[60%]" />
      <span className="text-center text-lg font-semibold text-foreground">
        Sistema de Rotinas Penitenciárias
      </span>
    </div>
  );
}
