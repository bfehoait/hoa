import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { Plus, Search, ShoppingBag } from "lucide-react";
import {
  featureRecordSchema,
  featureDashboardSchema,
  type FeatureRecord,
} from "../../../../../packages/shared/src/feature-records";
import { baselineModule } from "../../../../../packages/shared/src/baseline";
import { useAuth } from "../../data/auth";
import { featureRpc } from "../../data/feature-records";
import { Button, Feedback, Modal, Skeleton } from "../../components/UI";
import GarageSaleItems from "./GarageSaleItems";
import FeatureSubmissionForm from "./FeatureSubmissionForm";
import ListingMedia from "./ListingMedia";
import LiveFeature from "./LiveFeature";
import ParticipationDesk from "./ParticipationDesk";
import styles from "./Marketplace.module.css";

const types = [
  { id: "buy-sell", label: "Buy & sell" },
  { id: "businesses", label: "Local businesses" },
  { id: "jobs", label: "Jobs & referrals" },
  { id: "garage-sales", label: "Garage sales" },
  { id: "booth-events", label: "Booth events" },
  { id: "workshops", label: "Training & workshops" },
] as const;
const schema = z.object({
  rows: z.array(featureRecordSchema),
  total: z.number().int().nonnegative(),
  postable_modules: z.array(
    z.enum([
      "buy-sell",
      "businesses",
      "jobs",
      "garage-sales",
      "booth-events",
      "workshops",
    ]),
  ),
  can_manage_own: z.boolean(),
});
const typeName = (module: string) =>
  types.find((type) => type.id === module)?.label ?? "Listing";
