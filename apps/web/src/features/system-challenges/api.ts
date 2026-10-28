import type {
  CreateSystemTemplateRequest,
  SystemTemplate,
  SystemTemplateListResponse,
  UpdateSystemTemplateRequest,
} from "@athletept/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/lib/api";

export const systemTemplateKeys = {
  all: ["system-challenges"] as const,
};

export function useSystemTemplates() {
  return useQuery({
    queryKey: systemTemplateKeys.all,
    queryFn: () => api<SystemTemplateListResponse>("/admin/system-challenges"),
  });
}

function useTemplateMutation<TVariables>(
  request: (variables: TVariables) => Promise<SystemTemplate | void>,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: request,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: systemTemplateKeys.all }),
  });
}

export function useCreateSystemTemplate() {
  return useTemplateMutation((body: CreateSystemTemplateRequest) =>
    api<SystemTemplate>("/admin/system-challenges", { method: "POST", body }),
  );
}

export function useUpdateSystemTemplate() {
  return useTemplateMutation(({ id, body }: { id: string; body: UpdateSystemTemplateRequest }) =>
    api<SystemTemplate>(`/admin/system-challenges/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body,
    }),
  );
}

export function useDeleteSystemTemplate() {
  return useTemplateMutation((id: string) =>
    api<void>(`/admin/system-challenges/${encodeURIComponent(id)}`, { method: "DELETE" }),
  );
}
