'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { clientRequestId } from '@/lib/client-id';

/**
 * Cart state.
 *
 * Lives in localStorage, scoped per store so two shops open in two tabs never
 * share a basket. Every accessor is wrapped in try/catch: private browsing and
 * blocked site data make localStorage throw, and a shopper must still be able
 * to buy — the cart simply does not survive a reload.
 *
 * Prices here are display-only. The server re-resolves every line at checkout,
 * so a tampered localStorage entry changes nothing about what is charged.
 */

export interface CartLine {
  productId: string;
  variantId: string | null;
  name: string;
  variantTitle: string | null;
  slug: string;
  price: number;
  imageUrl: string | null;
  quantity: number;
}

interface CartValue {
  lines: CartLine[];
  sessionId: string;
  add: (line: Omit<CartLine, 'quantity'>, quantity?: number) => void;
  setQuantity: (productId: string, variantId: string | null, quantity: number) => void;
  remove: (productId: string, variantId: string | null) => void;
  clear: () => void;
  subtotal: number;
  count: number;
  hydrated: boolean;
}

const CartContext = createContext<CartValue | null>(null);

const MAX_QUANTITY = 99;

function storageKey(storeSlug: string): string {
  return `akd-cart-${storeSlug}`;
}

function sessionKey(storeSlug: string): string {
  return `akd-session-${storeSlug}`;
}

export function CartProvider({
  storeSlug,
  children,
}: {
  storeSlug: string;
  children: ReactNode;
}) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [sessionId, setSessionId] = useState('');
  const [hydrated, setHydrated] = useState(false);

  // Hydration happens in an effect, not during render: reading localStorage on
  // the server is impossible, and reading it during the first client render
  // would produce a hydration mismatch.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey(storeSlug));
      if (raw) {
        const parsed: unknown = JSON.parse(raw);
        if (Array.isArray(parsed)) setLines(parsed as CartLine[]);
      }
    } catch {
      // Storage unavailable — start with an empty cart.
    }

    try {
      const existing = sessionStorage.getItem(sessionKey(storeSlug));
      const id = existing ?? clientRequestId();
      if (!existing) sessionStorage.setItem(sessionKey(storeSlug), id);
      setSessionId(id);
    } catch {
      setSessionId(clientRequestId());
    }

    setHydrated(true);
  }, [storeSlug]);

  const persist = useCallback(
    (next: CartLine[]) => {
      setLines(next);
      try {
        localStorage.setItem(storageKey(storeSlug), JSON.stringify(next));
      } catch {
        // The cart still works for this page view; it just will not survive a
        // reload. Failing the add-to-cart would be worse.
      }
    },
    [storeSlug],
  );

  const sameLine = (line: CartLine, productId: string, variantId: string | null) =>
    line.productId === productId && (line.variantId ?? null) === variantId;

  const add = useCallback(
    (line: Omit<CartLine, 'quantity'>, quantity = 1) => {
      const existing = lines.find((entry) => sameLine(entry, line.productId, line.variantId));

      if (existing) {
        persist(
          lines.map((entry) =>
            sameLine(entry, line.productId, line.variantId)
              ? { ...entry, quantity: Math.min(MAX_QUANTITY, entry.quantity + quantity) }
              : entry,
          ),
        );
        return;
      }

      persist([...lines, { ...line, quantity: Math.min(MAX_QUANTITY, quantity) }]);
    },
    [lines, persist],
  );

  const setQuantity = useCallback(
    (productId: string, variantId: string | null, quantity: number) => {
      if (quantity <= 0) {
        persist(lines.filter((entry) => !sameLine(entry, productId, variantId)));
        return;
      }
      persist(
        lines.map((entry) =>
          sameLine(entry, productId, variantId)
            ? { ...entry, quantity: Math.min(MAX_QUANTITY, quantity) }
            : entry,
        ),
      );
    },
    [lines, persist],
  );

  const remove = useCallback(
    (productId: string, variantId: string | null) => {
      persist(lines.filter((entry) => !sameLine(entry, productId, variantId)));
    },
    [lines, persist],
  );

  const clear = useCallback(() => {
    persist([]);
  }, [persist]);

  const value = useMemo<CartValue>(
    () => ({
      lines,
      sessionId,
      add,
      setQuantity,
      remove,
      clear,
      subtotal: lines.reduce((sum, line) => sum + line.price * line.quantity, 0),
      count: lines.reduce((sum, line) => sum + line.quantity, 0),
      hydrated,
    }),
    [lines, sessionId, add, setQuantity, remove, clear, hydrated],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartValue {
  const value = useContext(CartContext);
  if (!value) throw new Error('useCart must be used inside a CartProvider.');
  return value;
}
