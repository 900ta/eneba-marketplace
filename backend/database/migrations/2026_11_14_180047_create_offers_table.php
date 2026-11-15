
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('offers', function (Blueprint $table) {
            $table->id();

            $table->foreignId('product_id')
                ->constrained()
                ->cascadeOnDelete();

            $table->foreignId('seller_id')
                ->constrained()
                ->cascadeOnDelete();

            $table->decimal('price', 10, 2);
            $table->char('currency', 3)->default('EUR');
            $table->string('region')->default('Global');
            $table->unsignedInteger('stock_quantity')->default(0);
            $table->boolean('is_active')->default(true)->index();

            $table->timestamps();

            $table->unique(
                ['product_id', 'seller_id', 'region'],
                'offers_product_seller_region_unique'
            );
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('offers');
    }
};
