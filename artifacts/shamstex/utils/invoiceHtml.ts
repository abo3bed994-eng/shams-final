import type { Order, AppSettings, PaymentMethod, ProductUnit } from "@/context/AppContext";
import { INVOICE_LOGO_DATA_URI } from "./invoiceLogo";
import { companionAmount, companionLineTotal } from "@/lib/companion";

const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  cash: "كاش عند الاستلام",
  bank_transfer: "تحويل بنكي",
  ewallet: "محفظة إلكترونية",
  instapay: "انستاباي",
};

const STATUS_LABELS: Record<string, string> = {
  scheduled: "مجدول",
  pending: "قيد المراجعة",
  received: "تم الاستلام",
  preparing: "قيد التحضير",
  ready: "جاهز",
  ready_to_ship: "جاهز للشحن",
  shipped: "تم الشحن",
  delivered: "تم التسليم",
  cancelled: "ملغي",
};

const FULFILLMENT_LABELS: Record<string, string> = {
  store: "استلام من المحل",
  branch: "استلام من الفرع",
  shipping: "شحن",
};

const UNIT_LABEL_AR: Record<ProductUnit, string> = {
  kilo: "كجم",
  meter: "متر",
};

function escapeHtml(s: string): string {
  return String(s ?? "")
    .replace(/[\u0660-\u0669\u06F0-\u06F9]/g, (digit) =>
      String(digit.charCodeAt(0) <= 0x0669 ? digit.charCodeAt(0) - 0x0660 : digit.charCodeAt(0) - 0x06F0)
    )
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatDate(iso?: string): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yyyy = d.getFullYear();
    const hh = String(d.getHours()).padStart(2, "0");
    const mn = String(d.getMinutes()).padStart(2, "0");
    return `${dd}/${mm}/${yyyy} — ${hh}:${mn}`;
  } catch {
    return iso;
  }
}

function formatMoney(n: number): string {
  const v = Number(n) || 0;
  return String(v.toLocaleString("en-EG", { maximumFractionDigits: 2, useGrouping: false }))
    .replace(/[\u0660-\u0669\u06F0-\u06F9]/g, (digit) =>
      String(digit.charCodeAt(0) <= 0x0669 ? digit.charCodeAt(0) - 0x0660 : digit.charCodeAt(0) - 0x06F0)
    );
}

