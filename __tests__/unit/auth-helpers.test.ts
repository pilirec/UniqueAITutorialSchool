import { describe, it, expect } from "vitest";
import { canManageOrg, type Teacher } from "@/lib/auth";

describe("auth helpers", () => {
  it("canManageOrg 应返回正确权限", () => {
    const principal: Teacher = {
      id: "T1",
      schoolId: "S1",
      name: "校长",
      role: "principal",
      classIds: [],
    };
    const teacher: Teacher = {
      id: "T2",
      schoolId: "S1",
      name: "老师",
      role: "teacher",
      classIds: ["C1"],
    };
    expect(canManageOrg(principal)).toBe(true);
    expect(canManageOrg(teacher)).toBe(false);
  });
});
