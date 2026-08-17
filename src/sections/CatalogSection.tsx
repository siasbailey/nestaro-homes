import { useState } from "react";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { useCart } from "@/hooks/use-cart";
import { toast } from "sonner";
import { trpc } from "@/providers/trpc";
import ProductModal from "@/components/ProductModal";

const categories = [
  { key: "all", label: "All Homes" },
  { key: "2br", label: "1–2 Bedroom" },
  { key: "3br", label: "3 Bedroom" },
  { key: "4br", label: "Large Models" },
];

export default function CatalogSection() {
  const [activeCategory, setActiveCategory] = useState("all");
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const { addItem } = useCart();

  const { data: products, isLoading } = trpc.products.list.useQuery(
    activeCategory === "all" ? undefined : { category: activeCategory as any }
  );

  const handleAddToCart = (product: any) => {
    const images = typeof product.images === "string" ? JSON.parse(product.images) : product.images;
    addItem({
      productId: product.id,
      productName: product.name,
      slug: product.slug,
      price: Number(product.price),
      size: product.size,
      bedrooms: product.bedrooms,
      bathrooms: product.bathrooms,
      image: Array.isArray(images) ? images[0] : "/images/home-exterior-1.jpg",
    });
    toast.success(`${product.name} added to cart!`);
  };

  return (
    <>
      <section id="catalog" className="py-24 md:py-32 bg-[#f7f4ee]">
        <div className="max-w-7xl mx-auto px-6 sm:px-12 lg:px-16 xl:px-24">
          {/* Header — asymmetric: title left, description right */}
          <div className="grid lg:grid-cols-12 gap-10 mb-14 md:mb-20">
            <div className="lg:col-span-5">
              <p className="nh-label mb-6">The Collection</p>
              <h2 className="nh-display text-4xl md:text-5xl">Explore our homes</h2>
            </div>
            <div className="lg:col-span-6 lg:col-start-7 flex flex-col justify-end">
              <p className="text-lg text-[#3d5045] leading-relaxed">
                Eight models, from compact studios to family-sized homes — built to order
                with financing available on eligible models.
              </p>
              {/* Filters — quiet text tabs with an underline, not pills */}
              <div className="flex flex-wrap gap-x-8 gap-y-2 mt-8">
                {categories.map((cat) => (
                  <button
                    key={cat.key}
                    onClick={() => setActiveCategory(cat.key)}
                    className={`text-sm tracking-wide pb-1 border-b transition-colors ${
                      activeCategory === cat.key
                        ? "border-[#26342b] text-[#26342b] font-medium"
                        : "border-transparent text-[#9ca3af] hover:text-[#26342b]"
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {isLoading ? (
            <div className="py-24 text-center">
              <div className="animate-spin w-8 h-8 border-2 border-[#26342b] border-t-transparent rounded-full mx-auto"></div>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-16">
              {products?.map((product) => {
                const images = typeof product.images === "string" ? JSON.parse(product.images) : product.images;
                const features = typeof product.features === "string" ? JSON.parse(product.features) : product.features;
                return (
                  <article key={product.id} className="group">
                    {/* Image dominates — consistent 4:3 ratio, quiet zoom on hover */}
                    <button
                      onClick={() => setSelectedProduct(product)}
                      className="block w-full text-left"
                      aria-label={`View ${product.name}`}
                    >
                      <div className="relative aspect-[4/3] overflow-hidden bg-[#f3ede4]">
                        <img
                          src={Array.isArray(images) ? images[0] : "/images/home-exterior-1.jpg"}
                          alt={product.name}
                          className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]"
                        />
                        {product.mortgageEnabled === "yes" && (
                          <span className="absolute bottom-4 left-4 bg-[#f7f4ee]/95 px-3 py-1.5 text-[11px] uppercase tracking-[0.16em] text-[#26342b]">
                            Financing available
                          </span>
                        )}
                      </div>
                    </button>

                    {/* Information — typography and space, no boxes */}
                    <div className="pt-6">
                      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                        <h3 className="font-serif text-2xl text-[#26342b] min-w-0 break-words">{product.name}</h3>
                        <p className="font-serif text-xl text-[#c47a45] whitespace-nowrap shrink-0">
                          ${Number(product.price).toLocaleString()}
                        </p>
                      </div>
                      <p className="text-xs uppercase tracking-[0.18em] text-[#9ca3af] mt-2">
                        {product.bedrooms} BR · {product.bathrooms} BA · {product.size}
                      </p>
                      {Array.isArray(features) && features.length > 0 && (
                        <p className="text-sm text-[#3d5045] mt-3 leading-relaxed">
                          {features.slice(0, 2).join(" · ")}
                        </p>
                      )}
                      <div className="flex items-center gap-6 mt-5">
                        <button
                          onClick={() => setSelectedProduct(product)}
                          className="nh-link text-sm tracking-wide"
                        >
                          View Home
                          <ArrowUpRight className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleAddToCart(product)}
                          className="text-sm tracking-wide text-[#c47a45] hover:text-[#a6632f] font-medium inline-flex items-center gap-1.5"
                        >
                          Add to Cart
                          <ArrowRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* Product Detail Modal */}
      {selectedProduct && (
        <ProductModal
          product={selectedProduct}
          onClose={() => setSelectedProduct(null)}
          onAddToCart={handleAddToCart}
        />
      )}
    </>
  );
}
