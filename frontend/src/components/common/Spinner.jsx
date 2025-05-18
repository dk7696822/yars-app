import PropTypes from 'prop-types';
import './Spinner.css';

const Spinner = ({ size, color }) => {
  return (
    <div className={`spinner spinner-${size} spinner-${color}`}>
      <div className="bounce1"></div>
      <div className="bounce2"></div>
      <div className="bounce3"></div>
    </div>
  );
};

Spinner.propTypes = {
  size: PropTypes.oneOf(['small', 'medium', 'large']),
  color: PropTypes.oneOf(['primary', 'secondary', 'white'])
};

Spinner.defaultProps = {
  size: 'medium',
  color: 'primary'
};

export default Spinner;
