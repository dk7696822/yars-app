import { useState, useRef, useEffect } from 'react';
import { FaChevronDown } from 'react-icons/fa';
import { cn } from '../../lib/utils';

const Dropdown = ({ 
  options, 
  value, 
  onChange, 
  placeholder = 'Select an option',
  className,
  id,
  name,
  required,
  label
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedOption, setSelectedOption] = useState(
    options.find(option => option.value === value) || null
  );
  const dropdownRef = useRef(null);

  useEffect(() => {
    const selectedOpt = options.find(option => option.value === value);
    setSelectedOption(selectedOpt || null);
  }, [value, options]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleOptionClick = (option) => {
    setSelectedOption(option);
    setIsOpen(false);
    if (onChange) {
      // Create a synthetic event similar to a native select
      const syntheticEvent = {
        target: {
          name,
          value: option.value
        }
      };
      onChange(syntheticEvent);
    }
  };

  return (
    <div className="relative w-full" ref={dropdownRef}>
      <div
        className={cn(
          "flex items-center justify-between w-full min-h-[44px] px-3 py-2 text-sm border rounded-xl cursor-pointer transition-colors",
          "border-gray-200 dark:border-emerald-900/40 bg-white dark:bg-[#161d1a]",
          "text-gray-900 dark:text-emerald-50 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary",
          isOpen && "ring-2 ring-primary border-primary",
          className
        )}
        onClick={() => setIsOpen(!isOpen)}
        tabIndex={0}
        role="combobox"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-controls={`${id}-options`}
        aria-labelledby={label ? `${id}-label` : undefined}
        id={id}
      >
        <span className={selectedOption ? "" : "text-gray-400 dark:text-gray-500"}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <FaChevronDown className={`h-4 w-4 text-gray-500 dark:text-gray-400 transition-transform ${isOpen ? 'transform rotate-180' : ''}`} />
      </div>
      
      {isOpen && (
        <ul
          className="absolute z-50 w-full mt-1 overflow-auto bg-white dark:bg-[#161d1a] border border-gray-200 dark:border-emerald-900/40 rounded-xl shadow-lg dark:shadow-black/40 max-h-60 animate-scale-in origin-top"
          role="listbox"
          id={`${id}-options`}
        >
          {options.map((option) => (
            <li
              key={option.value}
              className={cn(
                "px-3 py-2.5 cursor-pointer text-sm transition-colors",
                "hover:bg-gray-100 dark:hover:bg-emerald-500/10",
                selectedOption?.value === option.value
                  ? "bg-primary/10 dark:bg-primary/20 text-primary dark:text-emerald-400 font-medium"
                  : "text-gray-900 dark:text-gray-100"
              )}
              onClick={() => handleOptionClick(option)}
              role="option"
              aria-selected={selectedOption?.value === option.value}
            >
              {option.label}
            </li>
          ))}
          {options.length === 0 && (
            <li className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">
              No options available
            </li>
          )}
        </ul>
      )}
      
      {/* Hidden native select for form submission */}
      <select
        name={name}
        value={selectedOption?.value || ''}
        onChange={() => {}}
        required={required}
        className="sr-only"
        aria-hidden="true"
        tabIndex={-1}
      >
        <option value="">{placeholder}</option>
        {options.map(option => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
};

export default Dropdown;
