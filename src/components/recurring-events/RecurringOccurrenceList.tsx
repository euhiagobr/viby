'use client';

import * as React from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Clock, Calendar, XCircle, CheckCircle2, Eye } from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';

interface RecurringOccurrenceListProps {
  occurrences: any[];
  onCancel: (id: string) => void;
  loadingId?: string | null;
}

export function RecurringOccurrenceList({ occurrences, onCancel, loadingId }: RecurringOccurrenceListProps) {
  if (occurrences.length === 0) {
    return (
      <div className="p-12 text-center bg-muted/20 rounded-[2rem] border-2 border-dashed">
        <Calendar className="w-12 h-12 mx-auto text-muted-foreground opacity-20 mb-4" />
        <p className="text-sm font-bold text-muted-foreground uppercase">Nenhuma ocorrência gerada para esta série.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-[2rem] border shadow-sm overflow-hidden">
      <Table>
        <TableHeader className="bg-muted/30">
          <TableRow>
            <TableHead className="font-black uppercase text-[10px] p-6">Data</TableHead>
            <TableHead className="font-black uppercase text-[10px]">Horário</TableHead>
            <TableHead className="font-black uppercase text-[10px] text-center">Status</TableHead>
            <TableHead className="text-right font-black uppercase text-[10px] p-6">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {occurrences.map((occ) => (
            <TableRow key={occ.id} className={cn("hover:bg-muted/5", occ.status === 'cancelled' && "opacity-50 grayscale")}>
              <TableCell className="p-6">
                <div className="flex items-center gap-3">
                  <Calendar className="w-4 h-4 text-secondary" />
                  <span className="font-bold text-sm">
                    {new Date(occ.date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
                  </span>
                </div>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                  <Clock className="w-3.5 h-3.5" />
                  {occ.startTime} - {occ.endTime}
                </div>
              </TableCell>
              <TableCell className="text-center">
                <Badge className={cn(
                  "text-[9px] font-black uppercase h-5",
                  occ.status === 'active' ? "bg-green-500" : "bg-red-500"
                )}>
                  {occ.status === 'active' ? "Confirmada" : "Cancelada"}
                </Badge>
              </TableCell>
              <TableCell className="p-6 text-right">
                <div className="flex items-center justify-end gap-2">
                  <Button variant="ghost" size="icon" asChild className="h-8 w-8 text-secondary">
                    <Link href={`/recorrente/${occ.id}`} target="_blank">
                      <Eye className="w-4 h-4" />
                    </Link>
                  </Button>
                  {occ.status === 'active' && (
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8 text-destructive"
                      onClick={() => onCancel(occ.id)}
                      disabled={loadingId === occ.id}
                    >
                      <XCircle className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
