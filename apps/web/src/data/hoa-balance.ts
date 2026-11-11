import { hoaBalanceSchema } from "../../../../packages/shared/src/hoa-balance";
import { usePermissions } from "./permissions";
import { useRegistryRpc } from "./registry";
import { useAuth } from "./auth";
export function useHoaBalance(page = 0, poll = true) {
  const auth = useAuth();
  const permissions = usePermissions();
  const allowed =
    permissions.allowsPath("/account") && !auth.preview && !auth.rolePreview;
  const query = useRegistryRpc(
    "bfe_my_hoa_balance",
    { p_page: page },
    hoaBalanceSchema,
    allowed,
    { refetchInterval: poll && !auth.memberPreview ? 30000 : false },
  );
  return { ...query, allowed };
}
