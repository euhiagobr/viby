'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { toast } from '@/hooks/use-toast';
import { ProductType } from '@/lib/financial-utils';

export interface CartItem {
  id: string; // Unique ID for the cart entry (eventId + batchId + typeId + sectorId + seatId)
  eventId: string;
  eventTitle: string;
  eventImage: string;
  eventDate: any;
  eventCity: string;
  organizationId: string;
  organizerId: string;
  organizerUsername: string;
  ticketTypeId: string;
  ticketTypeName: string;
  batchId: string;
  batchName: string;
  poolId?: string;
  poolName?: string;
  price: number; // Current price (may be discounted)
  originalPrice: number; // Price without discount
  currency: string;
  quantity: number;
  requiresProof: boolean;
  sectorId?: string;
  sectorName?: string;
  seatId?: string;
  seatCode?: string;
  ageRating?: string;
  occurrenceId?: string | null;
  couponCode?: string | null;
  discountAmount?: number;
  productType?: ProductType;
}

interface CartContextType {
  items: CartItem[];
  addItem: (item: CartItem) => void;
  addMultipleItems: (items: CartItem[]) => void;
  removeItem: (cartItemId: string) => void;
  updateQuantity: (cartItemId: string, quantity: number) => void;
  clearCart: () => void;
  totalCount: number;
  expiresAt: number | null;
  setItems: (items: CartItem[]) => void;
}

const CartContext = createContext<CartContextType>({
  items: [],
  addItem: () => {},
  addMultipleItems: () => {},
  removeItem: () => {},
  updateQuantity: () => {},
  clearCart: () => {},
  totalCount: 0,
  expiresAt: null,
  setItems: () => {},
});

const CART_EXPIRATION_TIME = 5 * 60 * 1000; // 5 minutos em milissegundos

export function CartProvider({ children }: { children: React.ReactNode }) {
  // Inicialização direta do localStorage para evitar wipe-out no primeiro render
  const [items, setItemsState] = useState<CartItem[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('viby_cart');
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch (e) {
          return [];
        }
      }
    }
    return [];
  });

  const [expiresAt, setExpiresAt] = useState<number | null>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('viby_cart_expiry');
      return saved ? parseInt(saved) : null;
    }
    return null;
  });

  const [isHydrated, setIsHydrated] = useState(false);

  // Monitor de Expiração e Hidratação Inicial
  useEffect(() => {
    setIsHydrated(true);
    
    if (items.length === 0) {
      setExpiresAt(null);
      return;
    }

    const interval = setInterval(() => {
      if (expiresAt && Date.now() > expiresAt) {
        clearCart();
        window.dispatchEvent(new CustomEvent('viby-cart-expired'));
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [items.length, expiresAt]);

  // Persistência
  useEffect(() => {
    if (!isHydrated) return; // Não salva nada antes de confirmar que carregamos o que já existia

    localStorage.setItem('viby_cart', JSON.stringify(items));
    if (expiresAt) {
      localStorage.setItem('viby_cart_expiry', expiresAt.toString());
    } else {
      localStorage.removeItem('viby_cart_expiry');
    }
  }, [items, expiresAt, isHydrated]);

  const resetTimer = () => {
    const newExpiry = Date.now() + CART_EXPIRATION_TIME;
    setExpiresAt(newExpiry);
  };

  const addItem = (item: CartItem) => {
    resetTimer();
    setItemsState(prev => {
      const existing = prev.find(i => i.id === item.id);
      const isFree = item.price === 0;

      if (existing) {
        // REGRA: Ingressos gratuitos não podem exceder 1 unidade no carrinho
        if (isFree) {
          return prev;
        }
        return prev.map(i => i.id === item.id ? { ...i, quantity: i.quantity + item.quantity } : i);
      }
      
      // Garante que ingresso grátis entre com no máximo 1 unidade
      const finalQty = isFree ? 1 : item.quantity;
      return [...prev, { ...item, quantity: finalQty, originalPrice: item.originalPrice || item.price, productType: item.productType || 'event' }];
    });
  };

  const addMultipleItems = (newItems: CartItem[]) => {
    resetTimer();
    setItemsState(prev => {
      let current = [...prev];
      newItems.forEach(item => {
        const idx = current.findIndex(i => i.id === item.id);
        const isFree = item.price === 0;

        if (idx > -1) {
          if (!isFree) {
            current[idx] = { ...current[idx], quantity: current[idx].quantity + item.quantity };
          }
        } else {
          const finalQty = isFree ? 1 : item.quantity;
          current.push({ ...item, quantity: finalQty, originalPrice: item.originalPrice || item.price, productType: item.productType || 'event' });
        }
      });
      return current;
    });
  }

  const removeItem = (id: string) => {
    setItemsState(prev => {
      const newList = prev.filter(i => i.id !== id);
      if (newList.length === 0) {
        setExpiresAt(null);
      }
      return newList;
    });
  };

  const updateQuantity = (id: string, quantity: number) => {
    const item = items.find(i => i.id === id);
    if (!item) return;

    if (item.price === 0 && quantity > 1) {
      toast({ title: "Limite atingido", description: "Apenas 1 unidade permitida para ingressos gratuitos." });
      return;
    }

    if (quantity <= 0) {
      removeItem(id);
      return;
    }
    resetTimer();
    setItemsState(prev => prev.map(i => i.id === id ? { ...i, quantity } : i));
  };

  const clearCart = () => {
    setItemsState([]);
    setExpiresAt(null);
  };

  const totalCount = items.reduce((acc, i) => acc + i.quantity, 0);

  return (
    <CartContext.Provider value={{ items, addItem, addMultipleItems, removeItem, updateQuantity, clearCart, totalCount, expiresAt, setItems: setItemsState }}>
      {children}
    </CartContext.Provider>
  );
}

export const useCart = () => useContext(CartContext);
