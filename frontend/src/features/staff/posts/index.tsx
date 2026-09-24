import { ArrowLeftIcon, PencilIcon, PlusIcon } from 'lucide-react';
import { Link, Navigate } from 'react-router-dom';
import { useUnitPosts } from '../hooks/useUnitPosts';
import PostDialog from '../components/PostDialog';
import PostStatusButton from '../components/PostStatusButton';
import { useAuth } from '@/hooks/useAuth';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

/**
 * Postos de serviço (FR-022a): os lugares onde os policiais são escalados a
 * cada turno. Só `WARDEN` cria, renomeia e desativa (a API responde 403 aos
 * demais); os outros perfis são redirecionados para a tela de Efetivo, onde o
 * Supervisor apenas escala os policiais nos postos já cadastrados.
 */
export default function PostsPage(): JSX.Element {
  const { user } = useAuth();
  const { unitId, setUnitId, units, posts, isLoadingPosts } = useUnitPosts({
    includeInactive: true,
  });

  if (user?.role !== 'WARDEN') {
    return <Navigate to="/efetivo" replace />;
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-end gap-4 rounded-lg border border-border bg-card p-4">
        <div className="grid min-w-[200px] flex-1 gap-1.5">
          <Label>Unidade</Label>
          <Select
            value={unitId ? String(unitId) : ''}
            onValueChange={(value) => setUnitId(Number(value))}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione a unidade" />
            </SelectTrigger>
            <SelectContent>
              {units.map((unit) => (
                <SelectItem key={unit.id} value={String(unit.id)}>
                  {unit.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Button asChild variant="secondary">
            <Link to="/efetivo">
              <ArrowLeftIcon />
              Voltar para Efetivo
            </Link>
          </Button>
          {unitId !== null && (
            <PostDialog unitId={unitId}>
              <Button>
                <PlusIcon />
                Novo posto
              </Button>
            </PostDialog>
          )}
        </div>
      </div>

      <p className="text-sm text-muted-foreground">
        Postos são os lugares onde os policiais ficam em cada turno: uma galeria, um posto que cobre
        mais de uma galeria (ex.: A/B), pórtico, garita, Infopen. Só a Chefia/Diretor cadastra,
        altera e desativa os postos; o Supervisor apenas escala os policiais neles.
      </p>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Posto</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoadingPosts &&
                [0, 1, 2].map((rowIndex) => (
                  <TableRow key={rowIndex}>
                    <TableCell colSpan={3}>
                      <Skeleton className="h-8 w-full" />
                    </TableCell>
                  </TableRow>
                ))}
              {!isLoadingPosts &&
                posts.map((post) => (
                  <TableRow key={post.id}>
                    <TableCell className="font-medium">{post.name}</TableCell>
                    <TableCell>
                      <Badge variant={post.active ? 'success' : 'secondary'}>
                        {post.active ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-center gap-1">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span>
                              <PostDialog unitId={post.unitId} post={post}>
                                <Button type="button" variant="outline" size="icon">
                                  <PencilIcon className="size-3.5" />
                                  <span className="sr-only">Editar</span>
                                </Button>
                              </PostDialog>
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>Editar</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span>
                              <PostStatusButton post={post} />
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>{post.active ? 'Desativar' : 'Reativar'}</TooltipContent>
                        </Tooltip>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              {!isLoadingPosts && posts.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground">
                    Nenhum posto cadastrado nesta unidade. Use "Novo posto" para começar.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
