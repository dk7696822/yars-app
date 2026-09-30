import { useState } from "react";
import PropTypes from "prop-types";
import { useQueryClient } from "@tanstack/react-query";
import SearchPicker from "../../ui/SearchPicker";
import Button from "../../ui/Button";
import { useSuppliersPicker, refreshStock } from "./api";
import { supplierAPI } from "../../services/inventoryAPI";
import { cleanName } from "../../ui/nameList";
import { errorText } from "../../lib/errors";

export default function SupplierPicker({ open, onClose, onPick }) {
  const qc = useQueryClient();
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const list = useSuppliersPicker();
  const term = query.trim().toLowerCase();
  const items = (list.data || []).filter((s) => s.name.toLowerCase().includes(term) || (s.phone || "").includes(term));
  const exact = (list.data || []).some((s) => s.name.toLowerCase() === term);
  const create = async () => {
    setCreating(true);
    setError("");
    try {
      const res = await supplierAPI.create({ name: cleanName(query), phone: null, email: null, gst_number: null, address: null });
      await refreshStock(qc);
      onPick({ id: res.data.data.id, name: res.data.data.name });
      setQuery("");
    } catch (err) {
      setError(errorText(err, "Couldn't add the supplier."));
    } finally {
      setCreating(false);
    }
  };
  return (
    <SearchPicker open={open} title="Choose supplier" query={query} onQuery={(v) => { setQuery(v); setError(""); }} placeholder="Search supplier name or phone"
      loading={list.isPending} error={error || (list.isError ? "Couldn't load suppliers." : undefined)}
      items={items} getKey={(s) => s.id} onClose={onClose} onPick={(s) => { onPick({ id: s.id, name: s.name }); setQuery(""); }}
      empty={term ? `No supplier called “${query.trim()}”` : "No suppliers yet"}
      renderItem={(s) => (<span className="min-w-0 flex-1"><span className="block truncate font-semibold text-ink">{s.name}</span>{s.phone && <span className="block text-xs text-ink-2">{s.phone}</span>}</span>)}
      footer={term && !exact ? <Button variant="secondary" block loading={creating} onClick={create}>＋ New supplier “{cleanName(query)}”</Button> : null} />
  );
}

SupplierPicker.propTypes = { open: PropTypes.bool.isRequired, onClose: PropTypes.func.isRequired, onPick: PropTypes.func.isRequired };
