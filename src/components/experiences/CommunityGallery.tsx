'use client';

import * as React from 'react';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy, limit } from 'firebase/firestore';
import { ImageIcon, Users, Maximize2, Loader2, Star, Calendar } from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

interface CommunityGalleryProps {
  experienceId: string;
}

export function CommunityGallery({ experienceId }: CommunityGalleryProps) {
  const db = useFirestore();
  const [selectedImage, setSelectedImage] = React.useState<any>(null);

  const galleryQuery = useMemoFirebase(() => {
    if (!db || !experienceId) return null;
    return query(
      collection(db, "experience_reviews"),
      where("experienceId", "==", experienceId),
      orderBy("createdAt", "desc"),
      limit(20)
    );
  }, [db, experienceId]);

  const { data: reviews, loading } = useCollection<any>(galleryQuery);

  const allPhotos = React.useMemo(() => {
    if (!reviews) return [];
    const photos: any[] = [];
    reviews.forEach(review => {
      review.photos?.forEach((url: string) => {
        photos.push({
          url,
          author: review.userName,
          date: review.createdAt,
          rating: review.generalRating,
          reviewId: review.id
        });
      });
    });
    return photos;
  }, [reviews]);

  if (loading || allPhotos.length === 0) return null;

  return (
    <section className="py-20 space-y-12">
      <div className="container mx-auto max-w-6xl px-4 flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-1">
           <h2 className="text-3xl md:text-5xl font-black uppercase italic tracking-tighter text-primary">Fotos da Comunidade</h2>
           <p className="text-muted-foreground font-medium uppercase text-[10px] tracking-widest flex items-center gap-2">
              <Users className="w-4 h-4 text-secondary" /> O que os outros membros viveram aqui
           </p>
        </div>
      </div>

      <div className="container mx-auto max-w-6xl px-4">
        <div className="columns-2 md:columns-4 gap-6 space-y-6">
           {allPhotos.map((photo, i) => (
             <div 
              key={i} 
              className="relative rounded-[2rem] overflow-hidden group cursor-pointer shadow-lg hover:shadow-2xl transition-all"
              onClick={() => setSelectedImage(photo)}
             >
                <img src={photo.url} className="w-full object-cover transition-transform duration-700 group-hover:scale-110" alt="Community" />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                   <Maximize2 className="text-white w-8 h-8" />
                </div>
                <div className="absolute bottom-4 left-4 right-4 flex justify-between items-center opacity-0 group-hover:opacity-100 transition-opacity">
                   <span className="text-[8px] font-black text-white uppercase tracking-widest drop-shadow-md">Por: {photo.author}</span>
                   <div className="flex gap-0.5 bg-white/20 backdrop-blur-md p-1 rounded-lg">
                      <Star className="w-2.5 h-2.5 fill-orange-400 text-orange-400" />
                      <span className="text-[8px] font-black text-white">{photo.rating}</span>
                   </div>
                </div>
             </div>
           ))}
        </div>
      </div>

      <Dialog open={!!selectedImage} onOpenChange={() => setSelectedImage(null)}>
        <DialogContent className="max-w-[95vw] h-[90vh] p-0 bg-transparent border-none">
           {selectedImage && (
             <div className="w-full h-full flex flex-col items-center justify-center p-4">
                <div className="relative max-w-5xl w-full h-full bg-black/40 backdrop-blur-3xl rounded-[3rem] overflow-hidden flex flex-col shadow-2xl">
                   <div className="flex-1 relative">
                      <img src={selectedImage.url} className="w-full h-full object-contain" alt="" />
                   </div>
                   <div className="p-8 md:p-12 bg-white flex flex-col md:flex-row justify-between items-center gap-6">
                      <div className="flex items-center gap-4">
                         <div className="p-4 bg-muted rounded-2xl text-secondary"><Users className="w-8 h-8" /></div>
                         <div>
                            <p className="text-[10px] font-black uppercase text-muted-foreground opacity-60">Foto por</p>
                            <p className="text-xl font-black uppercase italic text-primary">{selectedImage.author}</p>
                         </div>
                      </div>
                      <div className="flex items-center gap-8">
                         <div className="text-center">
                            <p className="text-[10px] font-black uppercase text-muted-foreground opacity-60">Data</p>
                            <div className="flex items-center gap-2 text-sm font-bold"><Calendar className="w-4 h-4" /> {new Date(selectedImage.date?.seconds * 1000 || selectedImage.date).toLocaleDateString('pt-BR')}</div>
                         </div>
                         <div className="text-center">
                            <p className="text-[10px] font-black uppercase text-muted-foreground opacity-60">Nota</p>
                            <div className="flex items-center gap-1.5 text-sm font-black text-orange-400"><Star className="fill-current w-4 h-4" /> {selectedImage.rating}.0</div>
                         </div>
                      </div>
                   </div>
                </div>
             </div>
           )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
