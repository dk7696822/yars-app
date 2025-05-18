import PropTypes from 'prop-types';

const Alert = ({ type, message }) => {
  if (!message) return null;
  
  return (
    <div className={`alert alert-${type}`}>
      {message}
    </div>
  );
};

Alert.propTypes = {
  type: PropTypes.oneOf(['success', 'danger', 'warning', 'info']),
  message: PropTypes.string
};

Alert.defaultProps = {
  type: 'info',
  message: ''
};

export default Alert;
