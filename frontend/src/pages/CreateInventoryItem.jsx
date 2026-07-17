import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { FaArrowLeft } from "react-icons/fa";
import { inventoryItemAPI, inventoryCategoryAPI, itemAttributesAPI } from "../services/inventoryAPI";

const UNITS = ["KG", "PCS", "METRE", "ROLL", "LITRE"];

const inputClasses =
  "w-full min-h-[44px] px-3 rounded-xl border border-gray-200 dark:border-emerald-900/40 bg-white dark:bg-[#161d1a] text-gray-900 dark:text-emerald-50";

const CreateInventoryItem = () => {
  const navigate = useNavigate();

  const [categories, setCategories] = useState([]);
  const [attributes, setAttributes] = useState([]);

  const [name, setName] = useState("");
  const [itemCode, setItemCode] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [unit, setUnit] = useState("KG");
  const [reorderLevel, setReorderLevel] = useState("");
  const [reorderTarget, setReorderTarget] = useState("");
  const [notes, setNotes] = useState("");
  // One selection per attribute: { [attribute_id]: value_id }. A single-select
  // per attribute cannot produce two values, so no client-side juggling.
  const [selections, setSelections] = useState({});

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        const [categoryData, attributeData] = await Promise.all([
          inventoryCategoryAPI.getAll(),
          itemAttributesAPI.getAll(),
        ]);
        setCategories(categoryData);
        setAttributes(attributeData);
      } catch (err) {
        console.error("Error loading item form:", err);
        setError("Failed to load categories and attributes. Please try again.");
      }
    };
    load();
  }, []);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");

    if (!name.trim() || !categoryId) {
      setError("Name and category are required.");
      return;
    }

    try {
      setSaving(true);

      await inventoryItemAPI.create({
        name: name.trim(),
        item_code: itemCode.trim() || null,
        category_id: categoryId,
        unit,
        reorder_level: reorderLevel ? parseFloat(reorderLevel) : 0,
        reorder_target: reorderTarget ? parseFloat(reorderTarget) : null,
        notes: notes || null,
        attribute_value_ids: Object.values(selections).filter(Boolean),
      });

      navigate("/inventory-items", { state: { message: "Item created successfully" } });
    } catch (err) {
      console.error("Error creating item:", err);
      setError(err.response?.data?.message || "Failed to create item.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 pb-28">
      <button
        type="button"
        onClick={() => navigate("/inventory-items")}
        className="flex items-center gap-2 mb-4 text-sm text-gray-600 dark:text-gray-400 min-h-[44px]"
      >
        <FaArrowLeft className="w-3 h-3" /> Back
      </button>

      <h1 className="text-2xl font-bold text-gray-900 dark:text-emerald-50 mb-1">New Inventory Item</h1>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">Add a raw material to the master list</p>

      {error && (
        <div className="mb-4 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 p-4 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Name <span className="text-red-500">*</span>
          </label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} className={inputClasses} required />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Item code <span className="text-gray-400">(optional)</span>
            </label>
            <input type="text" value={itemCode} onChange={(e) => setItemCode(e.target.value)} className={inputClasses} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Category <span className="text-red-500">*</span>
            </label>
            <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={inputClasses} required>
              <option value="">Select category…</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>{category.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Unit</label>
          <select value={unit} onChange={(e) => setUnit(e.target.value)} className={inputClasses}>
            {UNITS.map((u) => (
              <option key={u} value={u}>{u}</option>
            ))}
          </select>
        </div>

        {/* One dropdown per attribute — GSM, Color, Cut and anything added later
            all render through this same loop. Every one is optional. */}
        {attributes.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {attributes.map((attribute) => (
              <div key={attribute.id}>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {attribute.name} <span className="text-gray-400">(optional)</span>
                </label>
                <select
                  value={selections[attribute.id] || ""}
                  onChange={(e) => setSelections((current) => ({ ...current, [attribute.id]: e.target.value }))}
                  className={inputClasses}
                >
                  <option value="">—</option>
                  {attribute.values.map((value) => (
                    <option key={value.id} value={value.id}>{value.value}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Reorder level</label>
            <input
              type="number"
              step="0.01"
              min="0"
              inputMode="decimal"
              value={reorderLevel}
              onChange={(e) => setReorderLevel(e.target.value)}
              placeholder="0"
              className={inputClasses}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Reorder target</label>
            <input
              type="number"
              step="0.01"
              min="0"
              inputMode="decimal"
              value={reorderTarget}
              onChange={(e) => setReorderTarget(e.target.value)}
              placeholder="0"
              className={inputClasses}
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Notes <span className="text-gray-400">(optional)</span>
          </label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={`${inputClasses} py-2`} />
        </div>

        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/95 dark:bg-[#0f1a16]/95 backdrop-blur border-t border-gray-200 dark:border-emerald-900/30 sm:static sm:p-0 sm:bg-transparent sm:dark:bg-transparent sm:border-0 sm:backdrop-blur-none">
          <button
            type="submit"
            disabled={saving}
            className="w-full min-h-[52px] rounded-xl bg-primary text-white font-semibold disabled:opacity-50"
          >
            {saving ? "Saving…" : "Create item"}
          </button>
        </div>
      </form>
    </div>
  );
};

export default CreateInventoryItem;
