import PropTypes from "prop-types";
import { Link } from "react-router-dom";
import { FaEdit, FaTrash } from "react-icons/fa";
import { formatCurrency } from "../../utils/formatters";

const PlateTypeList = ({ plateTypes, onDelete }) => {
  if (!plateTypes || plateTypes.length === 0) {
    return (
      <div className="rounded-md bg-gray-100 dark:bg-gray-800 p-8 text-center">
        <p className="text-gray-500 dark:text-gray-400">No plate types found. Create a new plate type to get started.</p>
      </div>
    );
  }

  return (
    <div className="w-full overflow-x-auto rounded-md">
      <table className="w-full border-collapse bg-white dark:bg-gray-800">
        <thead>
          <tr>
            <th className="h-12 px-4 text-left align-middle font-medium text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">Type Name</th>
            <th className="h-12 px-4 text-left align-middle font-medium text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">Charge</th>
            <th className="h-12 px-4 text-right align-middle font-medium text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
          {plateTypes.map((plateType) => (
            <tr key={plateType.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
              <td className="p-4 align-middle font-medium text-gray-900 dark:text-gray-300">{plateType.type_name}</td>
              <td className="p-4 align-middle text-gray-900 dark:text-gray-300">{formatCurrency(plateType.charge)}</td>
              <td className="p-4 align-middle text-right">
                <div className="flex justify-end space-x-2">
                  <Link
                    to={`/plate-types/edit/${plateType.id}`}
                    title="Edit"
                    className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 p-0 text-sm font-medium transition-colors hover:bg-gray-100 dark:hover:bg-gray-600"
                  >
                    <FaEdit className="h-4 w-4 text-blue-500 dark:text-blue-400" />
                  </Link>
                  <button
                    onClick={() => onDelete(plateType.id)}
                    title="Delete"
                    className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 p-0 text-sm font-medium transition-colors hover:bg-gray-100 dark:hover:bg-gray-600"
                  >
                    <FaTrash className="h-4 w-4 text-red-500 dark:text-red-400" />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

PlateTypeList.propTypes = {
  plateTypes: PropTypes.array.isRequired,
  onDelete: PropTypes.func.isRequired,
};

export default PlateTypeList;