function price(record: FeatureRecord) {
  const value = record.fields?.price;
  return record.module === "buy-sell" &&
    value !== undefined &&
    /^[0-9]+([.][0-9]+)?$/.test(String(value)) &&
    Number.isFinite(Number(value))
    ? new Intl.NumberFormat("en-PH", {
        style: "currency",
        currency: "PHP",
        maximumFractionDigits: 2,
      }).format(Number(value))
    : typeName(record.module);
}
export default function Marketplace() {
  const auth = useAuth(),
    cache = useQueryClient();
  const browsingOnly = !!auth.memberPreview;
  const [params, setParams] = useSearchParams();
  const module = types.some((type) => type.id === params.get("section"))
    ? params.get("section")!
    : auth.memberPreview
      ? "buy-sell"
      : "";
  const search = (params.get("q") ?? "").slice(0, 100);
  const category = (params.get("category") ?? "").slice(0, 80);
  const sort = ["latest", "price_low", "price_high"].includes(
    params.get("sort") ?? "",
  )
    ? params.get("sort")!
    : "latest";
  const requestedPage = Number(params.get("page") ?? 0);
  const page =
    Number.isInteger(requestedPage) &&
    requestedPage >= 0 &&
    requestedPage <= 10000
      ? requestedPage
      : 0;
  const mode =
    params.get("view") === "mine"
      ? "mine"
      : params.get("view") === "applications"
        ? "applications"
        : "browse";
  const selectedId = params.get("listing");
  const [draft, setDraft] = useState(search);
  const [ownModule, setOwnModule] = useState("buy-sell");
  useEffect(() => setDraft(search), [search]);
  function update(values: Record<string, string | number | null>) {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(values)) {
      if (value === null || value === "" || value === 0) next.delete(key);
      else next.set(key, String(value));
    }
    setParams(next, { preventScrollReset: true });
  }
  const setMode = (value: string) =>
    update({
      view: value === "browse" ? null : value,
      listing: null,
      activity: null,
    });
  const setSelectedId = (value: string | null) => update({ listing: value });
  const setPage = (value: number) => update({ page: value, listing: null });
  const [create, setCreate] = useState(false),
    [postType, setPostType] = useState("buy-sell"),
    [busy, setBusy] = useState(false),
    [saved, setSaved] = useState(false),
    [clientId, setClientId] = useState(() => crypto.randomUUID()),
    [notice, setNotice] = useState("");
  const query = useQuery({
    queryKey: [
      "marketplace",
      auth.userId,
      auth.memberPreview,
      module,
      search,
      category,
      sort,
      page,
    ],
    enabled: mode === "browse",
    retry: false,
    gcTime: 0,
    refetchInterval: 30000,
    queryFn: async () => {
      if (auth.memberPreview) {
        const feed = featureDashboardSchema.parse(
          await featureRpc("bfe_feature_dashboard", {
            p_module: module || "buy-sell",
            p_view: "published",
            p_search: search,
            p_page: page,
          }),
        );
        return {
          rows: feed.rows,
          total: feed.total,
          postable_modules: [],
          can_manage_own: false,
        };
      }
      return schema.parse(
        await featureRpc("bfe_marketplace_feed", {
          p_module: module,
          p_category: category,
          p_search: search,
          p_sort: sort,
          p_page: page,
        }),
      );
    },
  });
  const categories = Array.from(
    new Set(
      types
        .filter((type) => !module || type.id === module)
        .flatMap(
          (type) =>
            baselineModule(type.id).fields.find(
              (field) => field.key === "category",
            )?.options ?? [],
        ),
    ),
  );
  const selected = query.isSuccess
    ? query.data.rows.find((record) => record.id === selectedId)
    : undefined;
  const postingTypes = types.filter(
    (type) => !browsingOnly && query.data?.postable_modules.includes(type.id),
  );
  const postingModule = postingTypes.some((type) => type.id === postType)
    ? postType
    : (postingTypes[0]?.id ?? "buy-sell");
  const refresh = async () => {
    await cache.invalidateQueries({ queryKey: ["marketplace"] });
    await cache.invalidateQueries({ queryKey: ["feature-records"] });
  };
  if (mode === "applications")
    return (
      <>
        <Button secondary onClick={() => setMode("browse")}>
          Back to Livelihood
        </Button>
        <div className={styles.manageToolbar}>
          <label>
            Application type
            <select
              value={module === "booth-events" ? "booth-events" : "workshops"}
              onChange={(e) => update({ section: e.target.value })}
            >
              <option value="workshops">Training & workshops</option>
              <option value="booth-events">Booth events</option>
            </select>
          </label>
        </div>
        <ParticipationDesk
          key={module}
          module={module === "booth-events" ? "booth-events" : "workshops"}
          initialActivity={params.get("activity") ?? undefined}
        />
      </>
    );
  if (mode === "mine")
    return (
      <>
        <div className={styles.manageToolbar}>
          <Button secondary onClick={() => setMode("browse")}>
            Back to Livelihood
          </Button>
          <label>
            Listing type
            <select
              value={ownModule}
              onChange={(event) => setOwnModule(event.target.value)}
            >
              {types.map((type) => (
                <option key={type.id} value={type.id}>
                  {type.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <LiveFeature
          key={ownModule}
          module={ownModule}
          initialView="mine"
          resident
        />
      </>
    );
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1>Livelihood</h1>
          <p>Your community marketplace.</p>
        </div>
        <div className={styles.headerActions}>
          {!browsingOnly && (
            <Button secondary onClick={() => setMode("applications")}>
              My applications
            </Button>
          )}
          {query.data?.can_manage_own && !browsingOnly && (
            <Button secondary onClick={() => setMode("mine")}>
              My listings
            </Button>
          )}
          {!!postingTypes.length && !auth.memberPreview && (
            <Button
              className={styles.desktopCreate}
              onClick={() => {
                setSaved(false);
                setCreate(true);
              }}
            >
              <Plus size={18} aria-hidden="true" />
              Post a listing
            </Button>
          )}
        </div>
      </header>
      {!!postingTypes.length &&
        !auth.memberPreview &&
        !create &&
        !selectedId && (
          <button
            type="button"
            className={styles.createFab}
            aria-label="Create a listing"
            aria-haspopup="dialog"
            onClick={() => {
              setSaved(false);
              setCreate(true);
            }}
          >
            <Plus size={28} aria-hidden="true" />
          </button>
        )}
      {auth.memberPreview && (
        <p className={styles.note}>
          Read-only account preview. Choose a listing type; price sorting and
          category filters are available when signed in directly.
        </p>
      )}
      {(!!query.data?.total || search || category) && (
        <form
          className={styles.search}
          onSubmit={(event) => {
            event.preventDefault();
            update({ q: draft.trim(), page: null, listing: null });
          }}
        >
          <Search size={20} aria-hidden="true" />
          <input
            type="search"
            aria-label="Search livelihood listings"
            placeholder="Search Livelihood"
            maxLength={100}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
          />
          <Button type="submit">Search</Button>
        </form>
      )}
      <div className={styles.categories} role="group" aria-label="Listing type">
        {(!auth.memberPreview
          ? [{ id: "", label: "All listings" }, ...types]
          : types
        ).map((type) => (
          <button
            type="button"
            key={type.id}
            aria-pressed={module === type.id}
            onClick={() => {
              update({
                section: type.id,
                category: null,
                page: null,
                listing: null,
              });
            }}
          >
            {type.label}
          </button>
        ))}
      </div>
      {!auth.memberPreview && (!!query.data?.total || search || category) && (
        <details className={styles.filterDisclosure}>
          <summary>
            Filter & sort
            <span>
              {category || (sort === "latest" ? "Newest first" : "Price")}
            </span>
          </summary>
          <div className={styles.filters}>
            <label>
              Category
              <select
                value={category}
                onChange={(event) => {
                  update({
                    category: event.target.value,
                    page: null,
                    listing: null,
                  });
                }}
              >
                <option value="">All categories</option>
                {categories.map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </select>
            </label>
            <label>
              Sort by
              <select
                value={sort}
                onChange={(event) => {
                  update({
                    sort: event.target.value,
                    page: null,
                    listing: null,
                  });
                }}
              >
                <option value="latest">Newest first</option>
                <option value="price_low">Price: low to high</option>
                <option value="price_high">Price: high to low</option>
              </select>
            </label>
          </div>
        </details>
      )}
      <Feedback message={notice} />
      {selectedId && query.isSuccess && !selected && (
        <div className={styles.empty} role="status">
          <p>This listing is no longer available in this view.</p>
          <Button secondary onClick={() => setSelectedId(null)}>
            Back to listings
          </Button>
        </div>
      )}
      {query.isPending ? (
        <Skeleton />
      ) : query.isError ? (
        <>
          <Feedback error={query.error} />
          <Button secondary onClick={() => void query.refetch()}>
            Try again
          </Button>
        </>
      ) : (
        query.data && (
          <>
            {!!query.data.rows.length && (
              <div className={styles.resultHeading}>
                <h2>
                  {module ? typeName(module) : "Fresh from the community"}
                </h2>
                <span>
                  {query.data.total}{" "}
                  {query.data.total === 1 ? "listing" : "listings"}
                </span>
              </div>
            )}
            <div className={styles.grid}>
              {query.data.rows.map((record) => (
                <article className={styles.card} key={record.id}>
                  <div className={styles.image}>
                    <ListingMedia id={record.id} coverOnly alt={record.title} />
                  </div>
                  <div className={styles.cardBody}>
                    <p className={styles.price}>{price(record)}</p>
                    <h3>
                      <button
                        className={styles.listingTitle}
                        type="button"
                        onClick={() => setSelectedId(record.id)}
                      >
                        {record.title}
                      </button>
                    </h3>
                    <p className={styles.metadata}>
                      {[record.fields?.category, record.fields?.condition]
                        .filter(Boolean)
                        .join(" / ") || typeName(record.module)}
                    </p>
                  </div>
                </article>
              ))}
            </div>
            {!query.data.rows.length && (
              <div className={styles.empty}>
                <ShoppingBag size={32} aria-hidden="true" />
                <h3>No listings to show yet</h3>
                <p>
                  {search || category || module
                    ? "Try another search or category. New listings appear after publication."
                    : "Published community listings will appear here."}
                </p>
                {(search || category || module) && (
                  <Button
                    secondary
                    onClick={() => {
                      setDraft("");
                      update({
                        q: null,
                        category: null,
                        section: auth.memberPreview ? "buy-sell" : null,
                        page: null,
                        listing: null,
                      });
                    }}
                  >
                    Clear filters
                  </Button>
                )}
              </div>
            )}
            {query.data.total > 20 && (
              <div className={styles.pagination}>
                <Button
                  secondary
                  disabled={page === 0}
                  onClick={() => setPage(page - 1)}
                >
                  Previous
                </Button>
                <span>Page {page + 1}</span>
                <Button
                  secondary
                  disabled={(page + 1) * 20 >= query.data.total}
                  onClick={() => setPage(page + 1)}
                >
                  Next
                </Button>
              </div>
            )}
          </>
        )
      )}
      {selected && (
        <Modal
          title={selected.title}
          onClose={() => setSelectedId(null)}
          presentation="task"
        >
          <ListingMedia id={selected.id} alt={selected.title} />
          <p className={styles.detailPrice}>{price(selected)}</p>
          <p className={styles.metadata}>
            {[selected.fields?.category, selected.fields?.condition]
              .filter(Boolean)
              .join(" / ")}
          </p>
          <p className={styles.detailText}>{selected.detail}</p>
          {selected.module === "garage-sales" && (
            <GarageSaleItems recordId={selected.id} readOnly />
          )}
          {["workshops", "booth-events"].includes(selected.module) &&
            !browsingOnly && (
              <Button
                onClick={() => {
                  update({
                    view: "applications",
                    section: selected.module,
                    listing: null,
                    activity: selected.id,
                  });
                }}
              >
                Apply / view my applications
              </Button>
            )}
          <p className={styles.note}>
            Only contact links the poster chose to share are shown. Arrange any
            purchase directly with them.
          </p>
        </Modal>
      )}
      {create && !!postingTypes.length && (
        <Modal
          title="Post a listing"
          presentation="task"
          protectChanges={!saved}
          size="lg"
          busy={busy}
          onClose={() => {
            setCreate(false);
            if (saved) {
              setClientId(crypto.randomUUID());
              setNotice(
                "Listing saved. Open My listings to check its photo and review status.",
              );
              void refresh();
            }
          }}
        >
          <label className={styles.postType}>
            Listing type
            <select
              value={postingModule}
              disabled={busy || saved}
              onChange={(event) => setPostType(event.target.value)}
            >
              {postingTypes.map((type) => (
                <option key={type.id} value={type.id}>
                  {type.label}
                </option>
              ))}
            </select>
          </label>
          <p className={styles.note}>
            Your listing appears to the community after office review.
          </p>
          <FeatureSubmissionForm
            key={postingModule}
            module={postingModule}
            editing={null}
            clientId={clientId}
            publishable
            onBusyChange={setBusy}
            onRecordSaved={() => setSaved(true)}
            onSaved={(message) => {
              setCreate(false);
              setSaved(false);
              setClientId(crypto.randomUUID());
              setNotice(message);
              void refresh();
            }}
          />
        </Modal>
      )}
    </div>
  );
}
