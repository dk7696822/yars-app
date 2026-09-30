import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useInvCategories, refreshStock } from "./api";
import { inventoryCategoryAPI } from "../../services/inventoryAPI";
import PageHeader from "../../ui/PageHeader";
import NameListEditor from "../../ui/NameListEditor";
import { ErrorState, ListSkeleton } from "../../ui/States";

export default function InventoryCategoriesPage() {
  const qc = useQueryClient();
  const categories = useInvCategories();
  const after = () => refreshStock(qc);
  return (
    <div className="mx-auto max-w-xl px-4 py-4 sm:px-6">
      <PageHeader title="Item categories" subtitle={<Link to="/inventory-items" className="text-brass">← Items</Link>} />
      <div className="mt-4">
        {categories.isPending ? <ListSkeleton rows={4} /> : categories.isError ? <ErrorState title="Couldn't load categories." onRetry={() => categories.refetch()} /> : (
          <NameListEditor items={categories.data} noun="category" addPlaceholder="New category, e.g. Raw material" emptyText="No categories yet."
            onAdd={async (name) => { await inventoryCategoryAPI.create({ name }); await after(); }}
            onRename={async (c, name) => { await inventoryCategoryAPI.update(c.id, { name }); await after(); }}
            onDelete={async (c) => { await inventoryCategoryAPI.delete(c.id); await after(); }} />
        )}
      </div>
    </div>
  );
}
