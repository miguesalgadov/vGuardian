<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use App\Events\VisitResolved;
use App\Http\Controllers\Controller;
use App\Models\Visit;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Gestión de visitas: listado para el panel, generación de QR temporal,
 * y resolución (aprobar/rechazar) por parte del residente desde su app.
 */
final class VisitController extends Controller
{
    /** GET /api/v1/visits?date=&status=&type= */
    public function index(Request $request): JsonResponse
    {
        $visits = Visit::query()
            ->where('condominium_id', $request->user()->condominium_id)
            ->when($request->filled('status'), fn ($q) => $q->where('status', $request->string('status')))
            ->when($request->filled('type'), fn ($q) => $q->where('type', $request->string('type')))
            ->when($request->filled('date'), fn ($q) =>
                $q->whereDate('created_at', $request->date('date')))
            ->with(['resident:id,full_name', 'visitor:id,full_name,company', 'apartment:id,code'])
            ->latest()
            ->paginate(25);

        return response()->json($visits);
    }

    /** POST /api/v1/visits  — visita programada con QR temporal. */
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'resident_id'   => ['required', 'uuid', 'exists:residents,id'],
            'visitor_name'  => ['required', 'string', 'max:160'],
            'scheduled_for' => ['required', 'date', 'after:now'],
        ]);

        $visit = Visit::create([
            'condominium_id' => $request->user()->condominium_id,
            'resident_id'    => $data['resident_id'],
            'type'           => 'visit',
            'status'         => 'scheduled',
            'scheduled_for'  => $data['scheduled_for'],
            'qr_token'       => bin2hex(random_bytes(16)),
            'qr_expires_at'  => now()->parse($data['scheduled_for'])->addHours(4),
            'notes'          => "Programada para {$data['visitor_name']}",
        ]);

        return response()->json([
            'visit'   => $visit,
            'qr_url'  => route('visits.qr', $visit->qr_token),
        ], 201);
    }

    /** PATCH /api/v1/visits/{visit}/resolve  — residente aprueba/rechaza. */
    public function resolve(Request $request, Visit $visit): JsonResponse
    {
        $data = $request->validate([
            'decision' => ['required', 'in:approved,rejected'],
        ]);

        abort_if(
            ! in_array($visit->status, ['pending', 'notified', 'scheduled'], true),
            409,
            'La visita ya fue resuelta.'
        );

        $visit->update([
            'status'      => $data['decision'],
            'resolved_at' => now(),
        ]);

        broadcast(new VisitResolved($visit));   // refresca tótem en tiempo real

        return response()->json(['status' => $visit->status]);
    }
}
