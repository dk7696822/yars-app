import PropTypes from "prop-types";
import { Link } from "react-router-dom";

const ActionButton = ({ to, onClick, title, icon: Icon, iconColor = "text-gray-600 dark:text-gray-300" }) => {
  const buttonClasses = "inline-flex h-9 w-9 items-center justify-center rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 p-0 text-sm font-medium transition-colors hover:bg-gray-100 dark:hover:bg-gray-600";
  
  if (to) {
    return (
      <Link to={to} title={title} className={buttonClasses}>
        <Icon className={`h-4 w-4 ${iconColor}`} />
      </Link>
    );
  }
  
  return (
    <button onClick={onClick} title={title} className={buttonClasses}>
      <Icon className={`h-4 w-4 ${iconColor}`} />
    </button>
  );
};

ActionButton.propTypes = {
  to: PropTypes.string,
  onClick: PropTypes.func,
  title: PropTypes.string.isRequired,
  icon: PropTypes.elementType.isRequired,
  iconColor: PropTypes.string,
};

export default ActionButton;
