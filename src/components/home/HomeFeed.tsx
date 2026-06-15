
'use client';

import * as React from "react";
import { Loader2, Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import { HomeEventsGrid } from "./HomeEventsGrid";
import { type Coordinates } from "@/lib/location-utils";

interface HomeFeedProps {
  feed: any[];
  isInitialLoad: boolean;
  isFetching: boolean;
  hasMore: boolean;
  onFetchMore: () => void;
  userLocation: Coordinates | null;
  onClearFilters: () => void;
}

export function HomeFeed({ 
  feed, 
  isInitialLoad, 
  isFetching, 
  hasMore, 
  onFetchMore, 
  userLocation,
  onClearFilters 
}: HomeFeedProps) {
  if (isInitialLoad) {
    return (
      <div className="py-32 flex flex-col items-center justify-center gap-4">
        <Loader2 className="w-12 h-12 animate-spin text-secondary" />
        <p className="text-[10px] font-black uppercase tracking-widest animate-pulse opacity-40">Sincronizando experiências...</p>
      </div>
    );
  }

  if (feed.length === 0) {
    return (
      <div className="py-32 text-center bg-white rounded-[3rem] border-2 border-dashed border-border flex flex-col items-center gap-4 opacity-40">
         <Inbox className="w-12 h-12" />
         <p className="text-sm font-black uppercase tracking-widest">Nenhum evento localizado para estes filtros.</p>
         <Button variant="link" onClick={onClearFilters} className="font-bold uppercase text-xs">Limpar busca</Button>
      </div>
    );
  }

  return (
    <>
      <HomeEventsGrid feed={feed} userLocation={userLocation} />
      
      {hasMore && (
        <div className="mt-16 flex justify-center">
          <Button 
            variant="outline" 
            onClick={onFetchMore} 
            disabled={isFetching} 
            className="rounded-full px-10 h-12 font-bold uppercase border-secondary text-secondary"
          >
            {isFetching ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Carregar Mais
          </Button>
        </div>
      )}
    </>
  );
}
