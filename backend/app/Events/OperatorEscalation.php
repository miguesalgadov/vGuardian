<?php

declare(strict_types=1);

namespace App\Events;

use App\Models\Conversation;
use App\Models\Incident;
use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;

/**
 * Se emite cuando el motor IA o el visitante escalan a un operador humano.
 * El panel del centro de monitoreo escucha el canal privado del condominio
 * (Laravel Reverb / Pusher) y muestra el caso en la cola en tiempo real.
 */
final class OperatorEscalation implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets;

    public function __construct(
        public readonly Conversation $conversation,
        public readonly Incident $incident,
    ) {}

    /** @return array<int, Channel> */
    public function broadcastOn(): array
    {
        return [
            new PrivateChannel("condo.{$this->conversation->condominium_id}.operators"),
        ];
    }

    public function broadcastAs(): string
    {
        return 'escalation.created';
    }

    /** @return array<string, mixed> */
    public function broadcastWith(): array
    {
        return [
            'incident_id'     => $this->incident->id,
            'conversation_id' => $this->conversation->id,
            'priority'        => $this->incident->priority,
            'intent'          => $this->conversation->detected_intent,
            'device_id'       => $this->conversation->device_id,
            'opened_at'       => $this->incident->opened_at->toIso8601String(),
        ];
    }
}
