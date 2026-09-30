import PropTypes from "prop-types";
import Button from "../../../ui/Button";
import LineCard from "./LineCard";
import { newLine } from "./draft";

export default function ItemsStep({ draft, update, sizes, errors, onSaveSizeWeight }) {
  const setLine = (i, next) => update((d) => ({ lines: d.lines.map((l, j) => (j === i ? next : l)) }));
  const removeLine = (i) => update((d) => ({ lines: d.lines.filter((_, j) => j !== i) }));
  return (
    <div className="space-y-3">
      {draft.lines.map((line, i) => (
        <LineCard key={line.key} line={line} index={i} sizes={sizes} errors={errors.lines?.[i] || {}}
          onChange={(next) => setLine(i, next)} onRemove={() => removeLine(i)} canRemove={draft.lines.length > 1} onSaveSizeWeight={onSaveSizeWeight} />
      ))}
      <Button variant="secondary" block onClick={() => update((d) => ({ lines: [...d.lines, newLine()] }))}>＋ Add another size</Button>
    </div>
  );
}

ItemsStep.propTypes = { draft: PropTypes.object.isRequired, update: PropTypes.func.isRequired, sizes: PropTypes.array.isRequired, errors: PropTypes.object.isRequired, onSaveSizeWeight: PropTypes.func.isRequired };
