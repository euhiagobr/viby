
'use client';

import * as React from 'react';
import Image from 'next/image';
import { useFirestore, useCollection, useDoc, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, doc } from 'firebase/firestore';
import { Badge } from '@/components/ui/badge';
import { Utensils, Loader2, AlertTriangle, Star, User, ShoppingBasket } from 'lucide-react';
import { cn, safeParseDate } from "@/lib/utils";

// --- TIPOS E INTERFACES ---
interface MenuItemType {
  id: string;
  nome: string;
  descricao: string;
  valor: number;
  priceDisplayMode?: 'value' | 'consult' | 'hidden';
  imageUrl?: string;
  featured?: boolean;
  serves?: string;
  porcao?: string;
  valorPromocional?: number;
  promocional?: boolean;
  promoInicio?: any;
  promoFim?: any;
  alergenicos?: string[];
  sectionId: string;
  ordem: number;
}

interface MenuSectionType { id: string; nome: string; ordem: number; }
interface OrganizationType { menuLayout?: 'lista' | 'grid'; logoUrl?: string; }
interface PublicMenuProps { orgId: string; }

// --- LÓGICA AUXILIAR ---
const isPromoActive = (item: MenuItemType) => {
  if (!item.promocional || !item.valorPromocional) return false;
  const now = new Date();
  const start = safeParseDate(item.promoInicio);
  const end = safeParseDate(item.promoFim);
  if (start && now < start) return false;
  if (end && now > end) return false;
  return true;
};

const getPriceSymbols = (value: number) => {
  if (value <= 50) return '$';
  if (value <= 100) return '$$';
  if (value <= 200) return '$$$';
  if (value <= 400) return '$$$$';
  return '$$$$$';
};

// --- COMPONENTES DE UI ---

const FeaturedBadge = () => (
  <Badge className="absolute top-2 right-2 bg-yellow-400 text-gray-900 font-semibold text-xs border-2 border-white shadow-lg z-10">
    <Star className="w-3 h-3 mr-1.5" />
    Especial da Casa
  </Badge>
);

const PriceDisplay = ({ item }: { item: MenuItemType }) => {
  const displayMode = item.priceDisplayMode || 'value';

  if (displayMode === 'consult') {
    return <span className="font-semibold text-gray-700">Sob consulta</span>;
  }

  if (displayMode === 'hidden') {
    return <span className="font-bold text-2xl text-gray-400 tracking-wider">{getPriceSymbols(item.valor)}</span>;
  }
  
  const isPromo = isPromoActive(item);
  const formatPrice = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  return (
    <div className="text-right">
      {isPromo && item.valorPromocional ? (
        <div className="flex flex-col items-end">
          <span className="font-bold text-blue-600 text-xl">{formatPrice(item.valorPromocional)}</span>
          <span className="text-sm font-medium text-gray-400 line-through">{formatPrice(item.valor)}</span>
        </div>
      ) : (
        <span className="font-bold text-blue-600 text-xl">{formatPrice(item.valor)}</span>
      )}
    </div>
  );
};

const InfoTags = ({ item }: { item: MenuItemType }) => {
  const tags = [
    item.serves && { icon: User, text: `Serve ${item.serves.replace(/[^0-9]/g, '')}` }, // Pega apenas o número
    item.porcao && { icon: ShoppingBasket, text: item.porcao },
  ].filter(Boolean);

  if (tags.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-3">
      {tags.map((tag: any, index) => (
        <div key={index} className="flex items-center gap-1.5 text-xs text-gray-600 font-medium bg-gray-100 px-2 py-1 rounded-full">
          <tag.icon className="w-3.5 h-3.5" />
          <span>{tag.text}</span>
        </div>
      ))}
    </div>
  );
};

const MenuItemCard = ({ item, logoUrl }: { item: MenuItemType, logoUrl?: string }) => {
  const imageUrl = item.imageUrl || logoUrl;

  return (
    <div className="bg-white border border-gray-100 rounded-xl overflow-hidden flex flex-col h-full hover:shadow-lg transition-all duration-300 group">
      {imageUrl && (
        <div className="relative w-full aspect-w-16 aspect-h-9 bg-gray-100">
          <Image src={imageUrl} alt={item.nome} layout="fill" objectFit="cover" />
          {item.featured && <FeaturedBadge />}
        </div>
      )}
      
      <div className="p-4 flex flex-col flex-grow">
        {!imageUrl && item.featured && (
            <Badge className="w-fit bg-yellow-100 text-yellow-800 mb-2"><Star className="w-3 h-3 mr-1" />Especial da Casa</Badge>
        )}
        <h4 className="font-semibold text-gray-800 text-lg flex-grow">{item.nome}</h4>
        <p className="text-sm text-gray-500 mt-1 mb-4">{item.descricao}</p>

        <InfoTags item={item} />

        {item.alergenicos && item.alergenicos.length > 0 && (
            <div className="mt-4">
                <p className='text-xs font-semibold text-gray-500 mb-1.5'>Contém:</p>
                <div className="flex flex-wrap gap-1.5">
                    {item.alergenicos.map(a => <Badge key={a} variant="outline" className="text-xs font-normal bg-gray-50">{a}</Badge>)}
                </div>
            </div>
        )}

        <div className="flex justify-end items-end mt-4 pt-4 border-t border-gray-50 flex-grow">
           <PriceDisplay item={item} />
        </div>
      </div>
    </div>
  );
};

