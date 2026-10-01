import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import PropTypes from "prop-types";
import { Plus, ArrowLeft, Trash2, SendHorizontal, Sparkles } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { assistantAPI, streamMessage } from "../../services/assistantAPI";
import Button from "../../ui/Button";
import IconButton from "../../ui/IconButton";
import ConfirmDialog from "../../ui/ConfirmDialog";
import { ListSkeleton } from "../../ui/States";
import { relativeTime } from "../../utils/relativeTime";
import { useToast } from "../../context/ToastContext";
import { errorText } from "../../lib/errors";
import { ASSISTANT_NAME } from "../../app/assistant";
import ActionCard from "./ActionCard";
import { attachActions, replaceAction, keysAfter } from "./cardState";

const SUGGESTIONS = ["Who owes me the most?", "What were sales this month?", "Record a payment", "Start a new order"];

// Links to app paths become in-app buttons; tables scroll inside the bubble.
function AssistantMarkdown({ text }) {
  const navigate = useNavigate();
  return (
    <div className="space-y-2 text-sm leading-relaxed [&_code]:rounded [&_code]:bg-canvas/60 [&_code]:px-1 [&_code]:text-xs [&_ol]:list-decimal [&_ol]:space-y-1 [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={{
        table: ({ children }) => <div className="-mx-1 my-1 overflow-x-auto rounded-xl border border-line"><table className="min-w-full border-collapse text-xs">{children}</table></div>,
        thead: ({ children }) => <thead className="bg-canvas/50">{children}</thead>,
        th: ({ children }) => <th className="whitespace-nowrap border-b border-line px-3 py-2 text-left font-semibold">{children}</th>,
        td: ({ children }) => <td className="whitespace-nowrap border-b border-line/50 px-3 py-2 align-top last:border-b-0">{children}</td>,
        a: ({ href, children }) => href?.startsWith("/") ? (
          <button type="button" onClick={() => navigate(href)} className="my-1 inline-flex min-h-[36px] items-center gap-1 rounded-xl bg-brass/15 px-3 text-sm font-semibold text-brass">{children} →</button>
        ) : <a href={href} target="_blank" rel="noreferrer" className="text-brass underline">{children}</a>,
      }}>{text}</ReactMarkdown>
    </div>
  );
}
AssistantMarkdown.propTypes = { text: PropTypes.string.isRequired };

// On touch devices Return inserts a newline; sending is the button's job.
const isCoarsePointer = typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches;
const isDesktop = () => typeof window !== "undefined" && window.matchMedia?.("(min-width: 1024px)").matches;

// Where the layout viewport doesn't shrink with the keyboard, the visual viewport does.
const useVisualViewportHeight = () => {
  const [height, setHeight] = useState(null);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return undefined;
    const update = () => setHeight(vv.height);
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => { vv.removeEventListener("resize", update); vv.removeEventListener("scroll", update); };
  }, []);
  return height;
};

function Hero() {
  return (
    <div className="rounded-3xl bg-gradient-to-b from-raised to-surface p-5 shadow-[inset_0_1px_0_rgb(var(--c-brass)/0.25)]">
      <div className="flex items-center gap-4">
        <div className="relative grid h-14 w-14 shrink-0 place-items-center">
          <span aria-hidden="true" className="assistant-ring absolute inset-0 rounded-full bg-brass/40" />
          <div className="assistant-float relative grid h-12 w-12 place-items-center rounded-full bg-brass text-brass-on"><Sparkles className="h-5 w-5" /></div>
        </div>
        <div>
          <h1 className="text-xl font-bold text-ink">Hi, I’m {ASSISTANT_NAME} 👋</h1>
          <p className="text-sm text-ink-2">Ask about dues, orders, stock or expenses. I can also prepare a payment, a customer, an order or a status change — you check it and tap Confirm.</p>
        </div>
      </div>
    </div>
  );
}

const withLast = (list, change) => {
  const next = [...list];
  next[next.length - 1] = change(next[next.length - 1]);
  return next;
};

