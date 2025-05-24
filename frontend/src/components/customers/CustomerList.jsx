import PropTypes from "prop-types";
import { Link } from "react-router-dom";
import { FaEye, FaEdit, FaTrash } from "react-icons/fa";
import { formatDate } from "../../utils/formatters";
import MobileActionDropdown from "../ui/MobileActionDropdown";

const CustomerList = ({ customers, onDelete }) => {
  if (!customers || customers.length === 0) {
    return (
      <div className="rounded-md bg-gray-100 dark:bg-gray-800 p-8 text-center">
        <p className="text-gray-500 dark:text-gray-400">No customers found. Create a new customer to get started.</p>
      </div>
    );
  }

  return (
    <div className="w-full overflow-x-auto rounded-md">
      <table className="w-full border-collapse bg-white dark:bg-gray-800">
        <thead>
          <tr>
            <th className="h-12 px-4 text-left align-middle font-medium text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">Name</th>
            <th className="h-12 px-4 text-left align-middle font-medium text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">Email</th>
            <th className="h-12 px-4 text-left align-middle font-medium text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">Phone</th>
            <th className="h-12 px-4 text-left align-middle font-medium text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">Created At</th>
            <th className="h-12 px-4 text-right align-middle font-medium text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
          {customers.map((customer) => (
            <tr key={customer.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
              <td className="p-4 align-middle font-medium text-gray-900 dark:text-gray-300">{customer.name}</td>
              <td className="p-4 align-middle text-gray-900 dark:text-gray-300">
                {customer.metadata?.email ? (
                  <a href={`mailto:${customer.metadata.email}`} className="text-blue-500 hover:underline">
                    {customer.metadata.email}
                  </a>
                ) : (
                  <span className="text-gray-500 dark:text-gray-400">N/A</span>
                )}
              </td>
              <td className="p-4 align-middle text-gray-900 dark:text-gray-300">
                {customer.metadata?.phone ? (
                  <a href={`tel:${customer.metadata.phone}`} className="text-blue-500 hover:underline">
                    {customer.metadata.phone}
                  </a>
                ) : (
                  <span className="text-gray-500 dark:text-gray-400">N/A</span>
                )}
              </td>
              <td className="p-4 align-middle text-gray-900 dark:text-gray-300">{formatDate(customer.created_at)}</td>
              <td className="p-4 align-middle text-right">
                <MobileActionDropdown
                  actions={[
                    {
                      title: "View Orders",
                      icon: FaEye,
                      iconColor: "text-gray-600 dark:text-gray-300",
                      to: `/customers/${customer.id}`,
                    },
                    {
                      title: "Edit",
                      icon: FaEdit,
                      iconColor: "text-blue-500 dark:text-blue-400",
                      to: `/customers/edit/${customer.id}`,
                    },
                    {
                      title: "Delete",
                      icon: FaTrash,
                      iconColor: "text-red-500 dark:text-red-400",
                      onClick: () => onDelete(customer.id),
                    },
                  ]}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

CustomerList.propTypes = {
  customers: PropTypes.array.isRequired,
  onDelete: PropTypes.func.isRequired,
};

export default CustomerList;