const MenuItemList = ({ item }: { item: MenuItemType }) => {
  return (
    <div className="w-full py-6 flex gap-4 sm:gap-6">
       {item.imageUrl && (
         <div className="relative w-24 h-24 sm:w-32 sm:h-32 rounded-lg overflow-hidden shrink-0 bg-gray-100 shadow-sm">
            <Image src={item.imageUrl} alt={item.nome} layout="fill" objectFit="cover" />
            {item.featured && <FeaturedBadge />}
         </div>
       )}

      <div className="flex-grow">
        <div className="flex justify-between items-start gap-4">
          <div className="flex-grow">
            {!item.imageUrl && item.featured && (
              <Badge className="w-fit bg-yellow-100 text-yellow-800 mb-1"><Star className="w-3 h-3 mr-1" />Especial da Casa</Badge>
            )}
            <h4 className="font-semibold text-gray-800 text-lg">{item.nome}</h4>
            <p className="text-sm text-gray-500 mt-1 pr-4">{item.descricao}</p>
          </div>
          <div className="shrink-0"><PriceDisplay item={item} /></div>
        </div>

        <InfoTags item={item} />
        
        {item.alergenicos && item.alergenicos.length > 0 && (
          <div className="mt-3">
            <p className='text-xs font-semibold text-gray-500 mb-1.5'>Contém:</p>
            <div className="flex flex-wrap gap-1.5">
                {item.alergenicos.map(a => <Badge key={a} variant="outline" className="text-xs font-normal bg-gray-50">{a}</Badge>)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export function PublicMenu({ orgId }: PublicMenuProps) {
  const db = useFirestore();

  const { data: orgData, loading: loadingOrg } = useDoc<OrganizationType>(useMemoFirebase(() => db ? doc(db, 'organizations', orgId) : null, [db, orgId]));
  const { data: sections, loading: loadingSections } = useCollection<MenuSectionType>(useMemoFirebase(() => db ? query(collection(db, 'organizations', orgId, 'menu_sections'), orderBy('ordem', 'asc')) : null, [db, orgId]));
  const { data: items, loading: loadingItems } = useCollection<MenuItemType>(useMemoFirebase(() => db ? query(collection(db, 'organizations', orgId, 'menu_items'), orderBy('ordem', 'asc')) : null, [db, orgId]));

  const menuLayout = orgData?.menuLayout || 'lista';

  if (loadingOrg || loadingSections || loadingItems) {
    return <div className="py-20 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-gray-300" /></div>;
  }

  if (!sections || sections.length === 0 || !items || items.length === 0) {
    return (
      <div className="py-20 text-center rounded-lg border-2 border-dashed flex flex-col items-center gap-4 text-gray-400">
         <Utensils className="w-12 h-12" />
         <h3 className="font-semibold text-gray-700">Cardápio em Construção</h3>
         <p className="text-sm text-gray-500 max-w-xs mx-auto">O organizador está preparando um cardápio incrível. Volte em breve!</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
      <div className="text-center mb-12">
        <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 tracking-tight">Nosso Cardápio</h1>
        <p className="mt-3 max-w-2xl mx-auto text-lg text-gray-500">Descubra os sabores que preparamos para você.</p>
      </div>
      
      {sections.map(section => {
        const sectionItems = items?.filter(item => item.sectionId === section.id) || [];
        if (sectionItems.length === 0) return null;

        return (
          <section key={section.id} className="mb-16">
            <div className="relative text-center mb-10">
                <div className="absolute inset-0 flex items-center" aria-hidden="true"><div class="w-full border-t border-gray-200"></div></div>
                <div className="relative flex justify-center"><span class="bg-white px-4 text-xl font-bold text-gray-700">{section.nome}</span></div>
            </div>

            <div className={cn({
              'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8': menuLayout === 'grid',
              'divide-y divide-gray-100': menuLayout === 'lista'
            })}>
              {sectionItems.map((item: MenuItemType) => (
                menuLayout === 'grid' 
                  ? <MenuItemCard key={item.id} item={item} logoUrl={orgData?.logoUrl} />
                  : <MenuItemList key={item.id} item={item} />
              ))}
            </div>
          </section>
        );
      })}

      <div className="mt-20 p-4 bg-gray-50 rounded-lg flex items-start gap-3">
         <AlertTriangle className="w-5 h-5 text-gray-400 shrink-0 mt-0.5" />
         <div className="text-sm text-gray-600">
            <p className="font-semibold text-gray-700 mb-1">Aviso Legal</p>
            <p>Os preços, promoções e a disponibilidade dos itens podem sofrer alterações sem aviso prévio. Em caso de alergias ou restrições alimentares, por favor, informe nossa equipe. As imagens são meramente ilustrativas.</p>
         </div>
      </div>
    </div>
  );
}
