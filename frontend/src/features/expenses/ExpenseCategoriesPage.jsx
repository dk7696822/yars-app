import { Link } from "react-router-dom";
import { useExpenseCategories, useCategoryMutations } from "./api";
import PageHeader from "../../ui/PageHeader";
import NameListEditor from "../../ui/NameListEditor";
import { ErrorState, ListSkeleton } from "../../ui/States";

export default function ExpenseCategoriesPage() {
  const categories = useExpenseCategories();
  const { add, rename, remove } = useCategoryMutations();
  return (
    <div className="mx-auto max-w-xl px-4 py-4 sm:px-6">
      <PageHeader title="Expense categories" subtitle={<Link to="/expenses" className="text-brass">← Expenses</Link>} />
      <div className="mt-4">
        {categories.isPending ? <ListSkeleton rows={4} /> : categories.isError ? <ErrorState title="Couldn't load categories." onRetry={() => categories.refetch()} /> : (
          <NameListEditor items={categories.data} onAdd={add} onRename={rename} onDelete={remove} noun="category"
            addPlaceholder="New category, e.g. Diesel" emptyText="No categories yet — add the kinds of spending you track." />
        )}
      </div>
    </div>
  );
}
