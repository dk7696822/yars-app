import { Link } from 'react-router-dom';
import { FaEdit, FaTrash, FaTag, FaCalendarAlt } from 'react-icons/fa';
import { formatDate } from '../../utils/formatters';
import MobileActionDropdown from '../ui/MobileActionDropdown';

const ExpenseCategoryList = ({ categories, onDelete }) => {
  if (!categories || categories.length === 0) {
    return (
      <div className="rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700/50 p-8 text-center">
        <p className="text-gray-500 dark:text-gray-400">No expense categories found. Create your first category to get started.</p>
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Mobile Card View */}
      <div className="block md:hidden space-y-3">
        {categories.map((category) => (
          <div
            key={category.id}
            className="bg-white dark:bg-gray-800/60 rounded-xl border border-gray-200 dark:border-gray-700/50 overflow-hidden"
          >
            {/* Card Header */}
            <div className="p-4 border-b border-gray-100 dark:border-gray-700/50">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-500/20 flex items-center justify-center">
                    <FaTag className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-semibold text-gray-900 dark:text-gray-100 truncate">{category.name}</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1 mt-0.5">
                      <FaCalendarAlt className="w-3 h-3" />
                      {formatDate(category.created_at)}
                    </p>
                  </div>
                </div>
                <MobileActionDropdown
                  actions={[
                    { title: "Edit", icon: FaEdit, iconColor: "text-blue-500 dark:text-blue-400", to: `/expense-categories/edit/${category.id}` },
                    { title: "Delete", icon: FaTrash, iconColor: "text-red-500 dark:text-red-400", onClick: () => onDelete(category.id) },
                  ]}
                />
              </div>
            </div>

            {/* Card Footer - Quick Actions */}
            <div className="px-4 py-3 bg-gray-50/50 dark:bg-gray-900/30 border-t border-gray-100 dark:border-gray-700/50 flex gap-2">
              <Link
                to={`/expense-categories/edit/${category.id}`}
                className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-blue-50 dark:bg-blue-500/10 text-xs font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-500/20 transition-colors"
              >
                <FaEdit className="w-3 h-3" />
                Edit
              </Link>
              <button
                onClick={() => onDelete(category.id)}
                className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-red-50 dark:bg-red-500/10 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-500/20 transition-colors"
              >
                <FaTrash className="w-3 h-3" />
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block overflow-x-auto rounded-xl">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-gray-50/80 dark:bg-gray-800/50">
              <th className="h-12 px-4 text-left align-middle text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 border-b border-gray-200/60 dark:border-gray-700/60">Name</th>
              <th className="h-12 px-4 text-left align-middle text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 border-b border-gray-200/60 dark:border-gray-700/60">Created At</th>
              <th className="h-12 px-4 text-right align-middle text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 border-b border-gray-200/60 dark:border-gray-700/60">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
            {categories.map((category) => (
              <tr key={category.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-colors">
                <td className="p-4 align-middle">
                  <div className="flex items-center gap-3">
                    <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-purple-100 dark:bg-purple-500/20 flex items-center justify-center">
                      <FaTag className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                    </div>
                    <span className="font-medium text-gray-900 dark:text-gray-100">{category.name}</span>
                  </div>
                </td>
                <td className="p-4 align-middle text-gray-600 dark:text-gray-400">{formatDate(category.created_at)}</td>
                <td className="p-4 align-middle text-right">
                  <MobileActionDropdown
                    actions={[
                      { title: "Edit", icon: FaEdit, iconColor: "text-blue-500 dark:text-blue-400", to: `/expense-categories/edit/${category.id}` },
                      { title: "Delete", icon: FaTrash, iconColor: "text-red-500 dark:text-red-400", onClick: () => onDelete(category.id) },
                    ]}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ExpenseCategoryList;
