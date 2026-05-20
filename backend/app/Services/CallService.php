<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\Apartment;
use App\Models\Resident;
use App\Models\Visit;
use Illuminate\Support\Str;

final class CallService
{
    /**
     * Create a visit/delivery/intercom call record and trigger resident notification.
     *
     * @param  string  $kind            visit_request | delivery | intercom
     * @param  string  $targetApartment apartment code (e.g. "302")
     * @param  string  $deviceId
     * @param  string  $condominiumId
     * @param  array   $extra           additional fields (visitor_name, company, etc.)
     */
    public function initiate(string $kind, string $targetApartment, string $deviceId, string $condominiumId, array $extra = []): Visit
    {
        $apartment = Apartment::where('condominium_id', $condominiumId)
            ->where('code', $targetApartment)
            ->firstOrFail();

        $resident = Resident::where('apartment_id', $apartment->id)
            ->where('status', 'active')
            ->first();

        $type = match ($kind) {
            'delivery'  => 'delivery',
            'intercom'  => 'visit',
            default     => 'visit',
        };

        $visit = Visit::create([
            'condominium_id' => $condominiumId,
            'resident_id'    => $resident?->id,
            'apartment_id'   => $apartment->id,
            'device_id'      => $deviceId,
            'type'           => $type,
            'status'         => 'notified',
            'notes'          => $extra['notes'] ?? null,
        ]);

        // TODO v3: replace with real push/SMS via ResidentNotificationRequested job
        // For now the WS response is simulated on the frontend side
        // broadcast(new ResidentNotificationRequested($visit, $kind));

        return $visit;
    }
}
