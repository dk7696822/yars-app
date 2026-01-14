import { Link } from 'react-router-dom';
import { FaHome, FaArrowLeft } from 'react-icons/fa';

const NotFound = () => {
  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        {/* 404 Text with gradient */}
        <div className="relative mb-6">
          <h1 className="text-[150px] md:text-[180px] font-bold text-gray-100 dark:text-gray-800 font-display leading-none select-none">
            404
          </h1>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-6xl md:text-7xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent font-display">
              404
            </span>
          </div>
        </div>

        {/* Message */}
        <h2 className="text-xl md:text-2xl font-semibold text-gray-900 dark:text-white font-display mb-3">
          Page Not Found
        </h2>
        <p className="text-gray-500 dark:text-gray-400 mb-8">
          The page you are looking for doesn't exist or has been moved to another location.
        </p>

        {/* Action buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            to="/"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-white hover:bg-primary-700 shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 transition-all active:scale-95"
          >
            <FaHome className="w-4 h-4" />
            Go to Dashboard
          </Link>
          <button
            onClick={() => window.history.back()}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-6 py-3 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all active:scale-95"
          >
            <FaArrowLeft className="w-4 h-4" />
            Go Back
          </button>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
