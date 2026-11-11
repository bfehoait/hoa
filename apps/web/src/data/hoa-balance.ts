import { hoaBalanceSchema } from "../../../../packages/shared/src/hoa-balance";
import { usePermissions } from "./permissions";
import { useRegistryRpc } from "./registry";
import { useAuth } from "./auth";
import { accountBalanceSchema } from "../../../../packages/shared/src/account-balance";
export function useAccountBalance(page = 0) {
  const auth = useAuth();
  const permissions = usePermissions();
  const allowed =
    permissions.allowsPath("/account") && !auth.preview && !auth.rolePreview;
  const query = useRegistryRpc(
    "bfe_my_account_balance",
    { p_page: page },
    accountBalanceSchema,
    allowed,
    { refetchInterval: auth.memberPreview ? false : 30000 },
  );
  return {
    ...query,
    data: allowed && !query.isError ? query.data : undefined,
    allowed,
  };
}
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
