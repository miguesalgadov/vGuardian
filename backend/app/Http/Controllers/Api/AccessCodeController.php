<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\AccessCodeService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class AccessCodeController extends Controller
{
    public function __construct(private readonly AccessCodeService $service) {}

    public function verify(Request $request): JsonResponse
    {
        $data = $request->validate([
            'code'      => ['required', 'string', 'min:4', 'max:6'],
            'device_id' => ['required', 'uuid'],
        ]);

        $device = \App\Models\Device::where('id', $data['device_id'])->firstOrFail();

        $result = $this->service->verify(
            code:           $data['code'],
            deviceId:       $device->id,
            condominiumId:  $device->condominium_id,
            ip:             $request->ip() ?? '',
        );

        if (!$result['success']) {
            $status = $result['reason'] === 'locked' ? 429 : 422;
            return response()->json(['message' => 'Clave no válida.', 'reason' => $result['reason'], 'retry_after' => $result['retry_after'] ?? null], $status);
        }

        return response()->json(['message' => 'Acceso autorizado.', 'type' => $result['entry']->type]);
    }
}
