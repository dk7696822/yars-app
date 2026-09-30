import { useState } from "react";
import PropTypes from "prop-types";
import { Pencil, Trash2, Check, X } from "lucide-react";
import TextInput from "./TextInput";
import Button from "./Button";
import IconButton from "./IconButton";
import ConfirmDialog from "./ConfirmDialog";
import { cleanName } from "./nameList";
import { errorText } from "../lib/errors";

/**
 * Add / rename / delete a list of names (categories, attributes, values).
 * Callbacks are async; when one fails the server's message is shown and the
 * list stays as it was (e.g. "Cannot delete this category as it is being used…").
 */
export default function NameListEditor({ items, onAdd, onRename, onDelete, addPlaceholder, noun, emptyText, addLabel = "Add", renderExtra, renderBelow }) {
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState(null); // { item, name }
  const [removing, setRemoving] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const run = async (fn) => {
    setBusy(true);
    setError("");
    try {
      await fn();
      return true;
    } catch (err) {
      setError(errorText(err, "That didn't work. Try again."));
      return false;
    } finally {
      setBusy(false);
    }
  };

  const add = async (e) => {
    e.preventDefault();
    const name = cleanName(draft);
    if (!name) return setError(`Enter the ${noun} name`);
    if (await run(() => onAdd(name))) setDraft("");
  };
  const rename = async () => {
    const name = cleanName(editing.name);
    if (!name) return setError(`Enter the ${noun} name`);
    if (await run(() => onRename(editing.item, name))) setEditing(null);
  };
  const remove = async () => {
    const item = removing;
    setRemoving(null);
    await run(() => onDelete(item));
  };

  return (
    <div className="space-y-3">
      <form onSubmit={add} className="flex gap-2">
        <TextInput value={draft} onChange={(e) => { setDraft(e.target.value); setError(""); }} placeholder={addPlaceholder} aria-label={addPlaceholder} />
        <Button type="submit" loading={busy && !editing} disabled={!draft.trim()}>{addLabel}</Button>
      </form>
      {error && <p role="alert" className="text-sm text-status-critical">{error}</p>}
      {items.length === 0 ? (
        <p className="rounded-2xl bg-surface px-4 py-6 text-center text-sm text-ink-2">{emptyText}</p>
      ) : (
        <ul className="overflow-hidden rounded-2xl bg-surface">
          {items.map((item) => (
            <li key={item.id} className="border-b border-line/60 last:border-0">
              {editing?.item.id === item.id ? (
                <div className="flex items-center gap-2 px-3 py-2">
                  <TextInput autoFocus value={editing.name} aria-label={`New name for ${item.name}`}
                    onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); rename(); } if (e.key === "Escape") setEditing(null); }} />
                  <IconButton label="Save name" onClick={rename} disabled={busy}><Check className="h-4 w-4" /></IconButton>
                  <IconButton label="Cancel rename" onClick={() => setEditing(null)} className="bg-transparent"><X className="h-4 w-4" /></IconButton>
                </div>
              ) : (
                <div className="flex items-center gap-1 px-4 py-2">
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">{item.name}</span>
                  {renderExtra?.(item)}
                  <IconButton label={`Rename ${item.name}`} onClick={() => { setEditing({ item, name: item.name }); setError(""); }} className="h-9 w-9 bg-transparent text-ink-2"><Pencil className="h-4 w-4" /></IconButton>
                  <IconButton label={`Delete ${item.name}`} onClick={() => setRemoving(item)} className="h-9 w-9 bg-transparent text-ink-2"><Trash2 className="h-4 w-4" /></IconButton>
                </div>
              )}
              {renderBelow?.(item)}
            </li>
          ))}
        </ul>
      )}
      <ConfirmDialog open={Boolean(removing)} title={`Delete ${removing?.name || ""}?`} confirmLabel="Delete" cancelLabel="Keep it"
        message="It will no longer be offered. If it's still in use it won't be deleted, and you'll see why." onConfirm={remove} onClose={() => setRemoving(null)} />
    </div>
  );
}

NameListEditor.propTypes = {
  items: PropTypes.arrayOf(PropTypes.shape({ id: PropTypes.string.isRequired, name: PropTypes.string.isRequired })).isRequired,
  onAdd: PropTypes.func.isRequired, onRename: PropTypes.func.isRequired, onDelete: PropTypes.func.isRequired,
  addPlaceholder: PropTypes.string.isRequired, noun: PropTypes.string.isRequired, emptyText: PropTypes.string.isRequired,
  addLabel: PropTypes.string, renderExtra: PropTypes.func, renderBelow: PropTypes.func,
};
