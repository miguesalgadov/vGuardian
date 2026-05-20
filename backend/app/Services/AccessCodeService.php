<?php

declare(strict_types=1);

namespace App\Services;

use App\Events\AccessCodeLockoutAlert;
use App\Events\AccessOpened;
use App\Models\AccessCode;
use App\Models\AccessCodeAttempt;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Redis;

final class AccessCodeService
{
    private const MAX_ATTEMPTS  = 3;
    private const LOCKOUT_TTL   = 60;   // seconds
    private const WINDOW_SECS   = 300;  // 5-minute rolling window

    public function verify(string $code, string $deviceId, string $condominiumId, string $ip): array
    {
        $lockKey = "lockout:{$deviceId}";

        if (Redis::exists($lockKey)) {
            $ttl = Redis::ttl($lockKey);
            return ['success' => false, 'reason' => 'locked', 'retry_after' => $ttl];
        }

        $entry = AccessCode::where('condominium_id', $condominiumId)
            ->where('status', 'active')
            ->get()
            ->first(fn ($ac) => Hash::check($code, $ac->code_hash));

        $success = $entry !== null
            && ($entry->valid_until === null || now()->lessThanOrEqualTo($entry->valid_until))
            && ($entry->max_uses === null || $entry->uses_count < $entry->max_uses);

        AccessCodeAttempt::create([
            'condominium_id'       => $condominiumId,
            'device_id'            => $deviceId,
            'code_hash_attempted'  => Hash::make($code),
            'success'              => $success,
            'ip_address'           => $ip,
        ]);

        if (!$success) {
            $this->handleFailure($deviceId, $condominiumId);
            return ['success' => false, 'reason' => $entry ? 'expired_or_exhausted' : 'invalid'];
        }

        $entry->increment('uses_count');
        if ($entry->max_uses !== null && $entry->uses_count >= $entry->max_uses) {
            $entry->update(['status' => 'exhausted']);
        }

        broadcast(new AccessOpened($entry, $deviceId));

        if ($entry->type === 'master') {
            broadcast(new AccessCodeLockoutAlert($deviceId, $condominiumId, 'master_code_used'));
        }

        return ['success' => true, 'entry' => $entry];
    }

    private function handleFailure(string $deviceId, string $condominiumId): void
    {
        $windowKey = "attempts:{$deviceId}";
        $count     = Redis::incr($windowKey);
        Redis::expire($windowKey, self::WINDOW_SECS);

        if ($count >= self::MAX_ATTEMPTS) {
            Redis::setex("lockout:{$deviceId}", self::LOCKOUT_TTL, 1);
            Redis::del($windowKey);
            broadcast(new AccessCodeLockoutAlert($deviceId, $condominiumId, 'max_attempts_exceeded'));
        }
    }
}
