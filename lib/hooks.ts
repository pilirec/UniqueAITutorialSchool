"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "./client-api";
import type {
  Teacher,
  School,
  Grade,
  ClassRoom,
  Student,
  KnowledgePoint,
} from "./types";

export interface Bootstrap {
  user: Teacher;
  school: School;
  grades: Grade[];
  classes: ClassRoom[];
  teachers: Teacher[];
  students: Student[];
  knowledgePoints: KnowledgePoint[];
}

export function useBootstrap() {
  return useQuery({
    queryKey: ["bootstrap"],
    queryFn: () => api<Bootstrap>("/api/bootstrap"),
  });
}
