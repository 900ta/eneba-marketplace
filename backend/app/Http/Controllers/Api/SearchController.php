<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Product;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SearchController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'q' => ['required', 'string', 'min:2', 'max:100'],
        ]);

        $term = mb_strtolower(trim($validated['q']));

        $queryTokens = preg_split(
            '/\s+/',
            preg_replace('/[^a-z0-9\s]/u', '', $term),
            -1,
            PREG_SPLIT_NO_EMPTY
        );

        $products = Product::query()
            ->where('is_active', true)
            ->whereHas('offers', function ($offers) {
                $offers->where('is_active', true)
                    ->where('stock_quantity', '>', 0)
                    ->whereHas('seller', function (Builder $seller) {
                        $seller->where('is_active', true);
                    });
            })
            ->with([
                'category',
                'offers' => function ($offers) {
                    $offers->where('is_active', true)
                        ->where('stock_quantity', '>', 0)
                        ->whereHas('seller', function (Builder $seller) {
                            $seller->where('is_active', true);
                        })
                        ->with('seller')
                        ->orderBy('price');
                },
            ])
            ->get();

        $results = $products->map(function (Product $product) use ($term, $queryTokens) {
            $name = mb_strtolower($product->name);
            $score = 0;

            // Exact and partial matching.
            if (str_contains($name, $term)) {
                $score = 100;
            } elseif (
                $product->description &&
                str_contains(mb_strtolower($product->description), $term)
            ) {
                $score = 60;
            } else {
                // Simple typo-tolerant matching using Levenshtein distance.
                $nameTokens = preg_split('/\s+/', $name);

                $matchedTokens = 0;

                foreach ($queryTokens as $token) {
                    $bestDistance = PHP_INT_MAX;

                    foreach ($nameTokens as $nameToken) {
                        if (str_contains($nameToken, $token)) {
                            $bestDistance = 0;
                            break;
                        }

                        if (strlen($token) >= 4) {
                            $bestDistance = min(
                                $bestDistance,
                                levenshtein($token, $nameToken)
                            );
                        }
                    }

                    $maxDistance = max(
                        1,
                        (int) floor(strlen($token) * 0.25)
                    );

                    if ($bestDistance <= $maxDistance) {
                        $matchedTokens++;
                    }
                }

                if (count($queryTokens) > 0 && $matchedTokens > 0) {
                    $score = 40 + (40 * $matchedTokens / count($queryTokens));
                }
            }

            return [
                'product' => $product,
                'score' => $score,
            ];
        })
        ->filter(fn ($item) => $item['score'] > 0)
        ->sortByDesc('score')
        ->take(12)
        ->values()
        ->map(fn ($item) => $item['product']);

        return response()->json([
            'query' => $validated['q'],
            'data' => $results,
        ]);
    }
}
