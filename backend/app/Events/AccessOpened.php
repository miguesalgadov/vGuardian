<?php

declare(strict_types=1);

namespace App\Events;

use App\Models\AccessCode;
use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;

final class AccessOpened implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets;

    public function __construct(
        public readonly AccessCode $accessCode,
        public readonly string $deviceId,
    ) {}

    public function broadcastOn(): array
    {
        return [
            new PrivateChannel("condo.{$this->accessCode->condominium_id}.operators"),
        ];
    }

    public function broadcastAs(): string
    {
        return 'access.opened';
    }

    public function broadcastWith(): array
    {
        return [
            'device_id'   => $this->deviceId,
            'code_type'   => $this->accessCode->type,
            'label'       => $this->accessCode->label,
            'opened_at'   => now()->toIso8601String(),
        ];
    }
}