export function buildInvoiceHtml(order: Order, settings: AppSettings): string {
  // Always use the latin brand name at the top of the invoice
  const brandLatin = "Shams Tex";
  const businessSubtitle = escapeHtml(settings.aboutTitle || "شمس تكس للأقمشة");
  // Always use the bundled app logo for the invoice header
  const logoUri = INVOICE_LOGO_DATA_URI;

  const phone = "";

  const itemsRows = order.items
    .map((it, idx) => {
      const isWeight = it.orderType === "weight";
      const unitAr = UNIT_LABEL_AR[it.unit ?? "kilo"];
      const perBolt = it.unit === "meter" ? 100 : 20;
      const boltCount = isWeight
        ? Math.floor((it.actualWeight ?? it.weight ?? 0) / perBolt)
        : it.quantity;
      const amount = isWeight
        ? (it.actualWeight ?? it.weight ?? it.quantity)
        : (it.actualWeight ?? it.quantity * perBolt);
      const qtyDisplay = `${boltCount} ثوب — ${formatMoney(amount)} ${unitAr}`;
      const lineTotal = isWeight
        ? (it.actualWeight ?? it.weight ?? 0) * it.unitPrice
        : (it.actualWeight ?? it.quantity * perBolt) * it.unitPrice;
      const companionRows = (it.companions ?? []).map((companion) => `
        <tr class="companion-row">
          <td></td>
          <td>
            <div class="pname">↳ ${escapeHtml(companion.materialName)}</div>
            <div class="pcolor">
              <span class="swatch" style="background:${escapeHtml(companion.colorHex || "#000")}"></span>
              ${escapeHtml(companion.colorName)} · ${formatMoney(companion.percentage)}%
            </div>
          </td>
          <td class="c">${formatMoney(companionAmount(companion))} ${UNIT_LABEL_AR[companion.unit ?? "kilo"]}</td>
          <td class="c">${formatMoney(companion.unitPrice)} ج.م</td>
          <td class="c b">${formatMoney(companionLineTotal(companion))} ج.م</td>
        </tr>`).join("");
      return `
        <tr>
          <td class="c">${idx + 1}</td>
          <td>
            <div class="pname">${escapeHtml(it.productName)}</div>
            <div class="pcolor">
              <span class="swatch" style="background:${escapeHtml(it.colorHex || "#000")}"></span>
              ${escapeHtml(it.colorName)}
            </div>
          </td>
          <td class="c">${qtyDisplay}</td>
          <td class="c">${formatMoney(it.unitPrice)} ج.م</td>
          <td class="c b">${formatMoney(lineTotal)} ج.م</td>
        </tr>
        ${companionRows}`;
    })
    .join("");

  const paymentLabel = order.paymentMethod
    ? escapeHtml(PAYMENT_LABELS[order.paymentMethod] || order.paymentMethod)
    : "غير محدد";
  const statusLabel = escapeHtml(STATUS_LABELS[order.status] || order.status);
  const subtotal = order.total;
  const fee = order.paymentFee ?? 0;
  const grand = order.totalWithFee ?? order.total;

  const fulfillmentType = order.fulfillmentType ?? "store";
  const isShipping = fulfillmentType === "shipping";
  let fulfillmentLabel = FULFILLMENT_LABELS[fulfillmentType] || "استلام من المحل";
  if (fulfillmentType === "branch" && order.branchName) {
    fulfillmentLabel = `استلام من فرع: ${order.branchName}`;
  } else if (isShipping && (order.shippingProviderName || order.shippingProviderId)) {
    fulfillmentLabel = `شحن — ${order.shippingProviderName ?? order.shippingProviderId}`;
  }
  fulfillmentLabel = escapeHtml(fulfillmentLabel);
  const waybillNumber = order.shippingWaybillNumber ? escapeHtml(order.shippingWaybillNumber) : "";
  const shippingAddress = isShipping && order.shippingAddress ? escapeHtml(order.shippingAddress) : "";

  return `<!doctype html>
<html dir="rtl" lang="ar">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Invoice #${escapeHtml(order.id.slice(0, 8))}</title>
<style>
  * { box-sizing: border-box; }
  body {
    font-family: -apple-system, "Segoe UI", "Tahoma", sans-serif;
    color: #1a1a1a;
    background: #fff;
    margin: 0;
    padding: 28px;
    direction: rtl;
  }
  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-bottom: 3px solid #d4a017;
    padding-bottom: 18px;
    margin-bottom: 22px;
  }
  .brand { display: flex; align-items: center; gap: 14px; }
  .brand .logo-box {
    width: 64px; height: 64px; border-radius: 10px;
    background: #111; color: #d4a017;
    display: flex; align-items: center; justify-content: center;
    font-weight: 800; font-size: 22px; letter-spacing: 1px;
    overflow: hidden;
  }
  .brand .logo-box img { width: 100%; height: 100%; object-fit: contain; background: #fff; }
  .brand-name { font-size: 24px; font-weight: 800; color: #000; letter-spacing: 0.5px; direction: ltr; }
  .numeric { direction: ltr; unicode-bidi: isolate; white-space: nowrap; }
  .brand-sub { font-size: 12px; color: #666; margin-top: 2px; }
  .invoice-title { text-align: left; }
  .invoice-title .t { font-size: 28px; font-weight: 800; color: #d4a017; letter-spacing: 1px; }
  .invoice-title .n { font-size: 13px; color: #444; margin-top: 4px; font-family: monospace; }
  .meta {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
    background: #faf7ee;
    border: 1px solid #ecd9a1;
    border-radius: 10px;
    padding: 14px 16px;
    margin-bottom: 18px;
  }
  .meta .row { font-size: 13px; line-height: 1.7; }
  .meta .label { color: #777; font-size: 11px; }
  .meta .val { color: #111; font-weight: 600; }
  .addr-box {
    background: #fff8e7;
    border: 1px solid #e0b73a;
    border-radius: 10px;
    padding: 12px 14px;
    margin-bottom: 18px;
    font-size: 13px;
    line-height: 1.6;
  }
  .addr-box .label { color: #8a4b00; font-size: 11px; font-weight: 700; margin-bottom: 4px; }
  .addr-box .val { color: #111; font-weight: 600; }
  table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 18px;
    font-size: 13px;
  }
  thead th {
    background: #111;
    color: #d4a017;
    padding: 10px 8px;
    text-align: right;
    font-weight: 700;
    font-size: 12px;
    letter-spacing: 0.5px;
  }
  thead th.c { text-align: center; }
  tbody td {
    border-bottom: 1px solid #eee;
    padding: 10px 8px;
    vertical-align: top;
  }
  tbody td.c { text-align: center; }
  tbody td.b { font-weight: 700; color: #000; }
  .pname { font-weight: 600; color: #111; }
  .pcolor {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-top: 4px;
    color: #666;
    font-size: 11px;
  }
  .swatch {
    display: inline-block;
    width: 12px;
    height: 12px;
    border-radius: 50%;
    border: 1px solid #ddd;
  }
  .totals { display: flex; justify-content: flex-start; margin-top: 10px; }
  .totals-box {
    min-width: 280px;
    background: #faf7ee;
    border: 1px solid #ecd9a1;
    border-radius: 10px;
    padding: 14px 18px;
  }
  .totals-row { display: flex; justify-content: space-between; padding: 5px 0; font-size: 13px; }
  .totals-row.grand {
    border-top: 2px solid #d4a017;
    margin-top: 8px;
    padding-top: 10px;
    font-size: 16px;
    font-weight: 800;
    color: #000;
  }
  .notice-box {
    margin-top: 22px;
    padding: 12px 16px;
    background: #fff4e5;
    border: 1px solid #f5a623;
    border-radius: 10px;
    font-size: 13px;
    color: #8a4b00;
    font-weight: 700;
    text-align: center;
    line-height: 1.6;
  }
  .footer {
    margin-top: 22px;
    padding-top: 14px;
    border-top: 1px dashed #ccc;
    text-align: center;
    color: #888;
    font-size: 11px;
    line-height: 1.7;
  }
  .footer .thanks { color: #d4a017; font-weight: 700; font-size: 13px; margin-bottom: 4px; }
</style>
</head>
<body>
  <div class="header">
    <div class="brand">
      <div class="logo-box">
        <img src="${logoUri}" alt="logo" />
      </div>
      <div>
        <div class="brand-name">${brandLatin}</div>
        <div class="brand-sub">${businessSubtitle}${phone ? ` • ${phone}` : ""}</div>
      </div>
    </div>
    <div class="invoice-title">
      <div class="t"></div>
      <div class="n">#${escapeHtml(order.id.slice(0, 8))}</div>
    </div>
  </div>

  <div class="meta">
    <div class="row">
      <div class="label">العميل</div>
      <div class="val">${escapeHtml(order.userName || "—")}</div>
      <div class="label" style="margin-top:6px">رقم الهاتف</div>
      <div class="val">${escapeHtml(order.userPhone || "—")}</div>
      ${shippingAddress ? `<div class="label" style="margin-top:6px">📍 عنوان الشحن</div><div class="val">${shippingAddress}</div>` : ""}
      <div class="label" style="margin-top:6px">طريقة الاستلام</div>
      <div class="val">${fulfillmentLabel}</div>
      ${waybillNumber ? `<div class="label" style="margin-top:6px">رقم بوليصة الشحن</div><div class="val">${waybillNumber}</div>` : ""}
    </div>
    <div class="row">
      <div class="label">تاريخ الطلب</div>
      <div class="val">${formatDate(order.createdAt)}</div>
      <div class="label" style="margin-top:6px">الحالة</div>
      <div class="val">${statusLabel}</div>
      <div class="label" style="margin-top:6px">طريقة الدفع</div>
      <div class="val">${paymentLabel}</div>
    </div>
  </div>


  ${isShipping ? `<div style="margin-bottom:18px;padding:12px 16px;background:#fff4e5;border:1px solid #f5a623;border-radius:10px;font-size:13px;color:#8a4b00;font-weight:700;text-align:center">⚠ السعر غير شامل ثمن الشحن</div>` : ""}

  <table>
    <thead>
      <tr>
        <th class="c" style="width:36px">#</th>
        <th>المنتج</th>
        <th class="c">الكمية</th>
        <th class="c">سعر الوحدة</th>
        <th class="c">الإجمالي</th>
      </tr>
    </thead>
    <tbody>${itemsRows}</tbody>
  </table>

  <div class="totals">
    <div class="totals-box">
      <div class="totals-row">
        <span>المجموع الفرعي</span>
        <span>${formatMoney(subtotal)} ج.م</span>
      </div>
      ${fee > 0 ? `<div class="totals-row"><span>رسوم الدفع</span><span>${formatMoney(fee)} ج.م</span></div>` : ""}
      <div class="totals-row grand">
        <span>الإجمالي</span>
        <span>${formatMoney(grand)} ج.م</span>
      </div>
    </div>
  </div>

  ${order.notes ? `<div style="margin-top:18px;padding:12px 14px;background:#f7f7f7;border-radius:8px;font-size:12px;color:#555"><b>ملاحظات: </b>${escapeHtml(order.notes)}</div>` : ""}

  <div class="notice-box">
    ⚠ لسنا مسؤولين عن القماش بعد القص أو الطباعة
  </div>

  <div class="footer">
    <div class="thanks">شكراً لتعاملكم مع ${brandLatin}</div>
  </div>
</body>
</html>`;
}
