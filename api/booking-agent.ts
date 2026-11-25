export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: 'Booking no tiene configuradas las variables de Supabase.' });
  }
  try {
    const upstream = await fetch(`${supabaseUrl}/functions/v1/booking-agent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` },
      body: JSON.stringify({ message: req.body?.message, history: req.body?.history, short_id: req.body?.short_id, phone: req.body?.phone, action: req.body?.action, email: req.body?.email }),
    });
    res.status(upstream.status).setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.send(await upstream.text());
  } catch (error) {
    console.error('Booking assistant proxy failed', error);
    return res.status(502).json({ error: 'No se pudo conectar con Booking.' });
  }
}
