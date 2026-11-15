
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('order_items', function (Blueprint $table) {
            $table->id();

            $table->foreignId('order_id')
                ->constrained()
                ->cascadeOnDelete();

            $table->foreignId('offer_id')
                ->constrained()
                ->restrictOnDelete();

            $table->foreignId('digital_key_id')
                ->nullable()
                ->unique()
                ->constrained()
                ->restrictOnDelete();

            $table->string('product_name');
            $table->string('region');
            $table->decimal('unit_price', 10, 2);
            $table->char('currency', 3)->default('EUR');

            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('order_items');
    }
};
