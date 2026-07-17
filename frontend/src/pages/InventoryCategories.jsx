import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { FaPlus, FaSearch, FaCheckCircle, FaTags, FaArrowLeft, FaEdit, FaTrash, FaTimes, FaCheck } from "react-icons/fa";
import { inventoryCategoryAPI } from "../services/inventoryAPI";
import ConfirmationModal from "../components/common/ConfirmationModal";

const inputClasses =
  "min-h-[44px] px-3 rounded-xl border border-gray-200 dark:border-emerald-900/40 bg-white dark:bg-[#161d1a] text-sm text-gray-900 dark:text-emerald-50";

const InventoryCategories = () => {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);

  const flashSuccess = (message) => {
    setSuccessMessage(message);
    setTimeout(() => setSuccessMessage(""), 4000);
  };

  const fetchCategories = useCallback(async () => {
    try {
      setLoading(true);
      setCategories(await inventoryCategoryAPI.getAll());
      setError("");
    } catch (err) {
      console.error("Error fetching inventory categories:", err);
      setError("Failed to load categories. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const filtered = searchTerm.trim()
    ? categories.filter((category) => category.name.toLowerCase().includes(searchTerm.toLowerCase()))
    : categories;

  const handleAdd = async (event) => {
    event.preventDefault();
    if (!newName.trim()) return;
    try {
      setAdding(true);
      setError("");
      await inventoryCategoryAPI.create({ name: newName.trim() });
      setNewName("");
      flashSuccess("Category created successfully");
      fetchCategories();
    } catch (err) {
      console.error("Error creating category:", err);
      setError(err.response?.data?.message || "Failed to create category.");
    } finally {
      setAdding(false);
    }
  };

  const startEdit = (category) => {
    setEditingId(category.id);
    setEditingName(category.name);
  };

  const handleRename = async (id) => {
    if (!editingName.trim()) return;
    try {
      setError("");
      await inventoryCategoryAPI.update(id, { name: editingName.trim() });
      setEditingId(null);
      flashSuccess("Category renamed successfully");
      fetchCategories();
    } catch (err) {
      console.error("Error renaming category:", err);
      setError(err.response?.data?.message || "Failed to rename category.");
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      setError("");
      await inventoryCategoryAPI.delete(deleteTarget.id);
      flashSuccess("Category deleted successfully");
      fetchCategories();
    } catch (err) {
      console.error("Error deleting category:", err);
      // e.g. "Cannot delete this category as it is being used by inventory items"
      setError(err.response?.data?.message || "Failed to delete category.");
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
        <h1 className="text-2xl font-bold text-gray-900 dark:text-emerald-50">Inventory Categories</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">Group raw materials for filtering</p>
      </div>

      {/* Inline add */}
      <form onSubmit={handleAdd} className="flex gap-2">
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="New category name…"
          className={`flex-1 ${inputClasses}`}
        />
        <button
          type="submit"
          disabled={adding || !newName.trim()}
          className="flex items-center gap-2 min-h-[44px] px-4 rounded-xl bg-primary text-white text-sm font-semibold disabled:opacity-50"
        >
          <FaPlus className="w-3 h-3" /> Add
        </button>
      </form>

      <div className="relative">
        <FaSearch className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search categories…"
          className={`w-full pl-11 pr-4 ${inputClasses}`}
        />
      </div>

      {loading ? (
        <div className="py-16 text-center text-gray-500 dark:text-gray-400">Loading categories…</div>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center">
          <FaTags className="w-10 h-10 mx-auto mb-3 text-gray-300 dark:text-gray-600" />
          <p className="text-gray-500 dark:text-gray-400">
            {searchTerm ? "No categories match your search" : "No categories yet"}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((category) => (
            <div
              key={category.id}
              className="flex items-center justify-between gap-3 rounded-2xl border border-gray-200/60 dark:border-emerald-900/30 bg-white dark:bg-[#161d1a] p-3 pl-4"
            >
              {editingId === category.id ? (
                <>
                  <input
                    type="text"
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    className={`flex-1 ${inputClasses}`}
                    autoFocus
                  />
                  <div className="flex shrink-0 gap-2">
                    <button
                      type="button"
                      onClick={() => handleRename(category.id)}
                      className="flex items-center justify-center w-11 h-11 rounded-xl bg-primary text-white"
                      aria-label="Save name"
                    >
                      <FaCheck className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      className="flex items-center justify-center w-11 h-11 rounded-xl border border-gray-200 dark:border-emerald-900/40 text-gray-600 dark:text-emerald-100"
                      aria-label="Cancel edit"
                    >
                      <FaTimes className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <p className="font-medium text-gray-900 dark:text-emerald-50 truncate">{category.name}</p>
                  <div className="flex shrink-0 gap-2">
                    <button
                      type="button"
                      onClick={() => startEdit(category)}
                      className="flex items-center justify-center w-11 h-11 rounded-xl border border-gray-200 dark:border-emerald-900/40 text-gray-600 dark:text-emerald-100"
                      aria-label={`Rename ${category.name}`}
                    >
                      <FaEdit className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(category)}
                      className="flex items-center justify-center w-11 h-11 rounded-xl border border-red-200 dark:border-red-500/30 text-red-600 dark:text-red-400"
                      aria-label={`Delete ${category.name}`}
                    >
                      <FaTrash className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
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
        title="Delete category"
        message={`Delete "${deleteTarget?.name}"? This cannot be undone.`}
        confirmText="Delete"
      />
    </div>
  );
};

export default InventoryCategories;
