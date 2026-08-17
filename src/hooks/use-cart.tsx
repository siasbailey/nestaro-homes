import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

export interface CartItem {
  productId: number;
  productName: string;
  slug: string;
  price: number;
  size: string;
  bedrooms: number;
  bathrooms: number;
  image: string;
  quantity: number;
}

interface CartContextType {
  items: CartItem[];
  addItem: (item: Omit<CartItem, "quantity">) => void;
  removeItem: (productId: number) => void;
  updateQuantity: (productId: number, quantity: number) => void;
  clearCart: () => void;
  totalItems: number;
  totalPrice: number;
}

const CartContext = createContext<CartContextType | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("flexhavens-cart");
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch {
          return [];
        }
      }
    }
    return [];
  });

  const addItem = useCallback(
    (item: Omit<CartItem, "quantity">) => {
      setItems((prev) => {
        const existing = prev.find((i) => i.productId === item.productId);
        let newItems: CartItem[];
        if (existing) {
          newItems = prev.map((i) =>
            i.productId === item.productId
              ? { ...i, quantity: i.quantity + 1 }
              : i
          );
        } else {
          newItems = [...prev, { ...item, quantity: 1 }];
        }
        localStorage.setItem("flexhavens-cart", JSON.stringify(newItems));
        return newItems;
      });
    },
    []
  );

  const removeItem = useCallback(
    (productId: number) => {
      setItems((prev) => {
        const newItems = prev.filter((i) => i.productId !== productId);
        localStorage.setItem("flexhavens-cart", JSON.stringify(newItems));
        return newItems;
      });
    },
    []
  );

  const updateQuantity = useCallback(
    (productId: number, quantity: number) => {
      if (quantity <= 0) {
        removeItem(productId);
        return;
      }
      setItems((prev) => {
        const newItems = prev.map((i) =>
          i.productId === productId ? { ...i, quantity } : i
        );
        localStorage.setItem("flexhavens-cart", JSON.stringify(newItems));
        return newItems;
      });
    },
    [removeItem]
  );

  const clearCart = useCallback(() => {
    setItems([]);
    localStorage.removeItem("flexhavens-cart");
  }, []);

  const totalItems = items.reduce((sum, i) => sum + i.quantity, 0);
  const totalPrice = items.reduce((sum, i) => sum + i.price * i.quantity, 0);

  return (
    <CartContext.Provider
      value={{ items, addItem, removeItem, updateQuantity, clearCart, totalItems, totalPrice }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart must be used within CartProvider");
  return context;
}
