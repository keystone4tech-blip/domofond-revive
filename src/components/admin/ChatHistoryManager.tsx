import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, MessageSquare, ArrowLeft, Clock, User, Bot } from "lucide-react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";

type Conversation = {
  id: string;
  session_id: string;
  started_at: string;
  last_message_at: string;
  messages_count: number;
  status: string;
};

type ChatMessage = {
  id: string;
  role: string;
  content: string;
  created_at: string;
};

export function ChatHistoryManager() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConv, setSelectedConv] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);

  useEffect(() => {
    loadConversations();
  }, []);

  const loadConversations = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("chat_conversations")
      .select("*")
      .order("last_message_at", { ascending: false });
    if (data) setConversations(data);
    if (error) console.error(error);
    setLoading(false);
  };

  const loadMessages = async (convId: string) => {
    setLoadingMessages(true);
    setSelectedConv(convId);
    const { data, error } = await supabase
      .from("chat_messages")
      .select("*")
      .eq("conversation_id", convId)
      .order("created_at", { ascending: true });
    if (data) setMessages(data);
    if (error) console.error(error);
    setLoadingMessages(false);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (selectedConv) {
    const conv = conversations.find((c) => c.id === selectedConv);
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={() => { setSelectedConv(null); setMessages([]); }}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Назад к списку
        </Button>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Диалог от {conv ? format(new Date(conv.started_at), "d MMM yyyy, HH:mm", { locale: ru }) : ""}
            </CardTitle>
            <p className="text-xs text-muted-foreground">Сессия: {conv?.session_id.slice(0, 8)}…</p>
          </CardHeader>
          <CardContent>
            {loadingMessages ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            ) : messages.length === 0 ? (
              <p className="text-center text-muted-foreground py-4">Нет сообщений</p>
            ) : (
              <div className="space-y-3 max-h-[60vh] overflow-y-auto">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex gap-2 ${msg.role === "user" ? "justify-end" : ""}`}
                  >
                    {msg.role === "assistant" && (
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10">
                        <Bot className="h-4 w-4 text-primary" />
                      </div>
                    )}
                    <div
                      className={`rounded-2xl px-3 py-2 text-sm max-w-[80%] whitespace-pre-wrap ${
                        msg.role === "user"
                          ? "bg-primary text-primary-foreground rounded-tr-sm"
                          : "bg-muted rounded-tl-sm"
                      }`}
                    >
                      {msg.content}
                      <div className={`text-[10px] mt-1 ${msg.role === "user" ? "text-primary-foreground/60" : "text-muted-foreground"}`}>
                        {format(new Date(msg.created_at), "HH:mm")}
                      </div>
                    </div>
                    {msg.role === "user" && (
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted">
                        <User className="h-4 w-4 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            История чатов
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Все диалоги пользователей с AI-помощником. Нажмите на диалог, чтобы просмотреть переписку.
          </p>
        </CardHeader>
        <CardContent>
          {conversations.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Пока нет диалогов</p>
          ) : (
            <div className="space-y-2">
              {conversations.map((conv) => (
                <button
                  key={conv.id}
                  onClick={() => loadMessages(conv.id)}
                  className="w-full text-left rounded-xl border p-3 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <MessageSquare className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium text-sm">
                        Сессия {conv.session_id.slice(0, 8)}…
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground bg-muted rounded-full px-2 py-0.5">
                      {conv.messages_count} сообщ.
                    </span>
                  </div>
                  <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {format(new Date(conv.started_at), "d MMM yyyy, HH:mm", { locale: ru })}
                    {conv.last_message_at !== conv.started_at && (
                      <span> — посл. {format(new Date(conv.last_message_at), "HH:mm")}</span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
