<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Migración de ejemplo (visits). El esquema completo equivalente está en
 * database/schema.sql; aquí se muestra la convención Laravel para que el
 * equipo genere el resto con `php artisan make:migration`.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('visits', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('condominium_id')->constrained()->cascadeOnDelete();
            $table->foreignUuid('visitor_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignUuid('resident_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignUuid('apartment_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignUuid('device_id')->nullable()->constrained()->nullOnDelete();
            $table->enum('type', ['visit', 'delivery', 'service', 'emergency'])->default('visit');
            $table->enum('status', [
                'pending', 'notified', 'approved', 'rejected',
                'scheduled', 'escalated', 'completed', 'expired',
            ])->default('pending');
            $table->string('qr_token', 64)->nullable()->unique();
            $table->timestamp('qr_expires_at')->nullable();
            $table->timestamp('scheduled_for')->nullable();
            $table->timestamp('resolved_at')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->index(['condominium_id', 'created_at']);
            $table->index('status');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('visits');
    }
};
