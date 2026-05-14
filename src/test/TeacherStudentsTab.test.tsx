import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// Mock supabase client used in the component
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({ select: () => Promise.resolve({ data: [], error: null }) }),
    functions: { invoke: () => Promise.resolve({ error: null }) },
  },
}));

// Mock useRoles hook to avoid network requests
vi.mock("@/hooks/use-roles", () => ({
  useRoles: () => ({ roles: [], loading: false, getRoleLabel: (r: string) => r, getRoleColor: () => "#60a5fa" }),
}));

// Mock modal to avoid rendering portal
vi.mock("@/components/dashboard/UserProfileModal", () => ({ default: () => null }));

import TeacherStudentsTab from "@/components/dashboard/TeacherStudentsTab";

describe("TeacherStudentsTab — empty state", () => {
  it("renders centered empty message with ts-empty-state class when no user is selected", async () => {
    render(<TeacherStudentsTab mode="teacher" />);

    await waitFor(() => expect(screen.getByText(/Wybierz nauczyciela/)).toBeInTheDocument());

    const node = screen.getByText(/Wybierz nauczyciela/);
    const parent = node.parentElement;
    expect(parent).toBeTruthy();
    expect(parent).toHaveClass("ts-empty-state");
  });
});
