<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\Conversation;
use App\Models\Resident;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;

/**
 * AiConciergeService
 * -----------------------------------------------------------------------------
 * Núcleo conversacional del tótem. Encapsula:
 *   - Speech-to-Text  (Whisper API)
 *   - Razonamiento + clasificación de intención (OpenAI Chat Completions)
 *   - Text-to-Speech  (OpenAI TTS)
 *
 * El frontend del tótem nunca habla con OpenAI directamente: todo pasa por
 * este servicio para centralizar prompts, costos, auditoría y datos personales.
 */
final class AiConciergeService
{
    private const MODEL = 'gpt-4o-mini';

    private string $apiKey;

    public function __construct()
    {
        $this->apiKey = (string) config('services.openai.key');
    }

    /** Transcribe un audio (Whisper) y devuelve el texto en español. */
    public function transcribe(string $audioPath): string
    {
        $response = Http::withToken($this->apiKey)
            ->attach('file', Storage::get($audioPath), 'audio.webm')
            ->post('https://api.openai.com/v1/audio/transcriptions', [
                'model'    => 'whisper-1',
                'language' => 'es',
            ]);

        return (string) $response->json('text', '');
    }

    /**
     * Procesa un turno de conversación.
     * Devuelve: ['reply' => string, 'intent' => string, 'confidence' => float,
     *            'action' => ?array]  donde action puede ser
     *            ['type' => 'notify_resident', 'resident_id' => ...] o
     *            ['type' => 'escalate', 'priority' => 'high'].
     */
    public function handleTurn(Conversation $conversation, string $userText): array
    {
        $history = $conversation->messages()
            ->latest()->take(8)->get()->reverse()
            ->map(fn ($m) => [
                'role'    => $m->sender === 'visitor' ? 'user' : 'assistant',
                'content' => $m->content,
            ])->values()->all();

        $payload = [
            'model'           => self::MODEL,
            'temperature'     => 0.3,
            'response_format' => ['type' => 'json_object'],
            'messages'        => array_merge(
                [['role' => 'system', 'content' => $this->systemPrompt($conversation)]],
                $history,
                [['role' => 'user', 'content' => $userText]],
            ),
        ];

        $res = Http::withToken($this->apiKey)
            ->timeout(20)
            ->post('https://api.openai.com/v1/chat/completions', $payload);

        $json = json_decode(
            $res->json('choices.0.message.content', '{}'),
            true
        ) ?: [];

        return [
            'reply'      => $json['reply']      ?? 'Disculpe, ¿podría repetir?',
            'intent'     => $json['intent']     ?? 'unknown',
            'confidence' => (float) ($json['confidence'] ?? 0.0),
            'action'     => $json['action']     ?? null,
        ];
    }

    /** Genera audio MP3 a partir de la respuesta y lo guarda en storage. */
    public function synthesize(string $text, string $conversationId): string
    {
        $res = Http::withToken($this->apiKey)
            ->post('https://api.openai.com/v1/audio/speech', [
                'model' => 'tts-1',
                'voice' => 'nova',
                'input' => $text,
            ]);

        $path = "tts/{$conversationId}/" . uniqid('msg_') . '.mp3';
        Storage::put($path, $res->body());

        return $path;
    }

    /** Prompt de sistema con contexto del condominio y reglas operativas. */
    private function systemPrompt(Conversation $conversation): string
    {
        $condo = $conversation->condominium;

        return <<<PROMPT
Eres "eGuardian", conserje virtual del edificio {$condo->name}.
Atiendes visitantes en un tótem del lobby. Responde SIEMPRE en JSON con las
claves: reply (string, máx 2 frases, cordial, profesional, en español de Chile),
intent (uno de: visit, delivery, emergency, support, info, greeting, unknown),
confidence (0 a 1), action (null u objeto).

Reglas:
- Si el visitante busca a un residente: intent=visit y
  action={"type":"notify_resident","query":"<texto del residente o depto>"}.
- Si trae una entrega: intent=delivery, pide depto si falta.
- Si hay emergencia (incendio, robo, herido): intent=emergency,
  action={"type":"escalate","priority":"critical"}.
- Si pide hablar con una persona o insiste tras 2 intentos: intent=support,
  action={"type":"escalate","priority":"normal"}.
- Nunca inventes datos de residentes; el backend valida la coincidencia.
- Sé breve, claro y nunca reveles datos personales de terceros.
PROMPT;
    }

    /** Resolución de residente desde texto libre (apoya la acción notify). */
    public function resolveResident(string $query, string $condominiumId): ?Resident
    {
        $query = trim($query);

        if (preg_match('/\b0?(\d{2,4})\b/', $query, $m)) {
            $byApt = Resident::where('condominium_id', $condominiumId)
                ->whereHas('apartment', fn ($q) => $q->where('code', $m[1]))
                ->where('status', 'active')->first();
            if ($byApt) {
                return $byApt;
            }
        }

        return Resident::where('condominium_id', $condominiumId)
            ->where('status', 'active')
            ->where('full_name', 'ILIKE', '%' . $query . '%')
            ->first();
    }
}
