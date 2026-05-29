
'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

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
  price: number; // Base price
  quantity: number;
  requiresProof: boolean;
  sectorId?: string;
  sectorName?: string;
  seatId?: string;
  seatCode?: string;
  ageRating?: string;
}

interface CartContextType {
  items: CartItem[];
  addItem: (item: CartItem) => void;
  removeItem: (cartItemId: string) => void;
  updateQuantity: (cartItemId: string, quantity: number) => void;
  clearCart: () => void;
  totalCount: number;
  expiresAt: number | null;
}

const CartContext = createContext<CartContextType>({
  items: [],
  addItem: () => {},
  removeItem: () => {},
  updateQuantity: () => {},
  clearCart: () => {},
  totalCount: 0,
  expiresAt: null,
});

const CART_EXPIRATION_TIME = 10 * 60 * 1000; // 10 minutos em milissegundos

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [expiresAt, setExpiresAt] = useState<number | null>(null);

  // Load from localStorage
  useEffect(() => {
    const savedItems = localStorage.getItem('viby_cart');
    const savedExpiry = localStorage.getItem('viby_cart_expiry');
    
    if (savedItems) {
      try {
        const parsedItems = JSON.parse(savedItems);
        setItems(parsedItems);
        
        if (savedExpiry && parsedItems.length > 0) {
          const expiry = parseInt(savedExpiry);
          if (Date.now() > expiry) {
            setItems([]);
            setExpiresAt(null);
            localStorage.removeItem('viby_cart');
            localStorage.removeItem('viby_cart_expiry');
          } else {
            setExpiresAt(expiry);
          }
        }
      } catch (e) {
        console.error("Erro ao carregar carrinho", e);
      }
    }
  }, []);

  // Monitor de Expiração
  useEffect(() => {
    if (items.length === 0) {
      setExpiresAt(null);
      localStorage.removeItem('viby_cart_expiry');
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

  // Save to localStorage
  useEffect(() => {
    localStorage.setItem('viby_cart', JSON.stringify(items));
    if (expiresAt) {
      localStorage.setItem('viby_cart_expiry', expiresAt.toString());
    }
  }, [items, expiresAt]);

  const resetTimer = () => {
    const newExpiry = Date.now() + CART_EXPIRATION_TIME;
    setExpiresAt(newExpiry);
  };

  const addItem = (item: CartItem) => {
    resetTimer();
    setItems(prev => {
      const existing = prev.find(i => i.id === item.id);
      if (existing) {
        return prev.map(i => i.id === item.id ? { ...i, quantity: i.quantity + item.quantity } : i);
      }
      return [...prev, item];
    });
  };

  const removeItem = (id: string) => {
    setItems(prev => {
      const newList = prev.filter(i => i.id !== id);
      if (newList.length === 0) {
        setExpiresAt(null);
        localStorage.removeItem('viby_cart_expiry');
      }
      return newList;
    });
  };

  const updateQuantity = (id: string, quantity: number) => {
    if (quantity <= 0) {
      removeItem(id);
      return;
    }
    resetTimer();
    setItems(prev => prev.map(i => i.id === id ? { ...i, quantity } : i));
  };

  const clearCart = () => {
    setItems([]);
    setExpiresAt(null);
    localStorage.removeItem('viby_cart_expiry');
  };

  const totalCount = items.reduce((acc, i) => acc + i.quantity, 0);

  return (
    <CartContext.Provider value={{ items, addItem, removeItem, updateQuantity, clearCart, totalCount, expiresAt }}>
      {children}
    </CartContext.Provider>
  );
}

export const useCart = () => useContext(CartContext);
