import type {
  CreateExerciseRequest,
  Exercise,
  ExerciseListQuery,
  ExerciseListResponse,
  UpdateExerciseRequest,
} from "@athletept/shared";
import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import { api } from "@/lib/api";

export type ExerciseFilters = Omit<ExerciseListQuery, "page" | "pageSize">;

export const exerciseKeys = {
  all: ["exercises"] as const,
  list: (filters: ExerciseFilters) => [...exerciseKeys.all, "list", filters] as const,
  search: (filters: ExerciseFilters) => [...exerciseKeys.all, "search", filters] as const,
};

function listPath(query: ExerciseListQuery) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== "") params.set(key, String(value));
  }
  return `/exercises?${params.toString()}`;
}

const PAGE_SIZE = 30;

/** Katalog seitenweise („Mehr laden“). */
export function useExerciseCatalog(filters: ExerciseFilters) {
  return useInfiniteQuery({
    queryKey: exerciseKeys.list(filters),
    queryFn: ({ pageParam }) =>
      api<ExerciseListResponse>(listPath({ ...filters, page: pageParam, pageSize: PAGE_SIZE })),
    initialPageParam: 1,
    getNextPageParam: (last, pages) =>
      pages.length * PAGE_SIZE < last.total ? pages.length + 1 : undefined,
    placeholderData: keepPreviousData,
  });
}

/** Wenige beste Treffer, z. B. für die Autovervollständigung. */
export function useExerciseSearch(
  filters: ExerciseFilters,
  { enabled = true, limit = 8 }: { enabled?: boolean; limit?: number } = {},
) {
  return useQuery({
    queryKey: [...exerciseKeys.search(filters), limit],
    queryFn: () => api<ExerciseListResponse>(listPath({ ...filters, pageSize: limit })),
    enabled,
    placeholderData: keepPreviousData,
  });
}

function useExerciseMutation<TVariables>(request: (variables: TVariables) => Promise<Exercise>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: request,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: exerciseKeys.all }),
  });
}

export function useCreateExercise() {
  return useExerciseMutation((body: CreateExerciseRequest) =>
    api<Exercise>("/exercises", { method: "POST", body }),
  );
}

export function useUpdateExercise() {
  return useExerciseMutation(({ id, ...body }: UpdateExerciseRequest & { id: string }) =>
    api<Exercise>(`/exercises/${encodeURIComponent(id)}`, { method: "PATCH", body }),
  );
}

export function useArchiveExercise() {
  return useExerciseMutation((id: string) =>
    api<Exercise>(`/exercises/${encodeURIComponent(id)}/archive`, { method: "POST" }),
  );
}

export function useRestoreExercise() {
  return useExerciseMutation((id: string) =>
    api<Exercise>(`/exercises/${encodeURIComponent(id)}/restore`, { method: "POST" }),
  );
}
