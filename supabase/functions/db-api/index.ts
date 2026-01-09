import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
);

interface DbRequest {
  action: "select" | "insert" | "update" | "delete" | "tables" | "rpc";
  table?: string;
  data?: Record<string, unknown>;
  where?: Record<string, unknown>;
  columns?: string;
  limit?: number;
  order?: { column: string; ascending?: boolean };
  function_name?: string;
  function_args?: Record<string, unknown>;
}

async function executeOperation(request: DbRequest): Promise<{ success: boolean; data?: unknown; error?: string }> {
  try {
    switch (request.action) {
      case "tables": {
        const { data, error } = await supabaseAdmin
          .from("information_schema.tables" as any)
          .select("table_name")
          .eq("table_schema", "public");
        
        if (error) {
          // Fallback: query pg_tables
          const { data: pgData, error: pgError } = await supabaseAdmin.rpc("get_public_tables" as any);
          if (pgError) {
            return { success: false, error: `Cannot list tables: ${pgError.message}` };
          }
          return { success: true, data: pgData };
        }
        return { success: true, data };
      }

      case "select": {
        if (!request.table) {
          return { success: false, error: "Table name is required" };
        }
        let query = supabaseAdmin
          .from(request.table)
          .select(request.columns || "*");
        
        if (request.where) {
          for (const [key, value] of Object.entries(request.where)) {
            query = query.eq(key, value);
          }
        }
        if (request.order) {
          query = query.order(request.order.column, { ascending: request.order.ascending ?? true });
        }
        if (request.limit) {
          query = query.limit(request.limit);
        }
        
        const { data, error } = await query;
        if (error) return { success: false, error: error.message };
        return { success: true, data };
      }

      case "insert": {
        if (!request.table || !request.data) {
          return { success: false, error: "Table and data are required" };
        }
        const { data, error } = await supabaseAdmin
          .from(request.table)
          .insert(request.data)
          .select();
        if (error) return { success: false, error: error.message };
        return { success: true, data };
      }

      case "update": {
        if (!request.table || !request.data || !request.where) {
          return { success: false, error: "Table, data, and where condition are required" };
        }
        let query = supabaseAdmin.from(request.table).update(request.data);
        for (const [key, value] of Object.entries(request.where)) {
          query = query.eq(key, value);
        }
        const { data, error } = await query.select();
        if (error) return { success: false, error: error.message };
        return { success: true, data };
      }

      case "delete": {
        if (!request.table || !request.where) {
          return { success: false, error: "Table and where condition are required" };
        }
        let query = supabaseAdmin.from(request.table).delete();
        for (const [key, value] of Object.entries(request.where)) {
          query = query.eq(key, value);
        }
        const { data, error } = await query.select();
        if (error) return { success: false, error: error.message };
        return { success: true, data };
      }

      case "rpc": {
        if (!request.function_name) {
          return { success: false, error: "Function name is required" };
        }
        const { data, error } = await supabaseAdmin.rpc(
          request.function_name as any,
          request.function_args || {}
        );
        if (error) return { success: false, error: error.message };
        return { success: true, data };
      }

      default:
        return { success: false, error: "Unknown action" };
    }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Check API key
    const apiKey = req.headers.get("x-api-key");
    const expectedKey = Deno.env.get("DB_API_KEY");
    
    if (!expectedKey) {
      return new Response(
        JSON.stringify({ success: false, error: "API key not configured on server" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (apiKey !== expectedKey) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid API key" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const request: DbRequest = await req.json();
    const result = await executeOperation(request);

    return new Response(
      JSON.stringify(result),
      { 
        status: result.success ? 200 : 400, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ success: false, error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
