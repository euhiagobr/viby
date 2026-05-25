
'use client';

import * as React from 'react';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, limit, where } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  ListOrdered, 
  Loader2, 
  Search, 
  Ticket, 
  Megaphone, 
  ArrowUpRight, 
  ArrowDownRight,
  FilterX,
  Calendar,
  CreditCard,
  Building2,
  Users,
  Download,
  Receipt
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/financial-utils';
import { cn } from "@/lib/utils";
import * as XLSX from 'xlsx';

export default function AdminLedgerPage() {
  const db = useFirestore();
  const [search, setSearch] = React.useState("");

  const ticketsQuery = useMemoFirebase(() => db ? query(collection(db, "tax_tickets"), orderBy("timestamp", "desc")) : null, [db]);
  const adsQuery = useMemoFirebase(() => db ? query(collection(db, "tax_ads")) : null, [db]);

  const { data: tickets, loading: loadingTickets } = useCollection<any>(ticketsQuery);
  const { data: ads, loading: loadingAds } = useCollection<any>(adsQuery);

  const allEntries = React.useMemo(() => {
    const list: any[] = [];
    
    if (tickets) {
      tickets.forEach(t => {
        list.push({
          id: t.id,
          type: 'ticket',
          title: t.eventTitle,
          subtitle: `Comprador: ${t.buyerName}`,
          org: t.orgName,
          date: t.timestamp,
          gross: t.totalFacePrice + (t.buyerFeeAmount || 0),
          vibyNet: t.vibyNetProfit,
          stripe: t.stripeFeeAmount,
          tax: t.taxAmount,
          payout: t.payoutToProducer,
          status: t.nfStatus || 'pendente'
        });
      });
    }

    if (ads) {
      ads.forEach(ad => {
        list.push({
          id: ad.id,
          type: 'ad',
          title: ad.adTitle,
          subtitle: `Anunciante: ${ad.advertiserName}`,
          org: ad.advertiserName,
          date: ad.createdAt || ad.startDate,
          gross: ad.grossValue,
          vibyNet: ad.netValue,
          stripe: 0,
          tax: ad.taxValue,
          payout: 0,
          status: ad.nfStatus || 'pendente'
        });
      });
    }

    return list.sort((a, b) => {
      const tA = a.date?.toDate ? a.date.toDate().getTime() : new Date(a.date).getTime();
      const tB = b.date?.toDate ? b.date.toDate().getTime() : new Date(b.date).getTime();
      return tB - tA;
    });
  }, [tickets, ads]);

  const filteredEntries = React.useMemo(() => {
    return allEntries.filter(e => 
      e.title?.toLowerCase().includes(search.toLowerCase()) || 
      e.org?.toLowerCase().includes(search.toLowerCase()) ||
      e.subtitle?.toLowerCase().includes(search.toLowerCase())
    );
  }, [allEntries, search]);

  const handleExport = () => {
    const data = filteredEntries.map(e => ({
      ID: e.id,
      Data: e.date?.toDate ? e.date.toDate().toLocaleString() : new Date(e.date).toLocaleString(),
      Tipo: e.type,
      Titulo: e.title,
      Organizacao: e.org,
      Bruto: e.gross,
      TaxaStripe: e.stripe,
      Imposto: e.tax,
      LucroViby: e.vibyNet,
      Repasse: e.payout,
      Status: e.status
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Lançamentos");
    XLSX.writeFile(wb, `viby_erp_entries_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  return (
    <div className="space-y-8 pb-20">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-black tracking-tight uppercase italic text-primary flex items-center gap-3">
            <ListOrdered className="w-8 h-8 text-secondary" /> Livro de Lançamentos
          </h1>
          <p className="text-muted-foreground font-medium">Visão detalhada de cada entrada financeira da plataforma.</p>
        </div>
        <Button onClick={handleExport} variant="outline" className="rounded-full h-11 px-6 font-bold uppercase text-[10px] gap-2 border-secondary text-secondary">
          <Download className="w-4 h-4" /> Exportar Planilha
        </Button>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input 
          placeholder="Buscar por evento, marca ou cliente..." 
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10 h-12 rounded-xl"
        />
      </div>

      <Card className="border-none shadow-sm rounded-[2rem] overflow-hidden bg-white">
        <Table>
          <TableHeader className="bg-muted/30">
            <TableRow>
              <TableHead className="font-black uppercase text-[9px] tracking-widest p-6">Data / Origem</TableHead>
              <TableHead className="font-black uppercase text-[9px] tracking-widest">Tipo</TableHead>
              <TableHead className="font-black uppercase text-[9px] tracking-widest text-right">Bruto Pago</TableHead>
              <TableHead className="font-black uppercase text-[9px] tracking-widest text-right">Gateway / Taxas</TableHead>
              <TableHead className="font-black uppercase text-[9px] tracking-widest text-right">Lucro Viby (Líq)</TableHead>
              <TableHead className="font-black uppercase text-[9px] tracking-widest text-right">Repasse Produtor</TableHead>
              <TableHead className="text-center font-black uppercase text-[9px] tracking-widest p-6">NF</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loadingTickets || loadingAds ? (
              <TableRow><TableCell colSpan={7} className="py-20 text-center"><Loader2 className="animate-spin mx-auto text-secondary" /></TableCell></TableRow>
            ) : filteredEntries.length > 0 ? (
              filteredEntries.map((e) => (
                <TableRow key={e.id} className="hover:bg-muted/10 transition-colors">
                  <TableCell className="p-6">
                    <div className="flex flex-col">
                       <span className="text-[10px] font-bold text-muted-foreground mb-1">
                         {e.date?.toDate ? e.date.toDate().toLocaleString('pt-BR') : new Date(e.date).toLocaleString('pt-BR')}
                       </span>
                       <span className="font-black text-sm uppercase italic text-primary truncate max-w-[200px]">{e.title}</span>
                       <span className="text-[9px] font-bold text-muted-foreground uppercase">{e.subtitle}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={cn(
                      "text-[9px] font-black uppercase gap-1.5 h-6 px-2",
                      e.type === 'ticket' ? "border-blue-200 text-blue-600 bg-blue-50" : "border-orange-200 text-orange-600 bg-orange-50"
                    )}>
                      {e.type === 'ticket' ? <Ticket className="w-3 h-3" /> : <Megaphone className="w-3 h-3" />}
                      {e.type === 'ticket' ? 'Ingresso' : 'Anúncio'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-black text-sm">
                    {formatCurrency(e.gross)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex flex-col text-[9px] font-bold text-red-500 uppercase">
                       <span>Stripe: -{formatCurrency(e.stripe)}</span>
                       <span>Imposto: -{formatCurrency(e.tax)}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-black text-sm text-green-600">
                    {formatCurrency(e.vibyNet)}
                  </TableCell>
                  <TableCell className="text-right font-black text-xs text-primary">
                    {e.payout > 0 ? formatCurrency(e.payout) : '---'}
                  </TableCell>
                  <TableCell className="p-6 text-center">
                    <Badge className={cn(
                      "text-[8px] font-black uppercase h-5",
                      e.status === 'emitida' ? "bg-green-500" : "bg-orange-500"
                    )}>
                      {e.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow><TableCell colSpan={7} className="py-32 text-center opacity-30 italic">Nenhum lançamento localizado.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
