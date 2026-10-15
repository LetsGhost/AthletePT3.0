import type {
  CreatePlanRequest,
  MyPlanResponse,
  Plan,
  PlanListResponse,
  PlanTemplate,
  PlanTemplateListResponse,
  PlanVersion,
  PlanVersionListResponse,
  UpdatePlanRequest,
} from "@athletept/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/lib/api";

export const planKeys = {
  all: ["plans"] as const,
  list: (athleteId: string) => [...planKeys.all, "list", athleteId] as const,
  detail: (athleteId: string, planId: string) =>
    [...planKeys.all, "detail", athleteId, planId] as const,
  versions: (athleteId: string, planId: string) =>
    [...planKeys.all, "versions", athleteId, planId] as const,
  version: (athleteId: string, planId: string, revision: number) =>
    [...planKeys.versions(athleteId, planId), revision] as const,
  mine: () => [...planKeys.all, "mine"] as const,
};

export const templateKeys = {
  all: ["plan-templates"] as const,
  list: () => [...templateKeys.all, "list"] as const,
  detail: (id: string) => [...templateKeys.all, "detail", id] as const,
};

const plansPath = (athleteId: string) => `/athletes/${athleteId}/plans`;

export function usePlans(athleteId: string) {
  return useQuery({
    queryKey: planKeys.list(athleteId),
    queryFn: () => api<PlanListResponse>(plansPath(athleteId)),
  });
}

export function usePlan(athleteId: string, planId: string) {
  return useQuery({
    queryKey: planKeys.detail(athleteId, planId),
    queryFn: () => api<Plan>(`${plansPath(athleteId)}/${planId}`),
  });
}

export function usePlanVersions(athleteId: string, planId: string, enabled = true) {
  return useQuery({
    queryKey: planKeys.versions(athleteId, planId),
    queryFn: () => api<PlanVersionListResponse>(`${plansPath(athleteId)}/${planId}/versions`),
    enabled,
  });
}

export function usePlanVersion(athleteId: string, planId: string, revision: number | null) {
  return useQuery({
    queryKey: planKeys.version(athleteId, planId, revision ?? -1),
    queryFn: () => api<PlanVersion>(`${plansPath(athleteId)}/${planId}/versions/${revision}`),
    enabled: revision !== null,
  });
}

/** Nach jeder Änderung: Detail direkt setzen, Liste und Versionen neu laden. */
function usePlanMutation<TVariables>(
  athleteId: string,
  request: (variables: TVariables) => Promise<Plan>,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: request,
    onSuccess: (plan) => {
      queryClient.setQueryData(planKeys.detail(plan.athleteId, plan.id), plan);
      void queryClient.invalidateQueries({ queryKey: planKeys.list(plan.athleteId) });
      void queryClient.invalidateQueries({ queryKey: planKeys.versions(plan.athleteId, plan.id) });
      // Beim Aktivieren wird ein anderer Plan archiviert.
      void queryClient.invalidateQueries({
        queryKey: [...planKeys.all, "detail", athleteId],
        predicate: (query) => query.queryKey[3] !== plan.id,
      });
    },
  });
}

/** Ziel-Athlet als Variable, damit sich auch für andere Athleten anlegen lässt (Duplizieren). */
export function useCreatePlan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ athleteId, ...body }: CreatePlanRequest & { athleteId: string }) =>
      api<Plan>(plansPath(athleteId), { method: "POST", body }),
    onSuccess: (plan) => {
      queryClient.setQueryData(planKeys.detail(plan.athleteId, plan.id), plan);
      void queryClient.invalidateQueries({ queryKey: planKeys.list(plan.athleteId) });
    },
  });
}

export function useUpdatePlan(athleteId: string, planId: string) {
  return usePlanMutation(athleteId, (body: UpdatePlanRequest) =>
    api<Plan>(`${plansPath(athleteId)}/${planId}`, { method: "PUT", body }),
  );
}

export function useActivatePlan(athleteId: string, planId: string) {
  return usePlanMutation(athleteId, () =>
    api<Plan>(`${plansPath(athleteId)}/${planId}/activate`, { method: "POST" }),
  );
}

export function useArchivePlan(athleteId: string, planId: string) {
  return usePlanMutation(athleteId, () =>
    api<Plan>(`${plansPath(athleteId)}/${planId}/archive`, { method: "POST" }),
  );
}

export function useDeletePlan(athleteId: string, planId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api<void>(`${plansPath(athleteId)}/${planId}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: planKeys.detail(athleteId, planId) });
      void queryClient.invalidateQueries({ queryKey: planKeys.list(athleteId) });
    },
  });
}

/** Aktiver Plan des angemeldeten Athleten. */
export function useMyPlan() {
  return useQuery({
    queryKey: planKeys.mine(),
    queryFn: () => api<MyPlanResponse>("/me/plan"),
  });
}

export function useTemplates() {
  return useQuery({
    queryKey: templateKeys.list(),
    queryFn: () => api<PlanTemplateListResponse>("/plan-templates"),
  });
}

export function useTemplate(id: string) {
  return useQuery({
    queryKey: templateKeys.detail(id),
    queryFn: () => api<PlanTemplate>(`/plan-templates/${id}`),
  });
}

function useTemplateMutation<TVariables>(
  request: (variables: TVariables) => Promise<PlanTemplate>,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: request,
    onSuccess: (template) => {
      queryClient.setQueryData(templateKeys.detail(template.id), template);
      void queryClient.invalidateQueries({ queryKey: templateKeys.list() });
    },
  });
}

export function useCreateTemplate() {
  return useTemplateMutation((body: CreatePlanRequest) =>
    api<PlanTemplate>("/plan-templates", { method: "POST", body }),
  );
}

export function useUpdateTemplate(id: string) {
  return useTemplateMutation((body: UpdatePlanRequest) =>
    api<PlanTemplate>(`/plan-templates/${id}`, { method: "PUT", body }),
  );
}

export function useDeleteTemplate(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api<void>(`/plan-templates/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: templateKeys.detail(id) });
      void queryClient.invalidateQueries({ queryKey: templateKeys.list() });
    },
  });
}
