import { forwardRef } from "react";
import { cn } from "../../lib/utils";

const Table = forwardRef(({ className, ...props }, ref) => (
  <div className="w-full overflow-x-auto -mx-3 sm:mx-0 rounded-xl">
    <table ref={ref} className={cn("w-full caption-bottom text-sm", className)} {...props} />
  </div>
));
Table.displayName = "Table";

const TableHeader = forwardRef(({ className, ...props }, ref) => (
  <thead
    ref={ref}
    className={cn(
      "bg-gray-50/80 dark:bg-gray-800/50 [&_tr]:border-b [&_tr]:border-gray-200/60 dark:[&_tr]:border-gray-700/60",
      className
    )}
    {...props}
  />
));
TableHeader.displayName = "TableHeader";

const TableBody = forwardRef(({ className, ...props }, ref) => (
  <tbody
    ref={ref}
    className={cn(
      "divide-y divide-gray-100 dark:divide-gray-800 [&_tr:last-child]:border-0",
      className
    )}
    {...props}
  />
));
TableBody.displayName = "TableBody";

const TableFooter = forwardRef(({ className, ...props }, ref) => (
  <tfoot
    ref={ref}
    className={cn(
      "bg-gray-50 dark:bg-gray-800/50 font-medium border-t border-gray-200 dark:border-gray-700",
      className
    )}
    {...props}
  />
));
TableFooter.displayName = "TableFooter";

const TableRow = forwardRef(({ className, ...props }, ref) => (
  <tr
    ref={ref}
    className={cn(
      "transition-colors hover:bg-gray-50/50 dark:hover:bg-gray-800/30 data-[state=selected]:bg-primary/5 dark:data-[state=selected]:bg-primary/10",
      className
    )}
    {...props}
  />
));
TableRow.displayName = "TableRow";

const TableHead = forwardRef(({ className, ...props }, ref) => (
  <th
    ref={ref}
    className={cn(
      "h-12 px-4 text-left align-middle text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 [&:has([role=checkbox])]:pr-0",
      className
    )}
    {...props}
  />
));
TableHead.displayName = "TableHead";

const TableCell = forwardRef(({ className, ...props }, ref) => (
  <td
    ref={ref}
    className={cn(
      "px-4 py-3.5 align-middle text-gray-700 dark:text-gray-300 [&:has([role=checkbox])]:pr-0",
      className
    )}
    {...props}
  />
));
TableCell.displayName = "TableCell";

const TableCaption = forwardRef(({ className, ...props }, ref) => (
  <caption
    ref={ref}
    className={cn("mt-4 text-sm text-gray-500 dark:text-gray-400", className)}
    {...props}
  />
));
TableCaption.displayName = "TableCaption";

export { Table, TableHeader, TableBody, TableFooter, TableHead, TableRow, TableCell, TableCaption };
