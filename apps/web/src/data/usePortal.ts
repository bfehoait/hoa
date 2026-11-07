import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { repository } from "./repository";
import { useAuth } from "./auth";

export function usePortal(enabled = true) {
  const auth = useAuth();
  return useQuery({
    queryKey: ["preview"],
    queryFn: () => {
      if (!auth.preview && !auth.rolePreview)
        throw new Error(
          "Local demonstration data is unavailable in your account.",
        );
      return repository.load();
    },
    retry: false,
    staleTime: Infinity,
    enabled: enabled && (auth.preview || !!auth.rolePreview),
  });
}
export function usePortalMutation<T>(fn: (input: T) => Promise<unknown>) {
  const auth = useAuth();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: T) => {
      if (!auth.preview && !auth.rolePreview)
        throw new Error("This local demonstration cannot change your account.");
      return fn(input);
    },
    onSuccess: () => client.invalidateQueries({ queryKey: ["preview"] }),
  });
}
