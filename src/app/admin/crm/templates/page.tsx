
'use client';

import * as React from 'react';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Layout, 
  Plus, 
  Search, 
  Loader2, 
  FileText, 
  ChevronRight, 
  Inbox,
  MoreHorizontal
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function CrmTemplatesPage() {
  const db = useFirestore();
  const [search, setSearch] = React.useState("");

  const templatesQuery = useMemoFirebase(() => 
    db ? query(collection(db, "crm_templates"), orderBy("createdAt", "desc")) : null, 
    [db]
  );
  const { data: templates, loading } = useCollection<any>(templatesQuery);

  const filtered = templates?.filter(t => t.name?.toLowerCase().includes(search.toLowerCase())) || [];

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Buscar template..." 
            value={search} 
            onChange={e => setSearch(e.target.value)} 
            className="pl-10 h-11 rounded-xl" 
          />
        </div>
        <Button className="bg-secondary text-white font-black rounded-full px-8 h-11 shadow-lg gap-2 uppercase italic">
          <Plus className="w-5 h-5" /> Novo Template
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          <div className="col-span-full py-20 flex justify-center"><Loader2 className="animate-spin text-secondary" /></div>
        ) : filtered.length > 0 ? (
          filtered.map(t => (
            <Card key={t.id} className="border-none shadow-sm rounded-[1.5rem] bg-white hover:shadow-md transition-all group overflow-hidden">
              <CardHeader className="bg-muted/30 border-b p-6">
                <div className="flex justify-between items-start">
                   <div className="p-2.5 bg-secondary/10 rounded-xl text-secondary">
                      <FileText className="w-5 h-5" />
                   </div>
                   <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                         <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full"><MoreHorizontal className="w-4 h-4" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="rounded-xl">
                         <DropdownMenuItem>Editar</DropdownMenuItem>
                         <DropdownMenuItem>Duplicar</DropdownMenuItem>
                         <DropdownMenuItem className="text-destructive">Excluir</DropdownMenuItem>
                      </DropdownMenuContent>
                   </DropdownMenu>
                </div>
                <div className="mt-4 space-y-1">
                   <CardTitle className="text-lg font-black uppercase italic tracking-tighter text-primary line-clamp-1">{t.name}</CardTitle>
                   <Badge variant="outline" className="text-[7px] font-black uppercase h-4 px-1.5">{t.category || 'Geral'}</Badge>
                </div>
              </CardHeader>
              <CardContent className="p-6">
                 <p className="text-xs text-muted-foreground line-clamp-2 min-h-[32px]">{t.description || "Sem descrição definida."}</p>
                 <Button variant="ghost" className="w-full mt-4 h-10 rounded-xl font-bold uppercase text-[9px] tracking-widest gap-2 group-hover:bg-secondary group-hover:text-white transition-all">
                    Visualizar Template <ChevronRight className="w-3.5 h-3.5" />
                 </Button>
              </CardContent>
            </Card>
          ))
        ) : (
          <div className="col-span-full py-32 text-center bg-white rounded-[3rem] border-2 border-dashed opacity-30 italic flex flex-col items-center gap-4">
             <Inbox className="w-12 h-12" />
             <p className="text-xs font-black uppercase tracking-widest">Nenhum template cadastrado</p>
          </div>
        )}
      </div>
    </div>
  );
}
