export async function POST(request) {
  const { text } = await request.json();

  if (!process.env.OPENAI_API_KEY) {
    return new Response("OPENAI_API_KEY no configurada", { status: 503 });
  }

  const voice = process.env.OPENAI_TTS_VOICE || "nova";

  const res = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "tts-1",
      input: text,
      voice,
    }),
  });

  if (!res.ok) {
    const msg = await res.text();
    return new Response(msg, { status: res.status });
  }

  const audio = await res.arrayBuffer();
  return new Response(audio, {
    headers: { "Content-Type": "audio/mpeg" },
  });
}
