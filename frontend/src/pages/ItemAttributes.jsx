import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { FaPlus, FaCheckCircle, FaChevronDown, FaChevronRight, FaArrowLeft, FaEdit, FaTrash, FaTimes, FaCheck, FaSlidersH } from "react-icons/fa";
import { itemAttributesAPI } from "../services/inventoryAPI";
import ConfirmationModal from "../components/common/ConfirmationModal";

const inputClasses =
  "min-h-[44px] px-3 rounded-xl border border-gray-200 dark:border-emerald-900/40 bg-white dark:bg-[#161d1a] text-sm text-gray-900 dark:text-emerald-50";

const iconButtonClasses =
  "flex items-center justify-center w-11 h-11 rounded-xl border border-gray-200 dark:border-emerald-900/40 text-gray-600 dark:text-emerald-100";

const dangerButtonClasses =
  "flex items-center justify-center w-11 h-11 rounded-xl border border-red-200 dark:border-red-500/30 text-red-600 dark:text-red-400";

const ItemAttributes = () => {
  const [attributes, setAttributes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  // One attribute expanded at a time — this is a phone screen.
  const [expandedId, setExpandedId] = useState(null);

  const [newAttributeName, setNewAttributeName] = useState("");
  const [renamingAttributeId, setRenamingAttributeId] = useState(null);
  const [renamingAttributeName, setRenamingAttributeName] = useState("");

  const [newValueText, setNewValueText] = useState("");
  const [renamingValueId, setRenamingValueId] = useState(null);
  const [renamingValueText, setRenamingValueText] = useState("");

  // { kind: "attribute" | "value", id, label }
  const [deleteTarget, setDeleteTarget] = useState(null);

  const flashSuccess = (message) => {
    setSuccessMessage(message);
    setTimeout(() => setSuccessMessage(""), 4000);
  };

  // One response carries the whole tree — refetch after every mutation.
  const fetchAttributes = useCallback(async () => {
    try {
      setAttributes(await itemAttributesAPI.getAll());
      setError("");
    } catch (err) {
      console.error("Error fetching item attributes:", err);
      setError("Failed to load attributes. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAttributes();
  }, [fetchAttributes]);

  const toggleExpand = (id) => {
    setExpandedId((current) => (current === id ? null : id));
    setNewValueText("");
    setRenamingValueId(null);
  };

  const handleAddAttribute = async (event) => {
    event.preventDefault();
    if (!newAttributeName.trim()) return;
    try {
      setError("");
      await itemAttributesAPI.create({ name: newAttributeName.trim() });
      setNewAttributeName("");
      flashSuccess("Attribute created successfully");
      fetchAttributes();
    } catch (err) {
      console.error("Error creating attribute:", err);
      setError(err.response?.data?.message || "Failed to create attribute.");
    }
  };

  const handleRenameAttribute = async (id) => {
    if (!renamingAttributeName.trim()) return;
    try {
      setError("");
      await itemAttributesAPI.update(id, { name: renamingAttributeName.trim() });
      setRenamingAttributeId(null);
      flashSuccess("Attribute renamed successfully");
      fetchAttributes();
    } catch (err) {
      console.error("Error renaming attribute:", err);
      setError(err.response?.data?.message || "Failed to rename attribute.");
    }
  };

  const handleAddValue = async (attributeId) => {
    if (!newValueText.trim()) return;
    try {
      setError("");
      await itemAttributesAPI.createValue(attributeId, { value: newValueText.trim() });
      setNewValueText("");
      flashSuccess("Value added successfully");
      fetchAttributes();
    } catch (err) {
      console.error("Error adding value:", err);
      setError(err.response?.data?.message || "Failed to add value.");
    }
  };

  const handleRenameValue = async (valueId) => {
    if (!renamingValueText.trim()) return;
    try {
      setError("");
      await itemAttributesAPI.updateValue(valueId, { value: renamingValueText.trim() });
      setRenamingValueId(null);
      flashSuccess("Value renamed successfully");
      fetchAttributes();
    } catch (err) {
      console.error("Error renaming value:", err);
      setError(err.response?.data?.message || "Failed to rename value.");
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      setError("");
      if (deleteTarget.kind === "attribute") {
        await itemAttributesAPI.delete(deleteTarget.id);
        flashSuccess("Attribute deleted successfully");
      } else {
        await itemAttributesAPI.deleteValue(deleteTarget.id);
        flashSuccess("Value deleted successfully");
      }
      fetchAttributes();
    } catch (err) {
      console.error("Error deleting:", err);
      // 409s carry the reason ("... being used by inventory items") — never swallow.
      setError(err.response?.data?.message || "Failed to delete.");
    } finally {
      setDeleteTarget(null);
    }
  };

  return (
    <div className="p-4 sm:p-6 space-y-5">
      {error && (
        <div className="rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 p-4 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {successMessage && (
        <div className="rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800/50 p-4 flex items-start gap-3">
          <FaCheckCircle className="text-green-500 mt-0.5 shrink-0" />
          <p className="text-sm text-green-700 dark:text-green-400">{successMessage}</p>
        </div>
      )}

      <div className="hidden sm:block">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-emerald-50">Item Attributes</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">GSM, colour, cut — and whatever comes next</p>
      </div>

      {/* Add attribute */}
      <form onSubmit={handleAddAttribute} className="flex gap-2">
        <input
          type="text"
          value={newAttributeName}
          onChange={(e) => setNewAttributeName(e.target.value)}
          placeholder="New attribute name…"
          className={`flex-1 ${inputClasses}`}
        />
        <button
          type="submit"
          disabled={!newAttributeName.trim()}
          className="flex items-center gap-2 min-h-[44px] px-4 rounded-xl bg-primary text-white text-sm font-semibold disabled:opacity-50"
        >
          <FaPlus className="w-3 h-3" /> Add
        </button>
      </form>

      {loading ? (
        <div className="py-16 text-center text-gray-500 dark:text-gray-400">Loading attributes…</div>
      ) : attributes.length === 0 ? (
        <div className="py-16 text-center">
          <FaSlidersH className="w-10 h-10 mx-auto mb-3 text-gray-300 dark:text-gray-600" />
          <p className="text-gray-500 dark:text-gray-400">No attributes yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {attributes.map((attribute) => {
            const expanded = expandedId === attribute.id;

            return (
              <div
                key={attribute.id}
                className="rounded-2xl border border-gray-200/60 dark:border-emerald-900/30 bg-white dark:bg-[#161d1a] overflow-hidden"
              >
                {/* Collapsed row */}
                <div className="flex items-center gap-2 p-3 pl-4">
                  {renamingAttributeId === attribute.id ? (
                    <>
                      <input
                        type="text"
                        value={renamingAttributeName}
                        onChange={(e) => setRenamingAttributeName(e.target.value)}
                        className={`flex-1 ${inputClasses}`}
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={() => handleRenameAttribute(attribute.id)}
                        className="flex items-center justify-center w-11 h-11 rounded-xl bg-primary text-white shrink-0"
                        aria-label="Save attribute name"
                      >
                        <FaCheck className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setRenamingAttributeId(null)}
                        className={`${iconButtonClasses} shrink-0`}
                        aria-label="Cancel rename"
                      >
                        <FaTimes className="w-3.5 h-3.5" />
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => toggleExpand(attribute.id)}
                        className="flex flex-1 items-center gap-3 min-h-[44px] text-left min-w-0"
                        aria-expanded={expanded}
                      >
                        {expanded ? (
                          <FaChevronDown className="w-3 h-3 shrink-0 text-gray-400" />
                        ) : (
                          <FaChevronRight className="w-3 h-3 shrink-0 text-gray-400" />
                        )}
                        <span className="font-medium text-gray-900 dark:text-emerald-50 truncate">{attribute.name}</span>
                        <span className="text-xs text-gray-500 dark:text-gray-400 shrink-0">
                          {attribute.values.length} value{attribute.values.length === 1 ? "" : "s"}
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setRenamingAttributeId(attribute.id);
                          setRenamingAttributeName(attribute.name);
                        }}
                        className={`${iconButtonClasses} shrink-0`}
                        aria-label={`Rename ${attribute.name}`}
                      >
                        <FaEdit className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteTarget({ kind: "attribute", id: attribute.id, label: attribute.name })}
                        className={`${dangerButtonClasses} shrink-0`}
                        aria-label={`Delete ${attribute.name}`}
                      >
                        <FaTrash className="w-3.5 h-3.5" />
                      </button>
                    </>
                  )}
                </div>

                {/* Expanded values */}
                {expanded && (
                  <div className="border-t border-gray-100 dark:border-emerald-900/20 p-3 pl-4 space-y-2">
                    {attribute.values.length === 0 && (
                      <p className="text-sm text-gray-500 dark:text-gray-400 py-2">No values yet</p>
                    )}

                    {attribute.values.map((value) => (
                      <div key={value.id} className="flex items-center gap-2">
                        {renamingValueId === value.id ? (
                          <>
                            <input
                              type="text"
                              value={renamingValueText}
                              onChange={(e) => setRenamingValueText(e.target.value)}
                              className={`flex-1 ${inputClasses}`}
                              autoFocus
                            />
                            <button
                              type="button"
                              onClick={() => handleRenameValue(value.id)}
                              className="flex items-center justify-center w-11 h-11 rounded-xl bg-primary text-white shrink-0"
                              aria-label="Save value"
                            >
                              <FaCheck className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setRenamingValueId(null)}
                              className={`${iconButtonClasses} shrink-0`}
                              aria-label="Cancel rename"
                            >
                              <FaTimes className="w-3.5 h-3.5" />
                            </button>
                          </>
                        ) : (
                          <>
                            <p className="flex-1 text-sm text-gray-700 dark:text-gray-300 truncate">{value.value}</p>
                            <button
                              type="button"
                              onClick={() => {
                                setRenamingValueId(value.id);
                                setRenamingValueText(value.value);
                              }}
                              className={`${iconButtonClasses} shrink-0`}
                              aria-label={`Rename ${value.value}`}
                            >
                              <FaEdit className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteTarget({ kind: "value", id: value.id, label: value.value })}
                              className={`${dangerButtonClasses} shrink-0`}
                              aria-label={`Delete ${value.value}`}
                            >
                              <FaTrash className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    ))}

                    {/* Add value */}
                    <div className="flex items-center gap-2 pt-1">
                      <input
                        type="text"
                        value={newValueText}
                        onChange={(e) => setNewValueText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleAddValue(attribute.id);
                          }
                        }}
                        placeholder="Add value…"
                        className={`flex-1 ${inputClasses}`}
                      />
                      <button
                        type="button"
                        onClick={() => handleAddValue(attribute.id)}
                        disabled={!newValueText.trim()}
                        className="flex items-center gap-2 min-h-[44px] px-4 rounded-xl bg-primary text-white text-sm font-semibold disabled:opacity-50 shrink-0"
                      >
                        <FaPlus className="w-3 h-3" /> Add
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <Link
        to="/inventory-items"
        className="inline-flex items-center gap-2 text-sm font-medium text-gray-600 dark:text-gray-400 min-h-[44px]"
      >
        <FaArrowLeft className="w-3 h-3" /> Back to Inventory Items
      </Link>

      <ConfirmationModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title={deleteTarget?.kind === "attribute" ? "Delete attribute" : "Delete value"}
        message={`Delete "${deleteTarget?.label}"? This cannot be undone.`}
        confirmText="Delete"
      />
    </div>
  );
};

export default ItemAttributes;
