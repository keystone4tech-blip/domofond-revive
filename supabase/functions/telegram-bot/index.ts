import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Создаем клиент с service_role для полного доступа к БД
const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
);

interface TelegramMessage {
  message_id: number;
  from: {
    id: number;
    first_name: string;
    username?: string;
  };
  chat: {
    id: number;
    type: string;
  };
  text?: string;
}

interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
}

// Функция отправки сообщения в Telegram
async function sendTelegramMessage(chatId: number, text: string, botToken: string) {
  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
  await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: text,
      parse_mode: "HTML",
    }),
  });
}

// Парсинг команды базы данных
function parseDbCommand(text: string): { action: string; table: string; data?: Record<string, unknown>; where?: Record<string, unknown> } | null {
  try {
    // Формат: /db action table {json_data} [where {json_where}]
    const match = text.match(/^\/db\s+(\w+)\s+(\w+)(?:\s+(\{.*?\}))?(?:\s+where\s+(\{.*?\}))?$/is);
    if (!match) return null;
    
    const [, action, table, dataStr, whereStr] = match;
    return {
      action: action.toLowerCase(),
      table: table.toLowerCase(),
      data: dataStr ? JSON.parse(dataStr) : undefined,
      where: whereStr ? JSON.parse(whereStr) : undefined,
    };
  } catch {
    return null;
  }
}

// Выполнение операций с БД
async function executeDbOperation(command: { action: string; table: string; data?: Record<string, unknown>; where?: Record<string, unknown> }): Promise<string> {
  const { action, table, data, where } = command;
  
  try {
    switch (action) {
      case "select": {
        let query = supabaseAdmin.from(table).select("*");
        if (where) {
          Object.entries(where).forEach(([key, value]) => {
            query = query.eq(key, value);
          });
        }
        const { data: result, error } = await query.limit(10);
        if (error) throw error;
        return `✅ SELECT из ${table}:\n${JSON.stringify(result, null, 2)}`;
      }
      
      case "insert": {
        if (!data) return "❌ Нужны данные для INSERT";
        const { data: result, error } = await supabaseAdmin.from(table).insert(data).select();
        if (error) throw error;
        return `✅ INSERT в ${table}:\n${JSON.stringify(result, null, 2)}`;
      }
      
      case "update": {
        if (!data) return "❌ Нужны данные для UPDATE";
        if (!where) return "❌ Нужен WHERE для UPDATE";
        let query = supabaseAdmin.from(table).update(data);
        Object.entries(where).forEach(([key, value]) => {
          query = query.eq(key, value);
        });
        const { data: result, error } = await query.select();
        if (error) throw error;
        return `✅ UPDATE в ${table}:\n${JSON.stringify(result, null, 2)}`;
      }
      
      case "delete": {
        if (!where) return "❌ Нужен WHERE для DELETE";
        let query = supabaseAdmin.from(table).delete();
        Object.entries(where).forEach(([key, value]) => {
          query = query.eq(key, value);
        });
        const { data: result, error } = await query.select();
        if (error) throw error;
        return `✅ DELETE из ${table}:\n${JSON.stringify(result, null, 2)}`;
      }
      
      case "tables": {
        // Получить список таблиц
        const tables = ["profiles", "user_roles", "news", "promotions", "comments", "likes", "site_blocks", "clients", "employees", "tasks", "task_checklists", "task_photos", "location_history"];
        return `📋 Доступные таблицы:\n${tables.join("\n")}`;
      }
      
      default:
        return `❌ Неизвестная команда: ${action}`;
    }
  } catch (error) {
    console.error("DB Error:", error);
    const errMessage = error instanceof Error ? error.message : String(error);
    return `❌ Ошибка: ${errMessage}`;
  }
}

Deno.serve(async (req) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
    if (!botToken) {
      console.error("TELEGRAM_BOT_TOKEN not configured");
      return new Response(JSON.stringify({ error: "Bot token not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Список разрешённых Telegram ID (админы бота)
    const allowedUsers = Deno.env.get("TELEGRAM_ADMIN_IDS")?.split(",").map(id => parseInt(id.trim())) || [];
    
    const update: TelegramUpdate = await req.json();
    console.log("Received update:", JSON.stringify(update));
    
    const message = update.message;
    if (!message || !message.text) {
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const chatId = message.chat.id;
    const userId = message.from.id;
    const text = message.text;

    // Проверка доступа
    if (allowedUsers.length > 0 && !allowedUsers.includes(userId)) {
      await sendTelegramMessage(chatId, "⛔ У вас нет доступа к этому боту.", botToken);
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Команда /start
    if (text === "/start") {
      const helpText = `🤖 <b>Бот управления базой данных</b>

<b>Команды:</b>
/db tables - список таблиц
/db select [таблица] - получить записи
/db select [таблица] where {условие}
/db insert [таблица] {данные}
/db update [таблица] {данные} where {условие}
/db delete [таблица] where {условие}

<b>Примеры:</b>
<code>/db select user_roles</code>
<code>/db select profiles where {"id":"uuid"}</code>
<code>/db insert news {"title":"Test","content":"Test content","is_published":true}</code>
<code>/db update profiles {"full_name":"Новое имя"} where {"id":"uuid"}</code>
<code>/db delete comments where {"id":"uuid"}</code>`;
      
      await sendTelegramMessage(chatId, helpText, botToken);
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Команда /db
    if (text.startsWith("/db")) {
      // Специальная обработка /db tables
      if (text.trim() === "/db tables") {
        const result = await executeDbOperation({ action: "tables", table: "" });
        await sendTelegramMessage(chatId, result, botToken);
      } else {
        const command = parseDbCommand(text);
        if (!command) {
          await sendTelegramMessage(chatId, "❌ Неверный формат команды. Используйте /start для справки.", botToken);
        } else {
          const result = await executeDbOperation(command);
          // Telegram ограничивает длину сообщения
          const truncated = result.length > 4000 ? result.substring(0, 4000) + "..." : result;
          await sendTelegramMessage(chatId, truncated, botToken);
        }
      }
      
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Неизвестная команда
    await sendTelegramMessage(chatId, "Используйте /start для справки.", botToken);
    
    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Error processing request:", error);
    const errMessage = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: errMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
