import type {
  AdminApiKey,
  ApiKey,
  ApiKeyAuditEntry,
  ApiKeyPickupInfo,
  ApiKeyPickupResponse,
  CreateApiKeyRequest,
  UpdateApiKeyRequest,
} from "@athletept/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/lib/api";

const keys = {
  admin: ["api-keys"] as const,
  audit: (id: string) => ["api-keys", id, "audit"] as const,
  mine: ["me", "api-keys"] as const,
};

const path = (id: string) => `/api-keys/${encodeURIComponent(id)}`;

export function useAdminApiKeys() {
  return useQuery({ queryKey: keys.admin, queryFn: () => api<AdminApiKey[]>("/api-keys") });
}

export function useCreateApiKey() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateApiKeyRequest) =>
      api<AdminApiKey & { mailSent: boolean }>("/api-keys", { method: "POST", body }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.admin }),
  });
}

export function useUpdateApiKey() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: UpdateApiKeyRequest & { id: string }) =>
      api<AdminApiKey>(path(id), { method: "PATCH", body }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.admin }),
  });
}

export function useRevokeApiKey() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<AdminApiKey>(`${path(id)}/revoke`, { method: "POST" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.admin }),
  });
}

export function useResendPickupLink() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api<{ mailSent: boolean }>(`${path(id)}/pickup-link`, { method: "POST" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.admin }),
  });
}

export function useApiKeyAudit(id: string) {
  return useQuery({
    queryKey: keys.audit(id),
    queryFn: () => api<{ items: ApiKeyAuditEntry[] }>(`${path(id)}/audit`),
  });
}

export function useMyApiKeys() {
  return useQuery({ queryKey: keys.mine, queryFn: () => api<ApiKey[]>("/me/api-keys") });
}

export function useRevokeMyApiKey() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api<ApiKey>(`/me/api-keys/${encodeURIComponent(id)}/revoke`, { method: "POST" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.mine }),
  });
}

export function useApiKeyPickupInfo(token: string | null) {
  return useQuery({
    queryKey: ["api-key-pickup", token],
    queryFn: () =>
      api<ApiKeyPickupInfo>("/api-keys/pickup/inspect", { method: "POST", body: { token } }),
    enabled: Boolean(token),
    retry: false,
    staleTime: Infinity,
  });
}

export function usePickUpApiKey() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (token: string) =>
      api<ApiKeyPickupResponse>("/api-keys/pickup", {
        method: "POST",
        body: { token, acceptDataAccess: true },
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.mine }),
  });
}
