<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\HomepageBlock;
use Illuminate\Http\JsonResponse;

class HomepageController extends Controller
{
    public function index(): JsonResponse
    {
        $blocks = HomepageBlock::query()
            ->where('is_active', true)
            ->orderBy('sort_order')
            ->with([
                'products' => function ($query) {
                    $query->where('products.is_active', true)
                        ->with([
                            'category',
                            'offers' => function ($offerQuery) {
                                $offerQuery
                                    ->where('offers.is_active', true)
                                    ->where('offers.stock_quantity', '>', 0)
                                    ->whereHas('seller', function ($sellerQuery) {
                                        $sellerQuery->where('is_active', true);
                                    })
                                    ->with('seller')
                                    ->orderBy('price');
                            },
                        ]);
                },
            ])
            ->get();

        return response()->json([
            'data' => $blocks,
        ]);
    }
}
