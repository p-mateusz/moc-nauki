import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";

export interface Role {
  id: string;
  name: string;
  label: string;
  color: string;
  is_builtin: boolean;
  created_at: string;
}

const BUILT_IN_ROLE_DEFAULTS: Record<string, { label: string; color: string; is_builtin: boolean }> = {
  admin: { label: "Admin", color: "#f87171", is_builtin: true },
  uczeń: { label: "Uczeń", color: "#60a5fa", is_builtin: true },
  nauczyciel: { label: "Nauczyciel", color: "#fbbf24", is_builtin: true },
  profesor: { label: "Profesor", color: "#a78bfa", is_builtin: true },
};

const mergeWithBuiltInRoles = (serverRoles: Role[]): Role[] => {
  const map = new Map<string, Role>();
  
  // Add all server roles first (these can be edited versions of built-in roles)
  for (const role of serverRoles) {
    map.set(role.name, {
      ...role,
      is_builtin: BUILT_IN_ROLE_DEFAULTS[role.name]?.is_builtin || false,
      label: role.label || BUILT_IN_ROLE_DEFAULTS[role.name]?.label || role.name,
      color: role.color || BUILT_IN_ROLE_DEFAULTS[role.name]?.color || "#8899b4",
    });
  }
  
  // Then add any missing built-in roles with their defaults
  for (const key of Object.keys(BUILT_IN_ROLE_DEFAULTS)) {
    if (!map.has(key)) {
      const def = BUILT_IN_ROLE_DEFAULTS[key];
      map.set(key, {
        id: key,
        name: key,
        label: def.label,
        color: def.color,
        is_builtin: def.is_builtin,
        created_at: new Date().toISOString(),
      });
    }
  }
  
  return Array.from(map.values());
};

export const useRoles = () => {
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRoles = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error: err } = await supabase
        .from("custom_roles")
        .select("id, name, color, created_at")
        .order("created_at", { ascending: true });

      if (err) throw err;

      const processedData = (data || []).map(role => ({
        ...role,
        label: BUILT_IN_ROLE_DEFAULTS[role.name]?.label || role.name,
        is_builtin: ["uczeń", "admin", "nauczyciel", "profesor"].includes(role.name),
      })) as Role[];
      const filtered = processedData.filter(r => r.name !== 'teacher');
      setRoles(mergeWithBuiltInRoles(filtered));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch roles");
      console.error("Error fetching roles:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRoles();
  }, [fetchRoles]);

  const getRoleLabel = (roleName: string): string => {
    const role = roles.find(r => r.name === roleName);
    return role?.label || BUILT_IN_ROLE_DEFAULTS[roleName]?.label || roleName;
  };

  const getRoleColor = (roleName: string): string => {
    const role = roles.find(r => r.name === roleName);
    return role?.color || BUILT_IN_ROLE_DEFAULTS[roleName]?.color || "#8899b4";
  };

  const getRole = (roleName: string): Role | undefined => {
    return roles.find(r => r.name === roleName);
  };

  return {
    roles,
    loading,
    error,
    refetch: fetchRoles,
    getRoleLabel,
    getRoleColor,
    getRole,
  };
};
