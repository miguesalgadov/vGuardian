<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use App\Events\OperatorEscalation;
use App\Http\Controllers\Controller;
use App\Models\Conversation;
use App\Models\Incident;
use App\Models\Visit;
use App\Services\AiConciergeService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Endpoint principal del tótem. Un turno = una llamada a /turn.
 * Maneja texto y audio (Whisper), persiste mensajes, ejecuta acciones
 * (notificar residente / escalar) y devuelve respuesta + audio TTS.
 */
final class ConversationController extends Controller
{
    public function __construct(private readonly AiConciergeService $ai) {}

    /** POST /api/v1/conversations  — abre una sesión desde un tótem. */
    public function open(Request $request): JsonResponse
    {
        $data = $request->validate([
            'device_id' => ['required', 'uuid', 'exists:devices,id'],
        ]);

        $conversation = Conversation::create([
            'condominium_id' => $request->user('device')->condominium_id,
            'device_id'      => $data['device_id'],
            'status'         => 'active',
        ]);

        return response()->json([
            'conversation_id' => $conversation->id,
            'greeting'        => $this->ai->synthesize(
                'Bienvenido. Soy eGuardian, el conserje virtual. ¿En qué puedo ayudarle?',
                $conversation->id,
            ),
        ], 201);
    }

    /** POST /api/v1/conversations/{conversation}/turn */
    public function turn(Request $request, Conversation $conversation): JsonResponse
    {
        $request->validate([
            'text'  => ['required_without:audio', 'string', 'max:1000'],
            'audio' => ['required_without:text', 'file', 'mimetypes:audio/webm,audio/mp4', 'max:5120'],
        ]);

        $userText = $request->filled('text')
            ? (string) $request->string('text')
            : $this->ai->transcribe($request->file('audio')->store('inbound'));

        $conversation->messages()->create([
            'sender'  => 'visitor',
            'content' => $userText,
        ]);

        $result = $this->ai->handleTurn($conversation, $userText);

        $conversation->messages()->create([
            'sender'     => 'ai',
            'content'    => $result['reply'],
            'intent'     => $result['intent'],
            'confidence' => $result['confidence'],
        ]);
        $conversation->update(['detected_intent' => $result['intent']]);

        $action = $this->dispatchAction($conversation, $result['action'] ?? null);

        return response()->json([
            'reply'     => $result['reply'],
            'intent'    => $result['intent'],
            'audio_url' => $this->ai->synthesize($result['reply'], $conversation->id),
            'action'    => $action,
        ]);
    }

    /** Ejecuta la acción decidida por el motor IA. */
    private function dispatchAction(Conversation $conversation, ?array $action): ?array
    {
        if (! $action) {
            return null;
        }

        return match ($action['type'] ?? null) {
            'notify_resident' => $this->notifyResident($conversation, (string) $action['query']),
            'escalate'        => $this->escalate($conversation, $action['priority'] ?? 'normal'),
            default           => null,
        };
    }

    private function notifyResident(Conversation $conversation, string $query): array
    {
        $resident = $this->ai->resolveResident($query, $conversation->condominium_id);

        if (! $resident) {
            return ['type' => 'resident_not_found'];
        }

        $visit = DB::transaction(function () use ($conversation, $resident) {
            $visit = Visit::create([
                'condominium_id' => $conversation->condominium_id,
                'resident_id'    => $resident->id,
                'apartment_id'   => $resident->apartment_id,
                'device_id'      => $conversation->device_id,
                'type'           => 'visit',
                'status'         => $resident->auto_approve ? 'approved' : 'notified',
            ]);
            $conversation->update(['visit_id' => $visit->id]);

            // ResidentNotification::dispatch($resident, $visit);  // push/SMS/WhatsApp
            return $visit;
        });

        return [
            'type'        => 'resident_notified',
            'resident'    => $resident->only(['id', 'full_name']),
            'apartment'   => $resident->apartment?->code,
            'visit_id'    => $visit->id,
            'auto_approve' => $resident->auto_approve,
        ];
    }

    private function escalate(Conversation $conversation, string $priority): array
    {
        $incident = Incident::create([
            'condominium_id'  => $conversation->condominium_id,
            'conversation_id' => $conversation->id,
            'reason'          => 'Escalamiento desde tótem (' . $conversation->detected_intent . ')',
            'priority'        => $priority,
            'status'          => 'open',
        ]);

        $conversation->update(['status' => 'escalated']);

        // Notifica en tiempo real al centro de monitoreo (Laravel Reverb).
        broadcast(new OperatorEscalation($conversation, $incident));

        return ['type' => 'escalated', 'incident_id' => $incident->id, 'priority' => $priority];
    }
}
