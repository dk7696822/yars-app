import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { FaPlus, FaArrowLeft, FaTrash, FaPaperPlane, FaMagic } from "react-icons/fa";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { assistantAPI, streamMessage } from "../services/assistantAPI";
import { CardListSkeleton } from "../components/common/Skeleton";
import ConfirmationModal from "../components/common/ConfirmationModal";

// Renders markdown; links to app-relative paths become in-app nav buttons.
const AssistantMarkdown = ({ text }) => {
  const navigate = useNavigate();
  return (
    <div className="assistant-markdown text-sm leading-relaxed space-y-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:space-y-1 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1 [&_code]:text-xs [&_code]:bg-black/10 dark:[&_code]:bg-white/10 [&_code]:rounded [&_code]:px-1">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // Tables: scroll horizontally instead of breaking the bubble width,
          // with readable bordered rows on a 390px screen.
          table: ({ children }) => (
            <div className="overflow-x-auto -mx-1 my-1 rounded-lg border border-gray-200 dark:border-emerald-900/40">
              <table className="min-w-full text-xs border-collapse">{children}</table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-gray-50 dark:bg-emerald-950/30">{children}</thead>
          ),
          th: ({ children }) => (
            <th className="text-left font-semibold px-3 py-2 border-b border-gray-200 dark:border-emerald-900/40 whitespace-nowrap">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="px-3 py-2 border-b border-gray-100 dark:border-emerald-900/20 last:border-b-0 align-top whitespace-nowrap">
              {children}
            </td>
          ),
          a: ({ href, children }) =>
            href?.startsWith("/") ? (
              <button
                type="button"
                onClick={() => navigate(href)}
                className="inline-flex items-center gap-1 min-h-[36px] px-3 my-1 rounded-lg bg-primary/10 dark:bg-primary/20 text-primary text-sm font-semibold active:scale-95 transition-all"
              >
                {children} →
              </button>
            ) : (
              <a href={href} target="_blank" rel="noreferrer" className="text-primary underline">
                {children}
              </a>
            ),
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
};

// On touch devices the keyboard's return key must insert a newline, not send —
// sending is the button's job. Desktop keeps Enter-to-send (Shift+Enter = newline).
const isCoarsePointer =
  typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches;

const isDesktop = () =>
  typeof window !== "undefined" && window.matchMedia?.("(min-width: 1024px)").matches;

// The keyboard-proof height for the chat overlay: on browsers where the layout
// viewport doesn't shrink with the keyboard (iOS < 16, some Androids), the
// visualViewport does — so we size the chat to it directly.
const useVisualViewportHeight = () => {
  const [height, setHeight] = useState(null);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => setHeight(vv.height);
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, []);
  return height;
};

