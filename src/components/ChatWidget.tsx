import { useState, useEffect, useRef, useCallback } from "react";
import { MessageCircle, X, Send, Loader2, Bot } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import ReactMarkdown from "react-markdown";

type Msg = { role: "user" | "assistant" | "tool"; content: string; tool_call_id?: string };

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`;

function getSessionId() {
  let id = sessionStorage.getItem("chat_session_id");
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem("chat_session_id", id);
  }
  return id;
}

export default function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [autoOpened, setAutoOpened] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [welcomeMessage, setWelcomeMessage] = useState("Здравствуйте! 👋 Чем могу помочь?");
  const [isActive, setIsActive] = useState(true);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [userContext, setUserContext] = useState<{
    isAuthenticated: boolean;
    isVerified: boolean;
    fullName?: string;
    address?: string;
    apartment?: string;
    phone?: string;
  }>({ isAuthenticated: false, isVerified: false });
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    supabase
      .from("chat_widget_settings")
      .select("welcome_message, is_active")
      .limit(1)
      .single()
      .then(({ data }) => {
        if (data) {
          setWelcomeMessage(data.welcome_message || welcomeMessage);
          setIsActive(data.is_active);
        }
      });
  }, []);

  // Track auth state and load profile (verification status)
  useEffect(() => {
    const loadProfile = async (userId: string) => {
      const { data } = await supabase
        .from("profiles")
        .select("full_name, address, apartment, phone, is_verified")
        .eq("id", userId)
        .maybeSingle();
      setUserContext({
        isAuthenticated: true,
        isVerified: !!data?.is_verified,
        fullName: data?.full_name || undefined,
        address: data?.address || undefined,
        apartment: data?.apartment || undefined,
        phone: data?.phone || undefined,
      });
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session?.user) {
        setTimeout(() => loadProfile(session.user.id), 0);
      } else {
        setUserContext({ isAuthenticated: false, isVerified: false });
      }
    });
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) loadProfile(session.user.id);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!isActive) return;
    const timer = setTimeout(() => {
      if (!autoOpened) {
        setOpen(true);
        setAutoOpened(true);
      }
    }, 5000);
    return () => clearTimeout(timer);
  }, [isActive, autoOpened]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const ensureConversation = useCallback(async () => {
    if (conversationId) return conversationId;
    const sessionId = getSessionId();
    const { data, error } = await supabase
      .from("chat_conversations")
      .insert({ session_id: sessionId })
      .select("id")
      .single();
    if (error || !data) {
      console.error("Failed to create conversation:", error);
      return null;
    }
    setConversationId(data.id);
    return data.id;
  }, [conversationId]);

  const saveMessage = async (convId: string, role: string, content: string) => {
    await supabase.from("chat_messages").insert({ conversation_id: convId, role, content });
    await supabase
      .from("chat_conversations")
      .update({ last_message_at: new Date().toISOString(), messages_count: messages.length + 1 })
      .eq("id", convId);
  };

  const executeToolCall = async (name: string, args: Record<string, string>) => {
    try {
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ tool_results: [{ name, arguments: args }], user_context: userContext }),
      });
      const data = await resp.json();
      return data.tool_response;
    } catch {
      return { success: false, error: "Ошибка сети" };
    }
  };

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || isLoading) return;
    setInput("");

    const userMsg: Msg = { role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);

    const convId = await ensureConversation();
    if (convId) saveMessage(convId, "user", text);

    await streamAI([...messages, userMsg], convId);
  }, [input, isLoading, messages, ensureConversation]);

  const streamAI = async (allMessages: Msg[], convId: string | null) => {
    let assistantSoFar = "";
    let toolCalls: { id: string; name: string; arguments: string }[] = [];

    try {
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ messages: allMessages.filter(m => m.role !== "tool" || m.tool_call_id), user_context: userContext }),
      });

      if (!resp.ok || !resp.body) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || "Ошибка соединения");
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = "";

      const upsert = (chunk: string) => {
        assistantSoFar += chunk;
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last?.role === "assistant") {
            return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: assistantSoFar } : m));
          }
          return [...prev, { role: "assistant", content: assistantSoFar }];
        });
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });

        let nl: number;
        while ((nl = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, nl);
          textBuffer = textBuffer.slice(nl + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const json = line.slice(6).trim();
          if (json === "[DONE]") break;
          try {
            const parsed = JSON.parse(json);
            const choice = parsed.choices?.[0];
            const delta = choice?.delta;
            if (delta?.content) upsert(delta.content);
            
            // Handle tool calls
            if (delta?.tool_calls) {
              for (const tc of delta.tool_calls) {
                if (tc.index !== undefined) {
                  if (!toolCalls[tc.index]) {
                    toolCalls[tc.index] = { id: tc.id || "", name: "", arguments: "" };
                  }
                  if (tc.id) toolCalls[tc.index].id = tc.id;
                  if (tc.function?.name) toolCalls[tc.index].name = tc.function.name;
                  if (tc.function?.arguments) toolCalls[tc.index].arguments += tc.function.arguments;
                }
              }
            }
          } catch {
            textBuffer = line + "\n" + textBuffer;
            break;
          }
        }
      }

      // Process tool calls if any
      if (toolCalls.length > 0) {
        for (const tc of toolCalls) {
          if (!tc.name) continue;
          try {
            const args = JSON.parse(tc.arguments);
            
            if (tc.name === "submit_request") {
              setMessages(prev => {
                const filtered = prev.filter(m => m.role === "user" || (m.role === "assistant" && m.content));
                return [...filtered, { role: "assistant", content: "⏳ Отправляю заявку..." }];
              });
              
              const result = await executeToolCall(tc.name, args);
              
              const toolResultMsg: Msg = {
                role: "assistant",
                content: result.success
                  ? `✅ Заявка успешно создана! Имя: ${args.name}, Телефон: ${args.phone}, Адрес: ${args.address}. Мы свяжемся с вами в ближайшее время.`
                  : `❌ Не удалось отправить заявку. Попробуйте позже или позвоните нам.`,
              };
              
              setMessages(prev => {
                const filtered = prev.filter(m => !(m.role === "assistant" && m.content === "⏳ Отправляю заявку..."));
                return [...filtered, toolResultMsg];
              });
              
              if (convId) saveMessage(convId, "assistant", toolResultMsg.content);
            }
            
            if (tc.name === "check_account") {
              setMessages(prev => {
                const filtered = prev.filter(m => m.role === "user" || (m.role === "assistant" && m.content));
                return [...filtered, { role: "assistant", content: "🔍 Ищу информацию..." }];
              });
              
              const result = await executeToolCall(tc.name, args);
              
              // Format period MMYY → "Месяц YYYY"
              const formatPeriod = (period: string | null | undefined): string => {
                if (!period) return "не указан";
                const months = ["", "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь", "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"];
                if (/^\d{4}$/.test(period)) {
                  const m = parseInt(period.substring(0, 2), 10);
                  const y = "20" + period.substring(2);
                  return `${months[m] || period.substring(0, 2)} ${y}`;
                }
                if (/^\d{1,2}$/.test(period)) {
                  const m = parseInt(period, 10);
                  return months[m] || period;
                }
                return period;
              };

              // Build a tool result message and call AI again to format a nice response
              const toolResultContent = result.success && result.accounts?.length > 0
                ? result.accounts.map((a: any) => `Лицевой счёт: ${a.account_number}, Адрес: ${a.address}, Период начисления: ${formatPeriod(a.period)}, Задолженность: ${a.debt_amount} руб.`).join("\n")
                : result.message || "Записи не найдены.";
              
              // Remove loading message and add the result directly
              const resultMsg: Msg = { role: "assistant", content: toolResultContent };
              setMessages(prev => {
                const filtered = prev.filter(m => !(m.role === "assistant" && m.content === "🔍 Ищу информацию..."));
                return [...filtered, resultMsg];
              });
              
              if (convId) saveMessage(convId, "assistant", toolResultContent);
            }
          } catch (e) {
            console.error("Tool call error:", e);
          }
        }
        setIsLoading(false);
        return;
      }

      // Save assistant response
      if (convId && assistantSoFar) {
        saveMessage(convId, "assistant", assistantSoFar);
      }
    } catch (e: unknown) {
      const errorMsg = e instanceof Error ? e.message : "Ошибка";
      setMessages((prev) => [...prev, { role: "assistant", content: `⚠️ ${errorMsg}` }]);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isActive) return null;

  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-20 right-4 lg:bottom-6 lg:right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-xl hover:scale-105 transition-transform animate-bounce"
          aria-label="Открыть чат"
        >
          <MessageCircle className="h-6 w-6" />
        </button>
      )}

      {open && (
        <div className="fixed bottom-20 right-2 left-2 sm:left-auto sm:right-4 sm:bottom-20 lg:bottom-6 lg:right-6 z-50 w-auto sm:w-[380px] max-h-[70vh] flex flex-col rounded-2xl border border-border bg-background shadow-2xl overflow-hidden animate-in slide-in-from-bottom-4 fade-in duration-300">
          <div className="flex items-center justify-between gap-2 bg-primary px-4 py-3 text-primary-foreground">
            <div className="flex items-center gap-2">
              <Bot className="h-5 w-5" />
              <span className="font-semibold text-sm">Помощник Домофондар</span>
            </div>
            <button onClick={() => setOpen(false)} className="rounded-full p-1 hover:bg-primary-foreground/20 transition-colors">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3 min-h-[200px] max-h-[50vh]">
            <div className="flex gap-2">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10">
                <Bot className="h-4 w-4 text-primary" />
              </div>
              <div className="rounded-2xl rounded-tl-sm bg-muted px-3 py-2 text-sm max-w-[85%]">
                {welcomeMessage}
              </div>
            </div>

            {messages.filter(m => m.role !== "tool").map((msg, i) => (
              <div key={i} className={`flex gap-2 ${msg.role === "user" ? "justify-end" : ""}`}>
                {msg.role === "assistant" && (
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10">
                    <Bot className="h-4 w-4 text-primary" />
                  </div>
                )}
                <div
                  className={`rounded-2xl px-3 py-2 text-sm max-w-[85%] ${
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground rounded-tr-sm"
                      : "bg-muted rounded-tl-sm"
                  }`}
                >
                  {msg.role === "assistant" ? (
                    <div className="prose prose-sm dark:prose-invert max-w-none [&>p]:m-0 [&>ul]:m-0 [&>ol]:m-0 [&>p+p]:mt-1">
                      <ReactMarkdown
                        components={{
                          a: ({ href, children }) => (
                            <a
                              href={href}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary underline hover:text-primary/80"
                            >
                              {children}
                            </a>
                          ),
                        }}
                      >{msg.content}</ReactMarkdown>
                    </div>
                  ) : (
                    <span className="whitespace-pre-wrap">{msg.content}</span>
                  )}
                </div>
              </div>
            ))}

            {isLoading && messages[messages.length - 1]?.role !== "assistant" && (
              <div className="flex gap-2">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10">
                  <Bot className="h-4 w-4 text-primary" />
                </div>
                <div className="rounded-2xl rounded-tl-sm bg-muted px-3 py-2">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              </div>
            )}
          </div>

          <div className="border-t p-2">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                sendMessage();
              }}
              className="flex gap-2"
            >
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Напишите сообщение..."
                className="flex-1 rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                disabled={isLoading}
              />
              <Button type="submit" size="icon" disabled={isLoading || !input.trim()} className="rounded-xl shrink-0">
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
