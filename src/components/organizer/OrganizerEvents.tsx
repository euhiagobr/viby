
"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EventCard } from "@/components/events/EventCard";
import { Calendar, History, Sparkles, Inbox } from "lucide-react";
import { cn } from "@/lib/utils";

interface OrganizerEventsProps {
  events: any[];
}

export function OrganizerEvents({ events }: OrganizerEventsProps) {
  const now = new Date();
  
  const upcoming = React.useMemo(() => 
    events.filter(e => {
      const end = e.endDate?.toDate ? e.endDate.toDate() : (e.date?.toDate ? new Date(e.date.toDate().getTime() + 4 * 60 * 60 * 1000) : new Date());
      return end >= now;
    }).sort((a, b) => (a.date?.seconds || 0) - (b.date?.seconds || 0)), 
  [events, now]);

  const past = React.useMemo(() => 
    events.filter(e => {
      const end = e.endDate?.toDate ? e.endDate.toDate() : (e.date?.toDate ? new Date(e.date.toDate().getTime() + 4 * 60 * 60 * 1000) : new Date());
      return end < now;
    }).sort((a, b) => (b.date?.seconds || 0) - (a.date?.seconds || 0)), 
  [events, now]);

  return (
    <section className="space-y-8">
      <Tabs defaultValue="upcoming" className="w-full">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 px-2 mb-8">
          <div className="space-y-1">
            <h2 className="text-3xl font-black uppercase italic tracking-tighter text-primary">Experiências</h2>
            <p className="text-muted-foreground font-medium">Garanta seu lugar nos próximos lançamentos.</p>
          </div>
          
          <TabsList className="bg-muted/50 p-1 rounded-2xl h-14 w-full md:w-auto">
            <TabsTrigger value="upcoming" className="flex-1 md:w-48 rounded-xl font-black uppercase text-[10px] tracking-widest gap-2 data-[state=active]:bg-white data-[state=active]:shadow-lg">
              <Calendar className="w-4 h-4" /> Próximos
            </TabsTrigger>
            <TabsTrigger value="past" className="flex-1 md:w-48 rounded-xl font-black uppercase text-[10px] tracking-widest gap-2 data-[state=active]:bg-white data-[state=active]:shadow-lg">
              <History className="w-4 h-4" /> Passados
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="upcoming" className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          {upcoming.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {upcoming.map((event) => (
                <EventCard key={event.id} event={event} />
              ))}
            </div>
          ) : (
            <EmptyEvents message="Nenhum evento futuro anunciado no momento." icon={Sparkles} />
          )}
        </TabsContent>

        <TabsContent value="past" className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          {past.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 opacity-75">
              {past.map((event) => (
                <EventCard key={event.id} event={event} />
              ))}
            </div>
          ) : (
            <EmptyEvents message="Ainda não há registros de eventos passados." icon={History} />
          )}
        </TabsContent>
      </Tabs>
    </section>
  );
}

function EmptyEvents({ message, icon: Icon }: { message: string; icon: any }) {
  return (
    <div className="py-24 text-center bg-white rounded-[3rem] border-2 border-dashed border-border/60 flex flex-col items-center gap-4">
      <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center">
        <Icon className="w-8 h-8 text-muted-foreground opacity-20" />
      </div>
      <p className="text-muted-foreground font-black uppercase tracking-widest text-[10px]">{message}</p>
    </div>
  );
}
