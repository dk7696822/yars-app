import PropTypes from 'prop-types';

const ResponsiveTable = ({ children, className = '' }) => {
  return (
    <div className={`w-full ${className}`}>
      {/* Desktop view */}
      <div className="hidden md:block overflow-x-auto">
        {children}
      </div>
      
      {/* Mobile view - you can customize this based on your needs */}
      <div className="md:hidden">
        {children}
      </div>
    </div>
  );
};

ResponsiveTable.propTypes = {
  children: PropTypes.node.isRequired,
  className: PropTypes.string,
};

export default ResponsiveTable;
