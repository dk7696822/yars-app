import { forwardRef } from 'react';
import { cn } from '../../lib/utils';
import { FaChevronDown } from 'react-icons/fa';

const Select = forwardRef(({ className, children, ...props }, ref) => {
  return (
    <div className="relative">
      <select
        ref={ref}
        className={cn(
          'appearance-none w-full h-10 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary pr-8',
          className
        )}
        {...props}
      >
        {children}
      </select>
      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-500 dark:text-gray-400">
        <FaChevronDown className="h-3 w-3" />
      </div>
    </div>
  );
});

Select.displayName = 'Select';

export default Select;
