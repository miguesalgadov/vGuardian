<?php

declare(strict_types=1);

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;

final class AccessCodeLockoutAlert implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets;

    public function __construct(
        public readonly string $deviceId,
        public readonly string $condominiumId,
        public readonly string $reason,
    ) {}

    public function broadcastOn(): array
    {
        return [
            new PrivateChannel("condo.{$this->condominiumId}.operators"),
            new PrivateChannel("device.{$this->deviceId}"),
        ];
    }

    public function broadcastAs(): string
    {
        return 'access.lockout';
    }

    public function broadcastWith(): array
    {
        return [
            'device_id'    => $this->deviceId,
            'reason'       => $this->reason,
            'locked_until' => now()->addSeconds(60)->toIso8601String(),
        ];
    }
}
