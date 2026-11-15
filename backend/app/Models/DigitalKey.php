<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasOne;

class DigitalKey extends Model
{
    use HasFactory;

    protected $fillable = [
        'offer_id',
        'key_value',
        'status',
        'sold_at',
    ];

    protected $hidden = [
        'key_value',
    ];

    protected function casts(): array
    {
        return [
            'key_value' => 'encrypted',
            'sold_at' => 'datetime',
        ];
    }

    public function offer(): BelongsTo
    {
        return $this->belongsTo(Offer::class);
    }

    public function orderItem(): HasOne
    {
        return $this->hasOne(OrderItem::class);
    }
}
