<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Product;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ProductController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $filters = $request->validate([
            'search' => ['nullable', 'string', 'max:100'],
            'category' => ['nullable', 'string', 'max:100'],
            'platform' => ['nullable', 'string', 'max:50'],
            'region' => ['nullable', 'string', 'max:50'],
            'min_price' => ['nullable', 'numeric', 'min:0'],
            'max_price' => ['nullable', 'numeric', 'min:0'],
            'sort' => ['nullable', 'in:price_asc,price_desc,name_asc,newest'],
        ]);

        if (
            isset($filters['min_price'], $filters['max_price']) &&
            $filters['min_price'] > $filters['max_price']
        ) {
            return response()->json([
                'message' => 'Minimum price cannot exceed maximum price.',
            ], 422);
        }

        // Shared offer filters. Do not type-hint $offers:
        // Laravel supplies either a Builder or a HasMany relation.
        $offerFilter = function ($offers) use ($filters): void {
            $offers->where('is_active', true)
                ->where('stock_quantity', '>', 0)
                ->whereHas('seller', function (Builder $seller) {
                    $seller->where('is_active', true);
                });

            if (!empty($filters['region'])) {
                $offers->where(function ($query) use ($filters) {
                    $query->where('region', $filters['region'])
                        ->orWhere('region', 'Global');
                });
            }

            if (isset($filters['min_price'])) {
                $offers->where('price', '>=', $filters['min_price']);
            }

            if (isset($filters['max_price'])) {
                $offers->where('price', '<=', $filters['max_price']);
            }
        };

        $query = Product::query()
            ->where('is_active', true)
            ->with('category')
            ->whereHas('offers', $offerFilter)
            ->with([
                'offers' => function ($offers) use ($offerFilter) {
                    $offerFilter($offers);

                    $offers->with('seller')->orderBy('price');
                },
            ])
            ->withMin([
                'offers as lowest_price' => $offerFilter,
            ], 'price');

        if (!empty($filters['search'])) {
            $search = $filters['search'];

            $query->where(function (Builder $products) use ($search) {
                $products->where('name', 'like', "%{$search}%")
                    ->orWhere('description', 'like', "%{$search}%");
            });
        }

        if (!empty($filters['category'])) {
            $query->whereHas('category', function (Builder $category) use ($filters) {
                $category->where('slug', $filters['category']);
            });
        }

        if (!empty($filters['platform'])) {
            $query->where('platform', $filters['platform']);
        }

        match ($filters['sort'] ?? 'newest') {
            'price_asc' => $query->orderBy('lowest_price'),
            'price_desc' => $query->orderByDesc('lowest_price'),
            'name_asc' => $query->orderBy('name'),
            default => $query->orderByDesc('created_at'),
        };

        return response()->json(
            $query->paginate(12)->withQueryString()
        );
    }

    public function show(string $slug): JsonResponse
    {
        $product = Product::query()
            ->where('is_active', true)
            ->where('slug', $slug)
            ->whereHas('offers', function (Builder $offers) {
                $offers->where('is_active', true)
                    ->where('stock_quantity', '>', 0)
                    ->whereHas('seller', function (Builder $seller) {
                        $seller->where('is_active', true);
                    });
            })
            ->with('category')
            ->with([
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
            ->firstOrFail();

        return response()->json([
            'data' => $product,
        ]);
    }
}
