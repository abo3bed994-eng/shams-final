import type { Product } from "@/context/AppContext";

type OfferFields = Pick<Product, "offerPrice" | "retailPrice">;

// A product is "on offer" when it has a positive offer price strictly below its
// regular retail price. Offers only ever apply to the retail (customer) price —
// never to wholesale.
export function isOnOffer(p: OfferFields): boolean {
  return p.offerPrice != null && p.offerPrice > 0 && p.offerPrice < p.retailPrice;
}

// The retail price a customer actually pays: the offer price when on offer,
// otherwise the regular retail price.
export function effectiveRetailPrice(p: OfferFields): number {
  return isOnOffer(p) ? (p.offerPrice as number) : p.retailPrice;
}

// The price to display / charge for the given pricing mode. Wholesale ignores
// offers; retail honours them.
export function displayPriceFor(p: Product, mode: "wholesale" | "retail"): number {
  return mode === "wholesale" ? p.wholesalePrice : effectiveRetailPrice(p);
}

// The whole-number discount percentage off the retail price when on offer.
// Returns 0 when there is no active offer. No decimal places (rounded).
export function discountPercent(p: OfferFields): number {
  if (!isOnOffer(p) || p.retailPrice <= 0) return 0;
  return Math.round(((p.retailPrice - (p.offerPrice as number)) / p.retailPrice) * 100);
}
