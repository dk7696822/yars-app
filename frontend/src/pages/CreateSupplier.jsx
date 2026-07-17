import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaArrowLeft } from "react-icons/fa";
import { supplierAPI } from "../services/inventoryAPI";

const inputClasses =
  "w-full min-h-[44px] px-3 rounded-xl border border-gray-200 dark:border-emerald-900/40 bg-white dark:bg-[#161d1a] text-gray-900 dark:text-emerald-50";

const CreateSupplier = () => {
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [gstNumber, setGstNumber] = useState("");
  const [address, setAddress] = useState("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");

    if (!name.trim()) {
      setError("Supplier name is required.");
      return;
    }

    try {
      setSaving(true);

      await supplierAPI.create({
        name: name.trim(),
        phone: phone.trim() || null,
        email: email.trim() || null,
        gst_number: gstNumber.trim() || null,
        address: address.trim() || null,
      });

      navigate("/suppliers", { state: { message: "Supplier created successfully" } });
    } catch (err) {
      console.error("Error creating supplier:", err);
      setError(err.response?.data?.message || "Failed to create supplier.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 pb-28 max-w-xl">
      <button
        type="button"
        onClick={() => navigate("/suppliers")}
        className="flex items-center gap-2 mb-4 text-sm text-gray-600 dark:text-gray-400 min-h-[44px]"
      >
        <FaArrowLeft className="w-3 h-3" /> Back
      </button>

      <h1 className="text-2xl font-bold text-gray-900 dark:text-emerald-50 mb-1">New Supplier</h1>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">Add a raw material supplier</p>

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
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Phone</label>
            <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className={inputClasses} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClasses} />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">GST number</label>
          <input type="text" value={gstNumber} onChange={(e) => setGstNumber(e.target.value)} className={inputClasses} />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Address</label>
          <textarea value={address} onChange={(e) => setAddress(e.target.value)} rows={2} className={`${inputClasses} py-2`} />
        </div>

        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/95 dark:bg-[#0f1a16]/95 backdrop-blur border-t border-gray-200 dark:border-emerald-900/30 sm:static sm:p-0 sm:bg-transparent sm:dark:bg-transparent sm:border-0 sm:backdrop-blur-none">
          <button
            type="submit"
            disabled={saving}
            className="w-full min-h-[52px] rounded-xl bg-primary text-white font-semibold disabled:opacity-50"
          >
            {saving ? "Saving…" : "Create supplier"}
          </button>
        </div>
      </form>
    </div>
  );
};

export default CreateSupplier;
