import PropTypes from "prop-types";
import Sheet from "./Sheet";
import Button from "./Button";

export default function ConfirmDialog({ open, title, message, confirmLabel, cancelLabel = "Go back", tone = "danger", busy = false, onConfirm, onClose }) {
  const close = () => { if (!busy) onClose(); };
  return (
    <Sheet open={open} title={title} onClose={close}
      footer={
        <div className="flex gap-2">
          <Button variant="secondary" block onClick={close} disabled={busy}>{cancelLabel}</Button>
          <Button variant={tone === "danger" ? "danger" : "primary"} block loading={busy} onClick={onConfirm}>{confirmLabel}</Button>
        </div>
      }>
      <p className="text-sm leading-relaxed text-ink-2">{message}</p>
    </Sheet>
  );
}

ConfirmDialog.propTypes = {
  open: PropTypes.bool.isRequired, title: PropTypes.string.isRequired, message: PropTypes.node.isRequired,
  confirmLabel: PropTypes.string.isRequired, cancelLabel: PropTypes.string, tone: PropTypes.oneOf(["danger", "primary"]),
  busy: PropTypes.bool, onConfirm: PropTypes.func.isRequired, onClose: PropTypes.func.isRequired,
};
