<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\CallService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

final class CallController extends Controller
{
    public function __construct(private readonly CallService $service) {}

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'kind'             => ['required', Rule::in(['visit_request', 'delivery', 'intercom'])],
            'target_apartment' => ['required', 'string', 'max:20'],
            'device_id'        => ['required', 'uuid'],
            'visitor_name'     => ['nullable', 'string', 'max:160'],
            'company'          => ['nullable', 'string', 'max:120'],
        ]);

        $device = \App\Models\Device::where('id', $data['device_id'])->firstOrFail();

        $visit = $this->service->initiate(
            kind:            $data['kind'],
            targetApartment: $data['target_apartment'],
            deviceId:        $device->id,
            condominiumId:   $device->condominium_id,
            extra:           array_filter(['notes' => $data['visitor_name'] ?? null]),
        );

        return response()->json(['visit_id' => $visit->id, 'status' => $visit->status], 201);
    }
}
