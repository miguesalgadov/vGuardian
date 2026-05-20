<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // Add delivery_destination column and qr_used status to visits
        DB::statement("ALTER TABLE visits ADD COLUMN IF NOT EXISTS delivery_destination VARCHAR(20) CHECK (delivery_destination IN ('lobby','apartment','locker'))");
        DB::statement("ALTER TYPE visit_status ADD VALUE IF NOT EXISTS 'qr_used'");
    }

    public function down(): void
    {
        DB::statement("ALTER TABLE visits DROP COLUMN IF EXISTS delivery_destination");
        // Note: removing enum values from PostgreSQL requires recreating the type
    }
};
