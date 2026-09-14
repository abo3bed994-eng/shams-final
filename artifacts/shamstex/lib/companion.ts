import type { CartItem, CompanionSelection, ProductUnit } from "@/context/AppContext";

export const companionPerBolt = (unit?: ProductUnit): number => (unit === "meter" ? 100 : 20);

export function baseOrderAmount(item: Pick<CartItem, "orderType" | "unit" | "quantity" | "weight" | "actualWeight">): number {
  if (item.orderType === "weight") return item.weight ?? 0;
  return item.actualWeight ?? item.quantity * companionPerBolt(item.unit);
}

export function companionAmount(selection: CompanionSelection): number {
  if (selection.manualWeight && selection.actualWeight != null) return selection.actualWeight;
  if (selection.orderType === "weight") return selection.weight ?? 0;
  return selection.actualWeight ?? selection.quantity * companionPerBolt(selection.unit);
}

export function companionLineTotal(selection: CompanionSelection): number {
  return companionAmount(selection) * selection.unitPrice;
}

export function companionTotal(item: Pick<CartItem, "companions">): number {
  return (item.companions ?? []).reduce((sum, selection) => sum + companionLineTotal(selection), 0);
}

export function recalculateCompanions(item: CartItem): CompanionSelection[] | undefined {
  if (!item.companions?.length) return item.companions;
  const base = baseOrderAmount(item);
  return item.companions.map((selection) => {
    if (selection.manualWeight && selection.actualWeight != null) {
      return { ...selection, quantity: 1, weight: undefined };
    }
    const amount = Math.max(0, base * selection.percentage / 100);
    return selection.orderType === "weight"
      ? { ...selection, quantity: 1, weight: amount, actualWeight: undefined }
      : { ...selection, quantity: 1, weight: undefined, actualWeight: amount };
  });
}

export function withRecalculatedCompanions(item: CartItem): CartItem {
  const companions = recalculateCompanions(item);
  return companions === item.companions ? item : { ...item, companions };
}