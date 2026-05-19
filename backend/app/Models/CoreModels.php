<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * Modelos núcleo del MVP.
 * Nota: en un proyecto real cada clase vive en su propio archivo
 * (app/Models/Conversation.php, etc.). Se agrupan aquí para la entrega.
 */

class Conversation extends Model
{
    use HasUuids, SoftDeletes;

    protected $guarded = [];

    protected $casts = [
        'started_at' => 'datetime',
        'ended_at'   => 'datetime',
    ];

    public function messages(): HasMany
    {
        return $this->hasMany(ConversationMessage::class);
    }

    public function condominium(): BelongsTo
    {
        return $this->belongsTo(Condominium::class);
    }

    public function visit(): BelongsTo
    {
        return $this->belongsTo(Visit::class);
    }

    public function operator(): BelongsTo
    {
        return $this->belongsTo(Operator::class);
    }
}

class ConversationMessage extends Model
{
    public $timestamps = false;
    protected $guarded = [];
    protected $casts = [
        'confidence' => 'float',
        'created_at' => 'datetime',
    ];

    protected static function booted(): void
    {
        static::creating(fn ($m) => $m->created_at ??= now());
    }

    public function conversation(): BelongsTo
    {
        return $this->belongsTo(Conversation::class);
    }
}

class Resident extends Model
{
    use HasUuids, SoftDeletes;

    protected $guarded = [];
    protected $casts = ['auto_approve' => 'boolean'];

    public function apartment(): BelongsTo
    {
        return $this->belongsTo(Apartment::class);
    }

    public function visits(): HasMany
    {
        return $this->hasMany(Visit::class);
    }

    public function authorizations(): HasMany
    {
        return $this->hasMany(ResidentAuthorization::class);
    }
}

class Visit extends Model
{
    use HasUuids, SoftDeletes;

    protected $guarded = [];
    protected $casts = [
        'scheduled_for' => 'datetime',
        'qr_expires_at' => 'datetime',
        'resolved_at'   => 'datetime',
    ];

    public function resident(): BelongsTo
    {
        return $this->belongsTo(Resident::class);
    }

    public function visitor(): BelongsTo
    {
        return $this->belongsTo(Visitor::class);
    }

    public function apartment(): BelongsTo
    {
        return $this->belongsTo(Apartment::class);
    }

    public function scopeToday($q)
    {
        return $q->whereDate('created_at', today());
    }
}
