import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Manejar preflight (OPTIONS)
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const APP_URL = Deno.env.get("APP_URL") ?? "http://localhost:3000";
  let token = "";

  try {
    if (req.method === "POST") {
      // Flow envía los datos como x-www-form-urlencoded
      const contentType = req.headers.get("content-type") || "";
      if (contentType.includes("form-urlencoded")) {
        const formData = await req.formData();
        token = formData.get("token")?.toString() || "";
      } else {
        // Por si acaso viene en JSON
        const body = await req.json();
        token = body.token || "";
      }
    } else {
      // Si viene por GET
      const url = new URL(req.url);
      token = url.searchParams.get("token") || "";
    }
  } catch (err) {
    console.error("Error parsing Flow return data:", err);
  }

  // Si no hay token, redirigir igual a la ruta base de retorno
  const redirectUrl = token 
    ? `${APP_URL}/booking/return?token=${token}`
    : `${APP_URL}/booking/return`;

  console.log(`Redirecting Flow user to: ${redirectUrl}`);

  // Redirección HTTP 303 (See Other) fuerza a cambiar el método de POST a GET
  return new Response(null, {
    status: 303,
    headers: {
      "Location": redirectUrl,
      ...corsHeaders,
    },
  });
});
