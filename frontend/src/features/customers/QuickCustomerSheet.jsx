import { useState } from "react";
import PropTypes from "prop-types";
import Sheet from "../../ui/Sheet";
import Field from "../../ui/Field";
import TextInput from "../../ui/TextInput";
import PhoneInput from "../../ui/PhoneInput";
import Button from "../../ui/Button";
import SimilarWarning from "./SimilarWarning";
import { useSaveCustomer } from "./api";
import { emptyCustomer, validateCustomer, toCustomerPayload } from "./customerForm";
import { errorText } from "../../lib/errors";

/** Name + mobile only, from inside a form; the rest can be added on the customer's page. Mount with a new key per opening. */
export default function QuickCustomerSheet({ open, initialName = "", onClose, onCreated }) {
  const [name, setName] = useState(initialName);
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const save = useSaveCustomer();

  const submit = () => {
    const f = { ...emptyCustomer(), name, phone };
    const errs = validateCustomer(f);
    if (errs.name) {
      setError(errs.name);
      return;
    }
    save.mutate(toCustomerPayload(f), { onSuccess: (c) => onCreated({ id: c.id, name: c.name, phone: c.metadata?.phone || null, due: 0 }) });
  };

  return (
    <Sheet open={open} title="Quick new customer" onClose={onClose}
      footer={
        <div className="space-y-2">
          {save.isError && <p role="alert" className="text-sm text-status-critical">{errorText(save.error, "Couldn't save the customer. Try again.")}</p>}
          <Button block size="lg" loading={save.isPending} onClick={submit}>Save &amp; choose</Button>
        </div>
      }>
      <div className="space-y-4">
        <Field label="Shop / customer name" htmlFor="quick-name" error={error}>
          <TextInput autoFocus value={name} onChange={(e) => { setName(e.target.value); setError(""); }} autoCapitalize="words" />
        </Field>
        <SimilarWarning name={name} onPick={(c) => onCreated(c)} />
        <Field label="Mobile" htmlFor="quick-phone" optional hint="Add the rest later from the customer's page">
          <PhoneInput value={phone} onChange={setPhone} />
        </Field>
      </div>
    </Sheet>
  );
}

QuickCustomerSheet.propTypes = { open: PropTypes.bool.isRequired, initialName: PropTypes.string, onClose: PropTypes.func.isRequired, onCreated: PropTypes.func.isRequired };
