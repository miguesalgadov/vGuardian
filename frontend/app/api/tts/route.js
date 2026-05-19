export async function POST(request) {
  const { text } = await request.json();

  if (!process.env.ELEVENLABS_API_KEY) {
    return new Response("ELEVENLABS_API_KEY no configurada", { status: 503 });
  }

  const voiceId = process.env.ELEVENLABS_VOICE_ID || "EXAVITQu4vr4xnSDxMaL";

  const res = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
    {
      method: "POST",
      headers: {
        "xi-api-key": process.env.ELEVENLABS_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text,
        model_id: "eleven_multilingual_v2",
        voice_settings: {
          stability: 0.45,
          similarity_boost: 0.80,
          style: 0.25,
          use_speaker_boost: true,
        },
      }),
    }
  );

  if (!res.ok) {
    const msg = await res.text();
    return new Response(msg, { status: res.status });
  }

  const audio = await res.arrayBuffer();
  return new Response(audio, {
    headers: { "Content-Type": "audio/mpeg" },
  });
}
