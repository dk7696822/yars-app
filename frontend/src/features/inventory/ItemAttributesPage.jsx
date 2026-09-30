import { useState } from "react";
import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronDown } from "lucide-react";
import { useAttributes, refreshStock } from "./api";
import { itemAttributesAPI } from "../../services/inventoryAPI";
import PageHeader from "../../ui/PageHeader";
import NameListEditor from "../../ui/NameListEditor";
import { ErrorState, ListSkeleton } from "../../ui/States";

export default function ItemAttributesPage() {
  const qc = useQueryClient();
  const attributes = useAttributes();
  const [open, setOpen] = useState(null);
  const after = () => refreshStock(qc);
  return (
    <div className="mx-auto max-w-xl px-4 py-4 sm:px-6">
      <PageHeader title="Item details" subtitle={<>Like GSM or colour · <Link to="/inventory-items" className="text-brass">← Items</Link></>} />
      <div className="mt-4">
        {attributes.isPending ? <ListSkeleton rows={4} /> : attributes.isError ? <ErrorState title="Couldn't load item details." onRetry={() => attributes.refetch()} /> : (
          <NameListEditor items={attributes.data} noun="detail" addPlaceholder="New detail, e.g. GSM" emptyText="No details yet."
            onAdd={async (name) => { await itemAttributesAPI.create({ name }); await after(); }}
            onRename={async (a, name) => { await itemAttributesAPI.update(a.id, { name }); await after(); }}
            onDelete={async (a) => { await itemAttributesAPI.delete(a.id); await after(); }}
            renderExtra={(a) => (
              <button type="button" aria-expanded={open === a.id} onClick={() => setOpen(open === a.id ? null : a.id)}
                className="flex h-9 items-center gap-1 rounded-full px-2 text-xs font-semibold text-brass hover:bg-raised">
                {a.values.length} value{a.values.length === 1 ? "" : "s"}<ChevronDown className={`h-4 w-4 transition ${open === a.id ? "rotate-180" : ""}`} aria-hidden="true" />
              </button>
            )}
            renderBelow={(a) => open === a.id && (
              <div className="bg-canvas/40 px-4 pb-4 pt-1">
                <NameListEditor items={a.values.map((v) => ({ id: v.id, name: v.value }))} noun="value" addPlaceholder={`New ${a.name} value`} emptyText="No values yet."
                  onAdd={async (value) => { await itemAttributesAPI.createValue(a.id, { value }); await after(); }}
                  onRename={async (v, value) => { await itemAttributesAPI.updateValue(v.id, { value }); await after(); }}
                  onDelete={async (v) => { await itemAttributesAPI.deleteValue(v.id); await after(); }} />
              </div>
            )} />
        )}
      </div>
    </div>
  );
}
