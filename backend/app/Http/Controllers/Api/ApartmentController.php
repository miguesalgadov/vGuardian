<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Apartment;
use App\Models\Device;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class ApartmentController extends Controller
{
    /**
     * Public directory — returns only apartment codes and location data.
     * No resident names, phones, emails or IDs are included.
     */
    public function directory(Request $request): JsonResponse
    {
        $deviceId = $request->query('device_id');

        $condominiumId = $deviceId
            ? Device::where('id', $deviceId)->value('condominium_id')
            : null;

        if (!$condominiumId) {
            return response()->json(['data' => []], 404);
        }

        $apartments = Apartment::where('condominium_id', $condominiumId)
            ->whereNull('deleted_at')
            ->orderBy('tower')
            ->orderBy('floor')
            ->orderBy('code')
            ->get(['code', 'tower', 'floor']);

        return response()->json(['data' => $apartments]);
    }
}
