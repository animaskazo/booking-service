import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Método no permitido" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { serviceId } = await req.json();
    if (typeof serviceId !== "string" || !serviceId) {
      return new Response(JSON.stringify({ error: "Falta el servicio" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const { data: service, error: serviceError } = await supabase
      .from("services")
      .select("user_id")
      .eq("id", serviceId)
      .maybeSingle();

    if (serviceError) throw serviceError;
    if (!service?.user_id) {
      return new Response(JSON.stringify({ error: "No se encontró el servicio" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: settings, error: settingsError } = await supabase
      .from("business_settings")
      .select("terms_title, terms_content, terms_updated_at")
      .eq("user_id", service.user_id)
      .maybeSingle();

    if (settingsError) throw settingsError;

    return new Response(JSON.stringify({
      terms_title: settings?.terms_title ?? "",
      terms_content: settings?.terms_content ?? "",
      terms_updated_at: settings?.terms_updated_at ?? "",
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("get-booking-terms error:", error);
    return new Response(JSON.stringify({ error: "No se pudieron cargar los términos y condiciones" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
