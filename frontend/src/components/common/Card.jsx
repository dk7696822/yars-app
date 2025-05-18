import PropTypes from 'prop-types';
import './Card.css';

const Card = ({ title, children, className }) => {
  return (
    <div className={`card ${className}`}>
      {title && <div className="card-header">{title}</div>}
      <div className="card-body">{children}</div>
    </div>
  );
};

Card.propTypes = {
  title: PropTypes.node,
  children: PropTypes.node.isRequired,
  className: PropTypes.string
};

Card.defaultProps = {
  className: ''
};

export default Card;
