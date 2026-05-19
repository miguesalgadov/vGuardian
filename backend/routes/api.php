<?php

declare(strict_types=1);

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\ConversationController;
use App\Http\Controllers\Api\DashboardController;
use App\Http\Controllers\Api\IncidentController;
use App\Http\Controllers\Api\OperatorController;
use App\Http\Controllers\Api\ResidentController;
use App\Http\Controllers\Api\VisitController;
use Illuminate\Support\Facades\Route;

/*
|------------------------------------------------------------------------------
| API v1  (prefix /api/v1)
|------------------------------------------------------------------------------
| Autenticación JWT. Throttling por capa. Multi-tenant resuelto vía el claim
| condominium_id del token. Los tótems usan un guard de dispositivo aparte.
*/

Route::prefix('v1')->group(function () {

    // ---- Auth (público) ----
    Route::post('auth/login',   [AuthController::class, 'login'])->middleware('throttle:10,1');
    Route::post('auth/refresh', [AuthController::class, 'refresh']);

    // ---- Tótem (guard de dispositivo, rate-limit alto) ----
    Route::middleware(['auth:device', 'throttle:120,1'])->group(function () {
        Route::post('conversations',                 [ConversationController::class, 'open']);
        Route::post('conversations/{conversation}/turn', [ConversationController::class, 'turn']);
    });

    // ---- Panel administrativo / operadores (JWT usuario) ----
    Route::middleware(['auth:api', 'throttle:60,1'])->group(function () {

        Route::post('auth/logout', [AuthController::class, 'logout']);

        Route::get('dashboard',  [DashboardController::class, 'index'])
            ->middleware('can:dashboard.view');

        Route::apiResource('residents', ResidentController::class)
            ->middleware('can:residents.manage');

        Route::get('visits',                 [VisitController::class, 'index']);
        Route::post('visits',                [VisitController::class, 'store']);
        Route::patch('visits/{visit}/resolve', [VisitController::class, 'resolve']);

        Route::get('conversations',              [ConversationController::class, 'history'])
            ->middleware('can:conversations.read');
        Route::get('conversations/{conversation}', [ConversationController::class, 'show'])
            ->middleware('can:conversations.read');

        // Teleasistencia
        Route::get('incidents',                  [IncidentController::class, 'index']);
        Route::post('incidents/{incident}/take', [IncidentController::class, 'take']);
        Route::post('incidents/{incident}/close',[IncidentController::class, 'close']);
        Route::post('operators/status',          [OperatorController::class, 'updateStatus']);
    });

    // ---- QR público de visita programada ----
    Route::get('visits/qr/{token}', [VisitController::class, 'qr'])->name('visits.qr');
});