const Assistant = () => {
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

  const loadConversations = useCallback(async () => {
    try {
      const res = await assistantAPI.listConversations({ limit: 50 });
      setConversations(res.data.data.data);
    } catch (err) {
      console.error("Error loading conversations:", err);
    } finally {
      setListLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, statusLine]);

  // When the mobile keyboard opens/closes the visual viewport resizes and the
  // conversation would stay scrolled behind it — follow it to the bottom.
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const onResize = () => bottomRef.current?.scrollIntoView({ block: "end" });
    vv.addEventListener("resize", onResize);
    return () => vv.removeEventListener("resize", onResize);
  }, []);

  const openConversation = async (id) => {
    const res = await assistantAPI.getConversation(id);
    setActiveId(id);
    setMessages(res.data.data.messages.map((m) => ({ role: m.role, content: m.content })));
  };

  // Opens an empty chat WITHOUT creating anything server-side — the
  // conversation row is created on first send (send() handles activeId null),
  // so abandoned "New" taps never litter the history.
  const startNew = () => {
    setActiveId(null);
    setMessages([]);
    setDraft(true);
  };

  const backToList = () => {
    setActiveId(null);
    setDraft(false);
    setMessages([]);
    loadConversations();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await assistantAPI.deleteConversation(deleteTarget.id);
      loadConversations();
    } catch (err) {
      console.error("Error deleting conversation:", err);
    } finally {
      setDeleteTarget(null);
    }
  };

  const send = async () => {
    const text = input.trim();
    if (!text || streaming) return;
    let id = activeId;
    if (!id) {
      const res = await assistantAPI.createConversation();
      id = res.data.data.id;
      setActiveId(id);
    }
    setInput("");
    if (inputRef.current) inputRef.current.style.height = "auto";
    setStreaming(true);
    setMessages((prev) => [...prev, { role: "user", content: text }, { role: "assistant", content: "" }]);

    await streamMessage(id, text, {
      onDelta: (t) =>
        setMessages((prev) => {
          const next = [...prev];
          next[next.length - 1] = { ...next[next.length - 1], content: next[next.length - 1].content + t };
          return next;
        }),
      onStatus: (t) => setStatusLine(t),
      onDone: () => {
        setStatusLine(null);
        loadConversations();
      },
      onError: (msg) =>
        setMessages((prev) => {
          const next = [...prev];
          next[next.length - 1] = { role: "assistant", content: `⚠️ ${msg}` };
          return next;
        }),
    });
    setStatusLine(null);
    setStreaming(false);
  };

  const relativeTime = (iso) => {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  // ---------- View 1: conversation list ----------
  if (activeId === null && !draft) {
    return (
      <div className="p-4 sm:p-6 space-y-5 max-w-2xl mx-auto">
        {/* Hero */}
        <div className="relative overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/15 via-primary/5 to-transparent p-5">
          <div className="flex items-center gap-4">
            <div className="relative flex items-center justify-center h-14 w-14 shrink-0">
              <span aria-hidden className="jarvis-ring absolute inset-0 rounded-full bg-primary/40" />
              <div className="jarvis-float relative flex items-center justify-center h-12 w-12 rounded-full bg-primary text-white shadow-lg shadow-primary/30">
                <FaMagic className="w-5 h-5" />
              </div>
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-emerald-50">Hi, I’m Jarvis 👋</h1>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                I can look up your live business data — pending payments, stock levels, orders,
                expenses — and guide you step-by-step through anything in the app. Ask me in
                English, Hindi, or Hinglish.
              </p>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={startNew}
          className="w-full flex items-center justify-center gap-2 min-h-[48px] rounded-2xl bg-primary text-white text-sm font-semibold shadow-lg shadow-primary/25 active:scale-[0.98] transition-all"
        >
          <FaPlus className="w-3 h-3" />
          Start a new conversation
        </button>

        {/* Recent conversations */}
        <div className="space-y-2 pt-1">
          <h2 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            Recent conversations
          </h2>
          {listLoading ? (
            <CardListSkeleton />
          ) : conversations.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400 py-3">
              Nothing yet — start a conversation above.
            </p>
          ) : (
            <div className="space-y-2">
              {conversations.map((c) => (
              <div
                key={c.id}
                className="flex items-center gap-3 rounded-xl border border-gray-200 dark:border-emerald-900/40 bg-white dark:bg-[#161d1a] p-4"
              >
                <button type="button" onClick={() => openConversation(c.id)} className="flex-1 min-w-0 text-left">
                  <p className="text-sm font-medium text-gray-900 dark:text-emerald-50 truncate">{c.title}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{relativeTime(c.updated_at)}</p>
                </button>
                <button
                  type="button"
                  aria-label="Delete conversation"
                  onClick={() => setDeleteTarget(c)}
                  className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                >
                  <FaTrash className="w-3.5 h-3.5" />
                </button>
              </div>
              ))}
            </div>
          )}
        </div>

        <ConfirmationModal
          isOpen={!!deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onConfirm={handleDelete}
          title="Delete conversation?"
          message={`“${deleteTarget?.title}” will be removed from your history.`}
        />
      </div>
    );
  }

  // ---------- View 2: chat ----------
  const lastMessage = messages[messages.length - 1];
  const showTyping = streaming && lastMessage?.role === "assistant" && lastMessage.content === "";

  const chatInner = (
    <>
      <div className="flex items-center gap-3 p-4 border-b border-gray-200 dark:border-emerald-900/40">
        <button
          type="button"
          aria-label="Back to conversations"
          onClick={backToList}
          className="p-2 -ml-2 text-gray-500 dark:text-gray-400"
        >
          <FaArrowLeft className="w-4 h-4" />
        </button>
        <h1 className="text-base font-semibold text-gray-900 dark:text-emerald-50">Jarvis</h1>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((m, i) =>
          m.role === "user" ? (
            <div key={i} className="flex justify-end">
              <div className="max-w-[85%] rounded-2xl rounded-br-md bg-primary text-white px-4 py-2.5 text-sm whitespace-pre-wrap">
                {m.content}
              </div>
            </div>
          ) : (
            <div key={i} className="flex justify-start">
              <div className="max-w-[85%] rounded-2xl rounded-bl-md bg-gray-100 dark:bg-[#161d1a] border border-gray-200 dark:border-emerald-900/40 text-gray-900 dark:text-emerald-50 px-4 py-2.5">
                {m.content === "" && showTyping ? (
                  <span className="inline-flex gap-1 py-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce [animation-delay:0ms]" />
                    <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce [animation-delay:150ms]" />
                    <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce [animation-delay:300ms]" />
                  </span>
                ) : (
                  <AssistantMarkdown text={m.content} />
                )}
              </div>
            </div>
          )
        )}
        {statusLine && (
          <p className="text-xs italic text-gray-500 dark:text-gray-400 pl-2">{statusLine}</p>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="px-3 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] bg-gray-50 dark:bg-[#0d1210]">
        <div className="flex items-end gap-1.5 rounded-[26px] border border-gray-200 dark:border-emerald-900/40 bg-white dark:bg-[#161d1a] shadow-sm px-2 py-1.5 focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/15 transition-all">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              // auto-grow up to the max height, shrink back when cleared
              e.target.style.height = "auto";
              e.target.style.height = `${Math.min(e.target.scrollHeight, 96)}px`;
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !isCoarsePointer) {
                e.preventDefault();
                send();
              }
            }}
            onFocus={() => setTimeout(() => bottomRef.current?.scrollIntoView({ block: "end" }), 300)}
            rows={1}
            placeholder="Ask Jarvis…"
            className="flex-1 resize-none max-h-24 min-h-[40px] px-3 py-2 bg-transparent border-0 outline-none focus:ring-0 text-base lg:text-sm text-gray-900 dark:text-emerald-50 placeholder:text-gray-400 dark:placeholder:text-gray-500"
          />
          <button
            type="button"
            aria-label="Send"
            onClick={send}
            disabled={streaming || !input.trim()}
            className="mb-0.5 flex items-center justify-center h-9 w-9 shrink-0 rounded-full bg-primary text-white shadow-md shadow-primary/25 disabled:opacity-35 disabled:shadow-none active:scale-90 transition-all"
          >
            <FaPaperPlane className="w-3.5 h-3.5 -translate-x-px" />
          </button>
        </div>
      </div>
    </>
  );

  // Desktop: embedded in the normal layout. Phones: PORTALED to <body> — the
  // page-enter wrapper animates a CSS transform, and a transformed ancestor
  // becomes the containing block for position:fixed, which trapped the overlay
  // inside the scroll area. The portal escapes the layout tree entirely; the
  // overlay is sized to the visual viewport so the input rides the keyboard.
  if (isDesktop()) {
    return <div className="flex flex-col h-[calc(100dvh-6rem)]">{chatInner}</div>;
  }
  return createPortal(
    <div
      className="fixed inset-x-0 top-0 z-50 flex flex-col bg-gray-50 dark:bg-[#0d1210]"
      style={{ height: viewportHeight ? `${viewportHeight}px` : "100dvh" }}
    >
      {chatInner}
    </div>,
    document.body
  );
};

export default Assistant;
