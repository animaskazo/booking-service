// public-track Edge Function
// Receives { short_id: string, phone: string }
// Returns appointment data (including payment status) and optional ticket data

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { short_id, phone } = await req.json();
    if (!short_id || !phone) {
      return new Response(JSON.stringify({ error: "Missing short_id or phone" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Query appointment matching short_id and phone
    const { data: appointment, error: apptErr } = await supabase
      .from("appointments")
      .select(`*, ticket: tickets(*), service: services(name)`)
      .eq("short_id", short_id)
      .eq("customer_phone", phone)
      .single();

    if (apptErr || !appointment) {
      return new Response(JSON.stringify({ error: "Appointment not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Sanitize response (remove internal fields if needed)
    const response = {
      appointment: {
        id: appointment.id,
        short_id: appointment.short_id,
        status: appointment.status,
        paid: appointment.paid ?? false,
        amount: appointment.paid_amount ?? null,
        service_id: appointment.service_id,
        start_time: appointment.start_time,
        end_time: appointment.end_time,
        service_name: (appointment.service as any)?.name ?? "Servicio",
        flow_commerce_order: appointment.flow_commerce_order ?? null,
        flow_token: appointment.flow_token ?? null,
      },
      ticket: appointment.ticket ? {
        id: appointment.ticket.id,
        status: appointment.ticket.status,
        budget: appointment.ticket.budget,
        findings: appointment.ticket.findings,
        ready_for_pickup: appointment.ticket.ready_for_pickup ?? false,
      } : null,
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("public-track error:", err);
    return new Response(JSON.stringify({ error: "Server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
