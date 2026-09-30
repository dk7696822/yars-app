import PropTypes from "prop-types";

/** Sticks to the bottom of the scrolling page. In-flow (`sticky`), so it works inside the transformed page wrapper. */
export default function StickyFooter({ children }) {
  return (
    <div className="sticky bottom-0 z-20 -mx-4 mt-6 border-t border-line bg-surface/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur sm:-mx-6 sm:px-6">
      {children}
    </div>
  );
}

StickyFooter.propTypes = { children: PropTypes.node };
