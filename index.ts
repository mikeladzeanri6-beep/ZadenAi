// Deploy: supabase functions deploy api
// Secrets (never in browser files): supabase secrets set GEMINI_API_KEY=... ELEVENLABS_API_KEY=... FAL_API_KEY=...
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const COST = { chat: 1, voice: 2, image: 5, video: 10 } as const;
const cors = {
  'Access-Control-Allow-Origin': Deno.env.get('ALLOWED_ORIGIN') ?? '*', // set ALLOWED_ORIGIN to your site URL
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } });
class HttpError extends Error { constructor(m: string, public status = 400) { super(m); } }
const secret = (k: string) => { const v = Deno.env.get(k); if (!v) throw new Error(`Server is missing ${k}`); return v; };
const text = (v: unknown, max: number, name: string) => {
  if (typeof v !== 'string' || !v.trim()) throw new HttpError(`${name} is required.`);
  if (v.length > max) throw new HttpError(`${name} is too long (max ${max} characters).`);
  return v.trim();
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  let spent = 0;
  let uid = '';
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  try {
    // 1. Who is calling? Verify the login token on the server.
    const token = (req.headers.get('Authorization') ?? '').replace('Bearer ', '');
    const { data: { user } } = await admin.auth.getUser(token);
    if (!user) throw new HttpError('Please log in.', 401);
    uid = user.id;

    const body = await req.json();
    const action = String(body.action);
    const spend = async (n: number) => {
      const { data } = await admin.rpc('spend_credits', { p_user: uid, p_amount: n });
      if (!data) throw new HttpError('Not enough credits. They refill monthly.', 402);
      spent = n;
    };
    const save = async (row: Record<string, unknown>) => {
      const { data, error } = await admin.from('generations').insert({ user_id: uid, ...row }).select('id').single();
      if (error) throw error;
      return data.id as string;
    };
    const upload = async (bytes: Uint8Array, ext: string, type: string) => {
      const path = `${uid}/${crypto.randomUUID()}.${ext}`;
      const { error } = await admin.storage.from('media').upload(path, bytes, { contentType: type });
      if (error) throw error;
      const { data } = await admin.storage.from('media').createSignedUrl(path, 3600);
      return { path, url: data!.signedUrl };
    };

    // ---- CHAT ----
    if (action === 'chat') {
      const msgs = (Array.isArray(body.messages) ? body.messages : []).slice(-20).map((m: any) => ({
        role: m.role === 'model' ? 'model' : 'user',
        parts: [{ text: text(m?.parts?.[0]?.text, 4000, 'Message') }],
      }));
      if (!msgs.length) throw new HttpError('Message is required.');
      await spend(COST.chat);
      const model = Deno.env.get('GEMINI_CHAT_MODEL') ?? 'gemini-2.5-flash';
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': secret('GEMINI_API_KEY') },
        body: JSON.stringify({ contents: msgs }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(`Gemini: ${j.error?.message}`);
      const out = j.candidates?.[0]?.content?.parts?.map((p: any) => p.text ?? '').join('') ||
        'No response (blocked or empty). Try rephrasing.';
      await save({ type: 'chat', prompt: msgs[msgs.length - 1].parts[0].text, result_text: out });
      return json({ text: out });
    }

    // ---- IMAGE ----
    if (action === 'image') {
      const prompt = text(body.prompt, 1000, 'Prompt');
      const style = typeof body.style === 'string' ? body.style.slice(0, 30) : '';
      await spend(COST.image);
      const model = Deno.env.get('GEMINI_IMAGE_MODEL') ?? 'gemini-2.5-flash-image';
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': secret('GEMINI_API_KEY') },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `${prompt}. Style: ${style}` }] }],
          generationConfig: { responseModalities: ['TEXT', 'IMAGE'] },
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(`Gemini: ${j.error?.message}`);
      const part = j.candidates?.[0]?.content?.parts?.find((x: any) => x.inlineData);
      if (!part) throw new HttpError('No image returned (the prompt may have been blocked). Try rewording it.');
      const bytes = Uint8Array.from(atob(part.inlineData.data), (c) => c.charCodeAt(0));
      const f = await upload(bytes, 'png', part.inlineData.mimeType || 'image/png');
      await save({ type: 'image', prompt, style, file_path: f.path });
      return json({ url: f.url });
    }

    // ---- VOICE ----
    if (action === 'voice') {
      const prompt = text(body.text, 1500, 'Script');
      await spend(COST.voice);
      const voice = Deno.env.get('ELEVENLABS_VOICE_ID') ?? '21m00Tcm4TlvDq8ikWAM';
      const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'xi-api-key': secret('ELEVENLABS_API_KEY') },
        body: JSON.stringify({ text: prompt, model_id: 'eleven_multilingual_v2' }),
      });
      if (!r.ok) throw new Error(`ElevenLabs: ${r.status}`);
      const f = await upload(new Uint8Array(await r.arrayBuffer()), 'mp3', 'audio/mpeg');
      await save({ type: 'voice', prompt, file_path: f.path });
      return json({ url: f.url });
    }

    // ---- VIDEO (start, then the browser polls video_status) ----
    if (action === 'video_start') {
      const prompt = text(body.prompt, 1000, 'Prompt');
      await spend(COST.video);
      const model = Deno.env.get('FAL_VIDEO_MODEL') ?? 'fal-ai/kling-video/v2.1/master/text-to-video';
      const r = await fetch(`https://queue.fal.run/${model}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Key ${secret('FAL_API_KEY')}` },
        body: JSON.stringify({ prompt }),
      });
      const q = await r.json();
      if (!r.ok) throw new Error(`fal: ${q.detail ?? r.status}`);
      const id = await save({
        type: 'video', prompt, status: 'pending',
        meta: { status_url: q.status_url, response_url: q.response_url },
      });
      spent = 0; // charged and committed; refunded later only if the render fails
      return json({ id });
    }

    if (action === 'video_status') {
      const { data: row } = await admin.from('generations').select('*')
        .eq('id', String(body.id)).eq('user_id', uid).eq('type', 'video').maybeSingle();
      if (!row) throw new HttpError('Not found.', 404);
      if (row.status === 'done') return json({ status: 'done', url: row.result_url });
      if (row.status === 'failed') return json({ status: 'failed' });
      const key = { Authorization: `Key ${secret('FAL_API_KEY')}` };
      const { status_url, response_url } = row.meta;
      if (!String(status_url).startsWith('https://queue.fal.run/')) throw new Error('Bad status URL');
      const s = await (await fetch(status_url, { headers: key })).json();
      if (s.status === 'COMPLETED') {
        const res = await (await fetch(response_url, { headers: key })).json();
        const url = res.video?.url;
        if (!url) throw new Error('fal returned no video');
        await admin.from('generations').update({ status: 'done', result_url: url }).eq('id', row.id);
        return json({ status: 'done', url });
      }
      if (s.status === 'FAILED') {
        const { data: changed } = await admin.from('generations').update({ status: 'failed' })
          .eq('id', row.id).eq('status', 'pending').select('id');
        if (changed?.length) await admin.rpc('refund_credits', { p_user: uid, p_amount: COST.video });
        return json({ status: 'failed' });
      }
      return json({ status: 'pending' });
    }

    throw new HttpError('Unknown action.');
  } catch (e) {
    if (spent && uid) await admin.rpc('refund_credits', { p_user: uid, p_amount: spent });
    if (e instanceof HttpError) return json({ error: e.message }, e.status);
    console.error(e); // details stay in server logs, not in the browser
    return json({ error: 'Something went wrong on our side. Any credits were refunded.' }, 500);
  }
});
