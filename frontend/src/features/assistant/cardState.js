import { MONEY_KEYS } from "../../lib/queryKeys";

const NOTE = {
  confirmed: "Saved",
  cancelled: "Cancelled — ask again if you need it",
  expired: "Expired — ask again",
  completed_in_form: "Finished in the form",
};
const TONE = { pending: "info", confirmed: "good", cancelled: "muted", expired: "muted", failed: "critical", completed_in_form: "good" };

/** What a card shows and allows, from the server's state (a pending card past its time counts as expired). */
export const cardState = (action, now = Date.now()) => {
  const left = new Date(action.expiresAt).getTime() - now;
  const status = action.status === "pending" && left <= 0 ? "expired" : action.status;
  return {
    status,
    canAct: status === "pending",
    canOpenForm: (status === "pending" || status === "expired") && Boolean(action.formLink),
    note: status === "pending" ? `Expires in ${Math.max(1, Math.ceil(left / 60000))} min` : status === "failed" ? action.error || "Couldn't save — ask again" : NOTE[status],
    tone: TONE[status] || "muted",
  };
};

/** Put each card under the reply it came with; a card with no reply goes under the last reply. */
export const attachActions = (messages, actions) => {
  const out = messages.map((m) => ({ ...m, actions: actions.filter((a) => a.messageId && a.messageId === m.id) }));
  const placed = new Set(out.flatMap((m) => m.actions.map((a) => a.id)));
  const loose = actions.filter((a) => !placed.has(a.id));
  if (!loose.length) return out;
  const lastReply = [...out].reverse().find((m) => m.role === "assistant");
  if (lastReply) lastReply.actions = [...lastReply.actions, ...loose];
  else out.push({ role: "assistant", content: "", actions: loose });
  return out;
};

export const replaceAction = (messages, updated) =>
  messages.map((m) => (m.actions?.some((a) => a.id === updated.id) ? { ...m, actions: m.actions.map((a) => (a.id === updated.id ? updated : a)) } : m));

/** Cached screens to refresh after a card is saved: every phase-1 action changes money screens. */
export const keysAfter = () => MONEY_KEYS;
