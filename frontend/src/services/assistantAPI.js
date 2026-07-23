import axios from "axios";
import { attachAuthInterceptors, TOKEN_KEY } from "./api";

const API_URL = import.meta.env.VITE_API_URL;

const client = axios.create({
  baseURL: API_URL,
  headers: { "Content-Type": "application/json" },
});
attachAuthInterceptors(client);

export const assistantAPI = {
  listConversations: (params) => client.get("/assistant/conversations", { params }),
  createConversation: () => client.post("/assistant/conversations"),
  getConversation: (id) => client.get(`/assistant/conversations/${id}`),
  deleteConversation: (id) => client.delete(`/assistant/conversations/${id}`),
};

/**
 * Stream a message via SSE-over-fetch (EventSource cannot POST or send the
 * Authorization header). Calls the handlers as events arrive; resolves when
 * the stream ends.
 */
export const streamMessage = async (conversationId, text, { onDelta, onStatus, onDone, onError }) => {
  const token = localStorage.getItem(TOKEN_KEY);
  let response;
  try {
    response = await fetch(`${API_URL}/assistant/conversations/${conversationId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ text }),
    });
  } catch {
    onError?.("Could not reach the server. Check your connection.");
    return;
  }

  if (response.status === 401) {
    localStorage.removeItem(TOKEN_KEY);
    window.location.assign("/login");
    return;
  }
  if (!response.ok || !response.body) {
    onError?.("The assistant is unavailable right now.");
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  const handleBlock = (block) => {
    let event = "message";
    let data = "";
    for (const line of block.split("\n")) {
      if (line.startsWith("event: ")) event = line.slice(7).trim();
      else if (line.startsWith("data: ")) data += line.slice(6);
    }
    if (!data) return;
    let payload;
    try {
      payload = JSON.parse(data);
    } catch {
      return;
    }
    if (event === "delta") onDelta?.(payload.text);
    else if (event === "status") onStatus?.(payload.text);
    else if (event === "done") onDone?.(payload);
    else if (event === "error") onError?.(payload.message);
  };

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let idx;
    while ((idx = buffer.indexOf("\n\n")) !== -1) {
      handleBlock(buffer.slice(0, idx));
      buffer = buffer.slice(idx + 2);
    }
  }
};
