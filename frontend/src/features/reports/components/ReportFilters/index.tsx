import type { ReactNode } from 'react';
import type { ReportHelp } from '../../helpContent';
import ReportHelpDialog from '../ReportHelpDialog';

/** Barra de filtros padrão das abas, com o botão de ajuda sempre no canto direito. */
export default function ReportFilters({
  help,
  children,
}: {
  help: ReportHelp;
  children?: ReactNode;
}): JSX.Element {
  return (
    <div className="flex flex-wrap items-end gap-4 rounded-lg border border-border bg-card p-4">
      {children}
      <div className="ml-auto">
        <ReportHelpDialog help={help} />
      </div>
    </div>
  );
}
