<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('access_codes', function (Blueprint $table) {
            $table->uuid('id')->primary()->default(DB::raw('gen_random_uuid()'));
            $table->uuid('condominium_id');
            $table->foreign('condominium_id')->references('id')->on('condominiums')->cascadeOnDelete();
            $table->string('code_hash', 255);
            $table->enum('type', ['resident', 'temporary', 'staff', 'master']);
            $table->uuid('owner_resident_id')->nullable();
            $table->foreign('owner_resident_id')->references('id')->on('residents')->nullOnDelete();
            $table->string('label', 120)->nullable();
            $table->timestampTz('valid_from')->useCurrent();
            $table->timestampTz('valid_until')->nullable();
            $table->integer('max_uses')->nullable();
            $table->integer('uses_count')->default(0);
            $table->enum('status', ['active', 'revoked', 'exhausted'])->default('active');
            $table->uuid('created_by_user_id');
            $table->foreign('created_by_user_id')->references('id')->on('users');
            $table->timestamps();
            $table->softDeletes();

            $table->index(['condominium_id', 'status']);
        });

        Schema::create('access_code_attempts', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->uuid('condominium_id');
            $table->uuid('device_id');
            $table->string('code_hash_attempted', 255);
            $table->boolean('success');
            $table->ipAddress('ip_address')->nullable();
            $table->timestampTz('created_at')->useCurrent();

            $table->index(['device_id', 'created_at']);
        });

        Schema::create('lockers', function (Blueprint $table) {
            $table->uuid('id')->primary()->default(DB::raw('gen_random_uuid()'));
            $table->uuid('condominium_id');
            $table->foreign('condominium_id')->references('id')->on('condominiums')->cascadeOnDelete();
            $table->string('number', 10);
            $table->enum('status', ['available', 'occupied', 'maintenance'])->default('available');
            $table->uuid('current_visit_id')->nullable();
            $table->string('current_code', 8)->nullable();
            $table->timestampTz('assigned_at')->nullable();
            $table->timestamps();

            $table->unique(['condominium_id', 'number']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('lockers');
        Schema::dropIfExists('access_code_attempts');
        Schema::dropIfExists('access_codes');
    }
};
