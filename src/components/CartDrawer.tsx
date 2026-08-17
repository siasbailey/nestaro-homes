import { useNavigate } from "react-router";
import { Minus, Plus, Trash2, ShoppingBag, ArrowRight, X } from "lucide-react";
import { useCart } from "@/hooks/use-cart";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

interface CartDrawerProps {
  onClose?: () => void;
}

export default function CartDrawer({ onClose }: CartDrawerProps) {
  const { items, updateQuantity, removeItem, totalPrice, clearCart, totalItems } = useCart();
  const navigate = useNavigate();

  const handleClose = () => {
    onClose?.();
  };

  const handleBrowseCatalog = (e: React.MouseEvent) => {
    e.preventDefault();
    handleClose();
    navigate("/#catalog");
  };

  const handleCheckout = (e: React.MouseEvent) => {
    e.preventDefault();
    handleClose();
    navigate("/checkout");
  };

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center px-4">
        <ShoppingBag className="w-16 h-16 text-gray-300 mb-4" />
        <p className="text-gray-500 text-lg">Your cart is empty</p>
        <p className="text-gray-400 text-sm mt-1">Browse our properties to find your perfect luxury home</p>
        <button
          onClick={handleBrowseCatalog}
          className="mt-4 text-[#26342b] font-medium hover:underline"
        >
          Browse Homes
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header with close button */}
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <h2 className="text-lg font-bold text-[#26342b]">Your Cart ({totalItems})</h2>
        {onClose && (
          <button
            onClick={handleClose}
            className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center transition"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto py-4 px-4 space-y-4">
        {items.map((item) => (
          <div key={item.productId} className="flex gap-3 sm:gap-4 bg-gray-50 p-3 sm:p-4 rounded-xl">
            <img
              src={item.image}
              alt={item.productName}
              className="w-16 h-16 sm:w-20 sm:h-20 object-cover rounded-lg shrink-0"
            />
            <div className="flex-1 min-w-0">
              <h4 className="font-semibold text-[#26342b] truncate">{item.productName}</h4>
              <p className="text-sm text-gray-500">{item.size} | {item.bedrooms}BR/{item.bathrooms}BA</p>
              <p className="font-bold text-[#26342b] mt-1">
                ${item.price.toLocaleString()}
              </p>
              <div className="flex items-center gap-2 mt-2">
                <button
                  type="button"
                  onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                  className="w-7 h-7 rounded-full border border-gray-300 flex items-center justify-center hover:bg-gray-100 transition"
                >
                  <Minus className="w-3 h-3" />
                </button>
                <span className="w-8 text-center font-medium">{item.quantity}</span>
                <button
                  type="button"
                  onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                  className="w-7 h-7 rounded-full border border-gray-300 flex items-center justify-center hover:bg-gray-100 transition"
                >
                  <Plus className="w-3 h-3" />
                </button>
                <button
                  type="button"
                  onClick={() => removeItem(item.productId)}
                  className="ml-auto w-7 h-7 rounded-full bg-red-50 flex items-center justify-center hover:bg-red-100 transition"
                >
                  <Trash2 className="w-3 h-3 text-red-500" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <Separator className="my-4" />

      <div className="space-y-4 px-4 pb-6">
        <div className="flex justify-between items-center">
          <span className="text-gray-600">Subtotal ({totalItems} items)</span>
          <span className="text-xl font-bold text-[#26342b]">${totalPrice.toLocaleString()}</span>
        </div>

        <button
          onClick={handleBrowseCatalog}
          className="block w-full"
        >
          <Button
            variant="outline"
            className="w-full border-[#26342b] text-[#26342b] hover:bg-[#26342b] hover:text-white"
          >
            Continue Shopping
          </Button>
        </button>

        <button
          onClick={handleCheckout}
          className="block w-full"
        >
          <Button
            className="w-full bg-[#26342b] transition"
          >
            Proceed to Checkout
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </button>

        <button
          type="button"
          onClick={clearCart}
          className="w-full text-center text-sm text-red-500 hover:text-red-700 transition py-2"
        >
          Clear Cart
        </button>
      </div>
    </div>
  );
}