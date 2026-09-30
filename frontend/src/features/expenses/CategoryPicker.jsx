import { useState } from "react";
import PropTypes from "prop-types";
import SearchPicker from "../../ui/SearchPicker";
import Button from "../../ui/Button";
import { useExpenseCategories, useCategoryMutations } from "./api";
import { cleanName } from "../../ui/nameList";
import { errorText } from "../../lib/errors";

export default function CategoryPicker({ open, onClose, onPick }) {
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const categories = useExpenseCategories();
  const { add } = useCategoryMutations();
  const term = query.trim().toLowerCase();
  const items = (categories.data || []).filter((c) => c.name.toLowerCase().includes(term));
  const exact = (categories.data || []).some((c) => c.name.toLowerCase() === term);

  const create = async () => {
    setCreating(true);
    setError("");
    try {
      const c = await add(cleanName(query));
      onPick(c);
      setQuery("");
    } catch (err) {
      setError(errorText(err, "Couldn't add the category."));
    } finally {
      setCreating(false);
    }
  };

  return (
    <SearchPicker open={open} title="Choose category" query={query} onQuery={(q) => { setQuery(q); setError(""); }} placeholder="Search categories"
      loading={categories.isPending} error={error || (categories.isError ? "Couldn't load categories." : undefined)}
      items={items} getKey={(c) => c.id} renderItem={(c) => <span className="font-semibold text-ink">{c.name}</span>}
      onPick={(c) => { onPick(c); setQuery(""); }} onClose={onClose}
      empty={term ? `No category called “${query.trim()}”` : "No categories yet"}
      footer={term && !exact ? <Button variant="secondary" block loading={creating} onClick={create}>＋ New category “{cleanName(query)}”</Button> : null} />
  );
}

CategoryPicker.propTypes = { open: PropTypes.bool.isRequired, onClose: PropTypes.func.isRequired, onPick: PropTypes.func.isRequired };
