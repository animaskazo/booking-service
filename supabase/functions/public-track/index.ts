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
    const { short_id, phone, decision } = await req.json();
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

    if (decision && !["accepted", "rejected"].includes(decision)) {
      return new Response(JSON.stringify({ error: "Invalid budget decision" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ticket = Array.isArray(appointment.ticket)
      ? appointment.ticket[0]
      : appointment.ticket;

    if (decision) {
      if (!ticket || ticket.status !== "quoted") {
        return new Response(JSON.stringify({ error: "This budget is no longer awaiting a response" }), {
          status: 409,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: updatedTicket, error: updateError } = await supabase
        .from("tickets")
        .update({ status: decision })
        .eq("id", ticket.id)
        .eq("status", "quoted")
        .select("id, status, budget, total_budget, ready_for_pickup")
        .maybeSingle();

      if (updateError) {
        console.error("public-track budget response error:", updateError);
        return new Response(JSON.stringify({ error: "Could not save budget response" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (!updatedTicket) {
        return new Response(JSON.stringify({ error: "This budget has already been answered" }), {
          status: 409,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      Object.assign(ticket, updatedTicket);
    }

    let findings: Array<{ id: string; description: string; price: number }> = [];
    if (ticket?.id) {
      const { data: ticketFindings, error: findingsError } = await supabase
        .from("ticket_findings")
        .select("id, description, price")
        .eq("ticket_id", ticket.id)
        .order("created_at", { ascending: true });
      if (findingsError) console.error("public-track findings error:", findingsError);
      findings = ticketFindings ?? [];
    }

    // Sanitize response (remove internal fields if needed)
    const response = {
      appointment: {
        id: appointment.id,
        short_id: appointment.short_id,
        customer_phone: appointment.customer_phone,
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
      ticket: ticket ? {
        id: ticket.id,
        status: ticket.status,
        budget: ticket.budget,
        total_budget: ticket.total_budget,
        findings,
        ready_for_pickup: ticket.ready_for_pickup ?? false,
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
