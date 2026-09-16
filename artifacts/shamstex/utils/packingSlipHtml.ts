import type { CartItem, Order, Product, ProductUnit } from "@/context/AppContext";
import { companionAmount } from "@/lib/companion";

const UNIT_LABELS: Record<ProductUnit, string> = {
  kilo: "كغ",
  meter: "متر",
};

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatNumber(value: number | undefined): string {
  const number = Number(value);
  if (!Number.isFinite(number)) return "—";
  return number.toLocaleString("en-EG", {
    maximumFractionDigits: 2,
    useGrouping: false,
  });
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("ar-EG", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function unitLabel(unit: ProductUnit | undefined): string {
  return UNIT_LABELS[unit ?? "kilo"];
}

function defaultPieceAmount(quantity: number, unit: ProductUnit | undefined): number {
  return quantity * (unit === "meter" ? 100 : 20);
}

function itemMeasure(item: CartItem, product?: Product): string {
  const unit = product?.unit ?? item.unit ?? "kilo";
  if (item.orderType === "pieces") {
    return `${formatNumber(item.quantity)} ثوب — ${formatNumber(defaultPieceAmount(item.quantity, unit))} ${unitLabel(unit)} (افتراضي)`;
  }

  const amount = item.actualWeight ?? item.weight ?? item.quantity;
  return `${formatNumber(amount)} ${unitLabel(unit)}`;
}

function companionMeasure(companion: NonNullable<CartItem["companions"]>[number]): string {
  if (companion.orderType === "pieces") {
    return `${formatNumber(companion.quantity)} ثوب — ${formatNumber(defaultPieceAmount(companion.quantity, companion.unit))} ${unitLabel(companion.unit)} (افتراضي)`;
  }

  return `${formatNumber(companionAmount(companion))} ${unitLabel(companion.unit)}`;
}

function colorHtml(colorName: string, colorHex: string, className = "color") {
  return `
    <span class="${className}">
      <span class="swatch" style="background:${escapeHtml(colorHex || "#777")}"></span>
      ${escapeHtml(colorName)}
    </span>
  `;
}

export function buildPackingSlipHtml(order: Order, products: Product[]): string {
  const rows = order.items
    .map((item, index) => {
      const product = products.find((candidate) => candidate.id === item.productId);
      const companions = (item.companions ?? [])
        .map(
          (companion) => `
            <div class="companion">
              <span class="companion-name">خامة مرافقة: ${escapeHtml(companion.materialName)}</span>
              ${colorHtml(companion.colorName, companion.colorHex)}
              <span class="measure">${companionMeasure(companion)}</span>
            </div>
          `,
        )
        .join("");

      return `
        <section class="item">
          <div class="item-number">${index + 1}</div>
          <div class="item-content">
            <div class="item-main">
              <div>
                <div class="product-name">${escapeHtml(item.productName)}</div>
                ${colorHtml(item.colorName, item.colorHex)}
              </div>
              <div class="measure">${itemMeasure(item, product)}</div>
              <div class="checkbox" aria-label="تم التجهيز"></div>
            </div>
            ${companions ? `<div class="companions">${companions}</div>` : ""}
          </div>
        </section>
      `;
    })
    .join("");

  return `<!doctype html>
<html lang="ar" dir="rtl">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>ورقة تجهيز الطلب #${escapeHtml(order.id.slice(0, 12))}</title>
    <style>
      @page { size: A4; margin: 13mm; }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        color: #171717;
        background: #fff;
        font-family: Arial, Tahoma, sans-serif;
        direction: rtl;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      .page { width: 100%; }
      .brand {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 18px;
        padding-bottom: 14px;
        border-bottom: 3px solid #b09245;
      }
      .title { margin: 0; font-size: 25px; font-weight: 800; }
      .subtitle { margin-top: 5px; color: #6d6045; font-size: 12px; }
      .meta {
        min-width: 220px;
        display: grid;
        grid-template-columns: auto 1fr;
        gap: 5px 12px;
        font-size: 13px;
      }
      .meta-label { color: #756b5a; }
      .meta-value { font-weight: 700; }
      .items { margin-top: 20px; }
      .item {
        display: flex;
        gap: 12px;
        break-inside: avoid;
        padding: 13px 0;
        border-bottom: 1px solid #ded8ca;
      }
      .item-number {
        flex: 0 0 30px;
        width: 30px;
        height: 30px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #fff;
        background: #b09245;
        font-size: 15px;
        font-weight: 800;
      }
      .item-content { flex: 1; min-width: 0; }
      .item-main {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto 26px;
        align-items: center;
        gap: 14px;
      }
      .product-name { font-size: 17px; font-weight: 800; }
      .color, .companion {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        color: #625a4e;
        font-size: 13px;
      }
      .color { margin-top: 5px; }
      .swatch {
        display: inline-block;
        width: 13px;
        height: 13px;
        border-radius: 50%;
        border: 1px solid #aaa;
      }
      .measure {
        white-space: nowrap;
        font-size: 16px;
        font-weight: 800;
      }
      .checkbox {
        width: 22px;
        height: 22px;
        border: 2px solid #555;
        border-radius: 3px;
      }
      .companions {
        margin-top: 12px;
        padding: 9px 12px;
        border-right: 3px solid #d3c29a;
        background: #faf8f1;
      }
      .companion {
        display: flex;
        gap: 14px;
        padding: 4px 0;
        border-bottom: 1px dashed #ddd5c3;
      }
      .companion:last-child { border-bottom: 0; }
      .companion-name { flex: 1; font-weight: 700; }
      .footer {
        margin-top: 22px;
        padding-top: 10px;
        border-top: 1px solid #ded8ca;
        color: #756b5a;
        font-size: 11px;
        text-align: center;
      }
      @media print {
        .item { page-break-inside: avoid; }
      }
    </style>
  </head>
  <body>
    <main class="page">
      <header class="brand">
        <div>
          <h1 class="title">ورقة تجهيز الطلب</h1>
          <div class="subtitle">Shams Tex — مفردات التجهيز فقط</div>
        </div>
        <div class="meta">
          <span class="meta-label">رقم الطلب</span>
          <span class="meta-value">#${escapeHtml(order.id.slice(0, 12))}</span>
          <span class="meta-label">اسم العميل</span>
          <span class="meta-value">${escapeHtml(order.userName)}</span>
          <span class="meta-label">التاريخ</span>
          <span class="meta-value">${escapeHtml(formatDate(order.createdAt))}</span>
        </div>
      </header>
      <div class="items">${rows || '<p>لا توجد مفردات في هذا الطلب.</p>'}</div>
      <footer class="footer">تُستخدم هذه الورقة لتجهيز الطلب فقط — لا تتضمن الأسعار أو بيانات الدفع</footer>
    </main>
  </body>
</html>`;
}