<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class CheckoutController extends Controller
{
    /**
     * Complete a simulated checkout and deliver digital keys.
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'items' => ['required', 'array', 'min:1', 'max:20'],
            'items.*.offer_id' => [
                'required',
                'integer',
                'distinct',
                'exists:offers,id',
            ],
        ]);

        $userId = $request->user()->id;

        $orderNumber = DB::transaction(function () use (
            $validated,
            $userId
        ) {
            $purchases = [];
            $currency = null;
            $subtotal = 0;

            // Check that every selected offer is available.
            foreach ($validated['items'] as $item) {
                $offer = DB::table('offers')
                    ->join(
                        'products',
                        'products.id',
                        '=',
                        'offers.product_id'
                    )
                    ->join(
                        'sellers',
                        'sellers.id',
                        '=',
                        'offers.seller_id'
                    )
                    ->where('offers.id', $item['offer_id'])
                    ->select(
                        'offers.*',
                        'products.name as product_name',
                        'products.is_active as product_active',
                        'sellers.is_active as seller_active'
                    )
                    ->lockForUpdate()
                    ->first();

                if (
                    !$offer ||
                    !$offer->is_active ||
                    !$offer->product_active ||
                    !$offer->seller_active ||
                    $offer->stock_quantity < 1
                ) {
                    throw ValidationException::withMessages([
                        'items' => [
                            'One of the selected offers is no longer available.',
                        ],
                    ]);
                }

                // Keep all items in the order in the same currency.
                if (
                    $currency !== null &&
                    $currency !== $offer->currency
                ) {
                    throw ValidationException::withMessages([
                        'items' => [
                            'All products must use the same currency.',
                        ],
                    ]);
                }

                $currency = $offer->currency;

                // Find an available digital key for this offer.
                $digitalKey = DB::table('digital_keys')
                    ->where('offer_id', $offer->id)
                    ->where('status', 'available')
                    ->orderBy('id')
                    ->lockForUpdate()
                    ->first();

                if (!$digitalKey) {
                    throw ValidationException::withMessages([
                        'items' => [
                            'No digital keys are currently available for one of your selected offers.',
                        ],
                    ]);
                }

                $purchases[] = [
                    'offer' => $offer,
                    'key' => $digitalKey,
                ];

                $subtotal += (float) $offer->price;
            }

            $subtotal = round($subtotal, 2);
            $now = now();

            $orderNumber = 'KN-' . Str::upper(Str::random(10));

            // Create the order using simulated payment.
            $orderId = DB::table('orders')->insertGetId([
                'user_id' => $userId,
                'order_number' => $orderNumber,
                'status' => 'paid',
                'subtotal' => number_format($subtotal, 2, '.', ''),
                'total' => number_format($subtotal, 2, '.', ''),
                'currency' => $currency ?? 'EUR',
                'payment_provider' => 'simulated',
                'payment_reference' => 'SIM-' . Str::upper(Str::random(12)),
                'paid_at' => $now,
                'created_at' => $now,
                'updated_at' => $now,
            ]);

            // Mark keys as sold and reduce available stock.
            foreach ($purchases as $purchase) {
                $offer = $purchase['offer'];
                $key = $purchase['key'];

                $keyUpdated = DB::table('digital_keys')
                    ->where('id', $key->id)
                    ->where('status', 'available')
                    ->update([
                        'status' => 'sold',
                        'sold_at' => $now,
                        'updated_at' => $now,
                    ]);

                if ($keyUpdated !== 1) {
                    throw ValidationException::withMessages([
                        'items' => [
                            'A selected digital key is no longer available.',
                        ],
                    ]);
                }

                $stockUpdated = DB::table('offers')
                    ->where('id', $offer->id)
                    ->where('stock_quantity', '>', 0)
                    ->decrement('stock_quantity');

                if ($stockUpdated !== 1) {
                    throw ValidationException::withMessages([
                        'items' => [
                            'The selected offer is out of stock.',
                        ],
                    ]);
                }

                // Save the purchased product in the order.
                DB::table('order_items')->insert([
                    'order_id' => $orderId,
                    'offer_id' => $offer->id,
                    'digital_key_id' => $key->id,
                    'product_name' => $offer->product_name,
                    'region' => $offer->region,
                    'unit_price' => $offer->price,
                    'currency' => $offer->currency,
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);
            }

            return $orderNumber;
        });

        return response()->json([
            'message' => 'Demo checkout completed successfully. No real payment was processed.',
            'data' => $this->getOrderDetails($userId, $orderNumber),
        ], 201);
    }

    /**
     * Return the authenticated user's order history.
     */
    public function index(Request $request): JsonResponse
    {
        $orders = DB::table('orders')
            ->where('user_id', $request->user()->id)
            ->orderByDesc('created_at')
            ->get();

        return response()->json([
            'data' => $orders,
        ]);
    }

    /**
     * Show one order belonging to the authenticated user.
     */
    public function show(
        Request $request,
        string $orderNumber
    ): JsonResponse {
        return response()->json([
            'data' => $this->getOrderDetails(
                $request->user()->id,
                $orderNumber
            ),
        ]);
    }

    /**
     * Get order details and decrypt delivered digital keys.
     */
    private function getOrderDetails(
        int $userId,
        string $orderNumber
    ): array {
        $order = DB::table('orders')
            ->where('user_id', $userId)
            ->where('order_number', $orderNumber)
            ->first();

        if (!$order) {
            abort(404, 'Order not found.');
        }

        // Use Eloquent so Laravel decrypts the digital key
        // through the encrypted cast in the DigitalKey model.
        $items = \App\Models\OrderItem::query()
            ->where('order_id', $order->id)
            ->with('digitalKey')
            ->get()
            ->map(function ($item) {
                return [
                    'id' => $item->id,
                    'product_name' => $item->product_name,
                    'region' => $item->region,
                    'unit_price' => $item->unit_price,
                    'currency' => $item->currency,
                    'delivered_key' => $item->digitalKey?->key_value,
                ];
            });

        return [
            'order' => $order,
            'items' => $items,
        ];
    }
}
