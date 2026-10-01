import { useQuery } from "@tanstack/react-query";
import { assistantAPI } from "../../services/assistantAPI";
import { keys } from "../../lib/queryKeys";

/** One card, for "Open in form". Off when there is no id. */
export const useAssistantAction = (id) =>
  useQuery({
    queryKey: keys.assistant.action(id),
    queryFn: () => assistantAPI.getAction(id).then((r) => r.data.data),
    enabled: Boolean(id),
    staleTime: Infinity,
    retry: false,
  });

/** Tell the server the person finished this card in the form. Never blocks or fails the save. */
export const reportFinishedInForm = (id, resultId, saved) => {
  if (!id) return;
  assistantAPI.completedInForm(id, { result_id: resultId, saved }).catch(() => {});
};
