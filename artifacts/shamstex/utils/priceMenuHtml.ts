import type { Product, PriceMenuSettings } from "@/context/AppContext";
import { displayPriceFor } from "@/lib/pricing";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function orderedProducts(products: Product[], menu?: PriceMenuSettings): Product[] {
  const order = menu?.productOrder ?? [];
  const rank = new Map(order.map((id, index) => [id, index]));
  return [...products].sort((a, b) => {
    const aRank = rank.get(a.id) ?? Number.MAX_SAFE_INTEGER;
    const bRank = rank.get(b.id) ?? Number.MAX_SAFE_INTEGER;
    return aRank - bRank || a.name.localeCompare(b.name, "ar");
  });
}

export function buildPriceMenuHtml(
  products: Product[],
  menu?: PriceMenuSettings,
  priceMode: "wholesale" | "retail" = "wholesale"
): string {
  const ordered = orderedProducts(products, menu);
  const categories = menu?.categories ?? [];
  const categoryRank = new Map(categories.map((name, index) => [name, index]));
  const grouped = new Map<string, Product[]>();

  for (const product of ordered) {
    const category = menu?.productCategories?.[product.id] || product.category || "خامات";
    const list = grouped.get(category);
    if (list) list.push(product);
    else grouped.set(category, [product]);
  }

  const groups = [...grouped.entries()].sort(([a], [b]) => {
    const aRank = categoryRank.get(a) ?? Number.MAX_SAFE_INTEGER;
    const bRank = categoryRank.get(b) ?? Number.MAX_SAFE_INTEGER;
    return aRank - bRank || a.localeCompare(b, "ar");
  });
  const background = menu?.backgroundImageUri
    ? `background-image:linear-gradient(rgba(255,255,255,${Math.max(0, Math.min(1, 1 - (menu.backgroundOpacity ?? 0.12)))}),rgba(255,255,255,${Math.max(0, Math.min(1, 1 - (menu.backgroundOpacity ?? 0.12)))})),url('${escapeHtml(menu.backgroundImageUri)}');background-size:cover;background-position:center;`
    : "";

  const sections = groups
    .map(([category, items]) => {
      const rows = items
        .map((product) => {
          const trend =
            product.priceTrend === "up"
              ? '<span class="up">↑</span>'
              : product.priceTrend === "down"
                ? '<span class="down">↓</span>'
                : "";
          const newBadge = product.priceMenuNew ? '<span class="new">NEW</span>' : "";
          return `<div class="row"><div class="name">${escapeHtml(product.name)} ${newBadge}</div><div class="price">${displayPriceFor(product, priceMode)} ج.م ${trend}</div></div>`;
        })
        .join("");
      return `<section><h2>${escapeHtml(category)}</h2>${rows}</section>`;
    })
    .join("");

  return `<!doctype html>
<html lang="ar" dir="rtl">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  *{box-sizing:border-box}body{margin:0;padding:28px;background:#faf8f2;color:#24211b;font-family:Arial,sans-serif;${background}}
  .page{max-width:760px;margin:0 auto;background:rgba(255,255,255,.9);padding:24px;border-radius:20px}
  h1{text-align:center;margin:0 0 6px;color:#8c6d14;font-size:30px} .sub{text-align:center;color:#777;margin:0 0 24px}
  section{margin:18px 0 24px} h2{font-size:19px;color:#8c6d14;border-bottom:2px solid #d9bd65;padding-bottom:8px;margin:0 0 4px}
  .row{display:flex;flex-direction:row;justify-content:space-between;gap:16px;padding:12px 4px;border-bottom:1px solid #e8e2d6}
  .name{font-weight:700}.price{font-weight:700;color:#8c6d14;white-space:nowrap}.up{color:#1b9b55;font-size:22px}.down{color:#d94b45;font-size:22px}
  .new{display:inline-block;background:#8c6d14;color:#fff;border-radius:5px;padding:2px 5px;font-size:9px;vertical-align:middle}
</style></head>
  <body><div class="page"><h1>قائمة أسعار شمس تكس</h1><p class="sub">${priceMode === "wholesale" ? "أسعار التجار" : "أسعار العملاء"}</p>${sections || '<p style="text-align:center;color:#777">لا توجد خامات مضافة</p>'}</div></body></html>`;
}