export default function AssistantPage() {
  const toast = useToast();
  const qc = useQueryClient();
  const [conversations, setConversations] = useState([]);
  const [listLoading, setListLoading] = useState(true);
  const [activeId, setActiveId] = useState(null);
  const [draft, setDraft] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [statusLine, setStatusLine] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);
  const viewportHeight = useVisualViewportHeight();
  const desktop = isDesktop();

  const loadConversations = useCallback(async () => {
    try {
      const res = await assistantAPI.listConversations({ limit: 50 });
      setConversations(res.data.data.data);
    } catch {
      /* the list shows empty; opening still works */
    } finally {
      setListLoading(false);
    }
  }, []);
  useEffect(() => { loadConversations(); }, [loadConversations]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, statusLine]);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return undefined;
    const onResize = () => bottomRef.current?.scrollIntoView({ block: "end" });
    vv.addEventListener("resize", onResize);
    return () => vv.removeEventListener("resize", onResize);
  }, []);

  const openConversation = async (id) => {
    try {
      const res = await assistantAPI.getConversation(id);
      const conv = res.data.data;
      setActiveId(id);
      setDraft(false);
      setMessages(attachActions(conv.messages.map((m) => ({ id: m.id, role: m.role, content: m.content })), conv.actions || []));
    } catch {
      toast.error("Couldn't open that conversation. Try again.");
    }
  };
  // Nothing is created on the server until the first message is sent.
  const startNew = () => { setActiveId(null); setMessages([]); setDraft(true); };
  const backToList = () => { setActiveId(null); setDraft(false); setMessages([]); loadConversations(); };
  const handleDelete = async () => {
    const target = deleteTarget;
    setDeleteTarget(null);
    try {
      await assistantAPI.deleteConversation(target.id);
      if (target.id === activeId) startNew();
      loadConversations();
    } catch {
      toast.error("Couldn't delete the conversation. Try again.");
    }
  };

  /** Confirm or cancel a card; the server's answer replaces it in place. */
  const actOn = async (kind, action) => {
    try {
      const res = kind === "confirm" ? await assistantAPI.confirmAction(action.id) : await assistantAPI.cancelAction(action.id);
      const updated = res.data.data;
      setMessages((prev) => replaceAction(prev, updated));
      if (updated.status === "confirmed" && kind === "confirm") {
        toast.success("Saved");
        await Promise.all(keysAfter(updated.name).map((queryKey) => qc.invalidateQueries({ queryKey })));
      } else if (updated.status === "failed") {
        toast.error(updated.error || "Couldn't save. Ask again.");
      }
    } catch (err) {
      toast.error(errorText(err, "That didn't work. Check your connection and try again."));
    }
  };

  const send = async (typed) => {
    const text = (typed ?? input).trim();
    if (!text || streaming) return;
    let id = activeId;
    if (!id) {
      try {
        const res = await assistantAPI.createConversation();
        id = res.data.data.id;
        setActiveId(id);
      } catch {
        toast.error(`Couldn't reach ${ASSISTANT_NAME}. Check your internet and try again.`);
        return;
      }
    }
    setInput("");
    if (inputRef.current) inputRef.current.style.height = "auto";
    setStreaming(true);
    setMessages((prev) => [...prev, { role: "user", content: text, actions: [] }, { role: "assistant", content: "", actions: [] }]);
    await streamMessage(id, text, {
      onDelta: (t) => setMessages((prev) => withLast(prev, (m) => ({ ...m, content: m.content + t }))),
      onStatus: (t) => setStatusLine(t),
      onAction: (a) => setMessages((prev) => withLast(prev, (m) => ({ ...m, actions: [...(m.actions || []), a] }))),
      onDone: () => { setStatusLine(null); loadConversations(); },
      onError: (msg) => setMessages((prev) => withLast(prev, (m) => ({ ...m, content: `⚠️ ${msg}` }))),
    });
    setStatusLine(null);
    setStreaming(false);
  };

  const list = (
    <div className="space-y-2">
      <h2 className="px-1 text-xs font-semibold text-ink-2">Recent conversations</h2>
      {listLoading ? <ListSkeleton rows={4} /> : conversations.length === 0 ? (
        <p className="px-1 py-3 text-sm text-ink-2">Nothing yet — start a conversation.</p>
      ) : (
        <ul className="overflow-hidden rounded-2xl bg-surface">
          {conversations.map((c) => (
            <li key={c.id} className={`flex items-center gap-1 border-b border-line/60 last:border-0 ${c.id === activeId ? "bg-raised" : ""}`}>
              <button type="button" onClick={() => openConversation(c.id)} className="min-w-0 flex-1 px-4 py-3 text-left hover:bg-raised/60 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brass">
                <span className="block truncate text-sm font-semibold text-ink">{c.title}</span>
                <span className="block text-xs text-ink-2">{relativeTime(c.updated_at)}</span>
              </button>
              <IconButton label={`Delete conversation ${c.title}`} onClick={() => setDeleteTarget(c)} className="mr-2 h-9 w-9 bg-transparent text-ink-2"><Trash2 className="h-4 w-4" /></IconButton>
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  const lastMessage = messages[messages.length - 1];
  const showTyping = streaming && lastMessage?.role === "assistant" && lastMessage.content === "" && !lastMessage.actions?.length;
  const chat = (
    <>
      <div className="flex items-center gap-2 border-b border-line/70 px-3 py-3">
        {!desktop && <IconButton label="Back to conversations" onClick={backToList} className="bg-transparent"><ArrowLeft className="h-5 w-5" /></IconButton>}
        <h1 className="flex-1 font-num text-base font-semibold text-ink">{ASSISTANT_NAME}</h1>
        {desktop && <Button size="sm" variant="secondary" onClick={startNew}><Plus className="h-4 w-4" aria-hidden="true" />New</Button>}
      </div>
      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.length === 0 && (
          <div className="space-y-4">
            {desktop && <Hero />}
            <p className="text-sm text-ink-2">Try:</p>
            <div className="flex flex-wrap gap-2">
              {SUGGESTIONS.map((s) => (
                <button key={s} type="button" onClick={() => send(s)} className="rounded-full border border-line bg-surface px-3.5 py-2 text-left text-sm font-medium text-ink hover:border-brass focus-visible:outline focus-visible:outline-2 focus-visible:outline-brass">{s}</button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, i) => (m.role === "user" ? (
          <div key={m.id || i} className="flex justify-end"><div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-brass px-4 py-2.5 text-sm text-brass-on">{m.content}</div></div>
        ) : (
          <div key={m.id || i} className="flex justify-start">
            <div className="max-w-[85%] rounded-2xl rounded-bl-md border border-line/70 bg-surface px-4 py-2.5 text-ink">
              {m.content === "" && showTyping && i === messages.length - 1 ? (
                <span className="inline-flex gap-1 py-1" aria-label={`${ASSISTANT_NAME} is typing`}>
                  {[0, 150, 300].map((d) => <span key={d} className="h-1.5 w-1.5 animate-bounce rounded-full bg-ink-2" style={{ animationDelay: `${d}ms` }} />)}
                </span>
              ) : m.content ? <AssistantMarkdown text={m.content} /> : null}
              {(m.actions || []).map((a) => (
                <ActionCard key={a.id} action={a} onConfirm={(x) => actOn("confirm", x)} onCancel={(x) => actOn("cancel", x)} />
              ))}
            </div>
          </div>
        )))}
        {statusLine && <p className="pl-2 text-xs italic text-ink-2">{statusLine}</p>}
        <div ref={bottomRef} />
      </div>
      <div className="bg-canvas px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2">
        <div className="flex items-end gap-1.5 rounded-[26px] border border-line bg-surface px-2 py-1.5 transition focus-within:border-brass/60 focus-within:ring-2 focus-within:ring-brass/20">
          <textarea ref={inputRef} value={input} rows={1} placeholder={`Ask ${ASSISTANT_NAME}…`} aria-label={`Message ${ASSISTANT_NAME}`}
            onChange={(e) => { setInput(e.target.value); e.target.style.height = "auto"; e.target.style.height = `${Math.min(e.target.scrollHeight, 96)}px`; }}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !isCoarsePointer) { e.preventDefault(); send(); } }}
            onFocus={() => setTimeout(() => bottomRef.current?.scrollIntoView({ block: "end" }), 300)}
            className="max-h-24 min-h-[40px] flex-1 resize-none border-0 bg-transparent px-3 py-2 text-base text-ink outline-none placeholder:text-ink-2 focus:ring-0 lg:text-sm" />
          <button type="button" aria-label="Send" onClick={() => send()} disabled={streaming || !input.trim()}
            className="mb-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brass text-brass-on transition active:scale-90 disabled:opacity-35">
            <SendHorizontal className="h-4 w-4" />
          </button>
        </div>
      </div>
    </>
  );

  const confirm = (
    <ConfirmDialog open={Boolean(deleteTarget)} title="Delete conversation?" message={`“${deleteTarget?.title || ""}” will be removed from your history.`}
      confirmLabel="Delete" cancelLabel="Keep it" onConfirm={handleDelete} onClose={() => setDeleteTarget(null)} />
  );

  if (desktop) {
    return (
      <div className="mx-auto grid h-[calc(100dvh-6rem)] max-w-6xl grid-cols-[18rem_1fr] gap-4 px-6 py-4">
        <aside className="space-y-3 overflow-y-auto"><Button block onClick={startNew}><Plus className="h-4 w-4" aria-hidden="true" />New conversation</Button>{list}</aside>
        <section className="flex min-h-0 flex-col overflow-hidden rounded-3xl bg-surface/40">{chat}</section>
        {confirm}
      </div>
    );
  }
  if (activeId === null && !draft) {
    return (
      <div className="mx-auto max-w-2xl space-y-5 p-4">
        <Hero />
        <Button block size="lg" onClick={startNew}><Plus className="h-4 w-4" aria-hidden="true" />Start a new conversation</Button>
        {list}
        {confirm}
      </div>
    );
  }
  // Phones: portaled to <body> — the page-enter wrapper's transform would trap position:fixed.
  return createPortal(
    <div className="fixed inset-x-0 top-0 z-50 flex flex-col bg-canvas" style={{ height: viewportHeight ? `${viewportHeight}px` : "100dvh" }}>{chat}</div>,
    document.body,
  );
}
