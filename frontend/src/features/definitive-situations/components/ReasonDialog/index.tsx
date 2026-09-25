import type { ReactNode } from 'react';
import { CalendarIcon, MapPinIcon, UserRoundCheckIcon } from 'lucide-react';
import { SITUATION_BADGE } from '../../labels';
import type { DefinitiveSituation } from '../../types';
import InmateHeaderCard from '../../../movements/components/InmateHeaderCard';
import { formatDateTime } from '../../../reports/format';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

function Detail({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }): JSX.Element {
  return (
    <div className="flex items-start gap-2.5 rounded-md border border-border bg-muted/30 p-3">
      <span className="mt-0.5 text-muted-foreground">{icon}</span>
      <div className="grid min-w-0 gap-0.5">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
        <span className="break-words text-sm font-medium">{children}</span>
      </div>
    </div>
  );
}

/**
 * Motivo completo de uma situação definitiva. A tabela mostra o motivo em uma
 * linha só (para não quebrar o alinhamento); aqui ele aparece inteiro, com
 * quebra de linha preservada e rolagem se for muito longo.
 */
export default function ReasonDialog({
  situation,
  children,
}: {
  situation: DefinitiveSituation;
  children: ReactNode;
}): JSX.Element {
  const badge = SITUATION_BADGE[situation.status];

  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Motivo do registro</DialogTitle>
          <DialogDescription className="sr-only">
            Detalhes completos da situação definitiva de {situation.inmateName}.
          </DialogDescription>
        </DialogHeader>

        <InmateHeaderCard name={situation.inmateName} registrationId={situation.registrationId} />

        <div className="grid gap-3 sm:grid-cols-2">
          <Detail icon={<CalendarIcon className="size-4" />} label="Registrada em">
            {formatDateTime(situation.registeredAt)}
          </Detail>
          <Detail icon={<UserRoundCheckIcon className="size-4" />} label="Registrada por">
            {situation.registeredByName}
          </Detail>
          <Detail icon={<MapPinIcon className="size-4" />} label="Última cela">
            Galeria {situation.galleryCode}, cela {situation.cellCode}
          </Detail>
          <div className="flex items-start gap-2.5 rounded-md border border-border bg-muted/30 p-3">
            <div className="grid gap-1">
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Situação</span>
              <Badge variant={badge?.variant ?? 'secondary'} className="w-fit whitespace-nowrap">
                {badge?.label ?? situation.situation}
              </Badge>
            </div>
          </div>
        </div>

        <div className="grid gap-1.5">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Motivo</span>
          <div className="max-h-64 overflow-y-auto whitespace-pre-wrap break-words rounded-lg border border-border bg-card p-4 text-sm leading-relaxed">
            {situation.reason?.trim() ? situation.reason : 'Nenhum motivo informado.'}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
