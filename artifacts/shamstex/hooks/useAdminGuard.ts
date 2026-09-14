import { useEffect } from "react";
import { router } from "expo-router";
import { useApp, EmployeePermission } from "@/context/AppContext";

export function useAdminGuard(requiredPermission?: EmployeePermission): boolean {
  const { user } = useApp();

  const isAdmin = user?.role === "admin";
  const isStaff = user?.role === "employee" || user?.role === "supervisor";
  const hasPermission = !requiredPermission || (user?.permissions ?? []).includes(requiredPermission);
  const authorized = !!user && (isAdmin || (isStaff && hasPermission));

  useEffect(() => {
    if (!user) {
      router.replace("/auth/login");
    } else if (!authorized) {
      router.replace("/(tabs)");
    }
  }, [user, authorized]);

  return authorized;
}
