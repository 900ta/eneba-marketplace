<?php

namespace Database\Seeders;

use App\Models\Category;
use App\Models\HomepageBlock;
use App\Models\Offer;
use App\Models\Product;
use App\Models\Seller;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        // 1. Categories
        $categories = [
            'games' => Category::updateOrCreate(
                ['slug' => 'games'],
                [
                    'name' => 'Games',
                    'description' => 'Digital games for PC and consoles.',
                ]
            ),

            'gift-cards' => Category::updateOrCreate(
                ['slug' => 'gift-cards'],
                [
                    'name' => 'Gift Cards',
                    'description' => 'Digital gift cards and wallet credits.',
                ]
            ),
        ];

        // 2. Products
        $catalog = [
            [
                'name' => 'Cyberpunk 2077',
                'slug' => 'cyberpunk-2077',
                'category' => 'games',
                'description' => 'Explore Night City in this open-world RPG.',
                'platform' => 'PC',
                'product_type' => 'game',
                'price' => 29.99,
            ],
            [
                'name' => 'The Witcher 3: Wild Hunt',
                'slug' => 'the-witcher-3',
                'category' => 'games',
                'description' => 'An open-world fantasy role-playing game.',
                'platform' => 'PC',
                'product_type' => 'game',
                'price' => 19.99,
            ],
            [
                'name' => 'Elden Ring',
                'slug' => 'elden-ring',
                'category' => 'games',
                'description' => 'Explore a vast fantasy world.',
                'platform' => 'PC',
                'product_type' => 'game',
                'price' => 39.99,
            ],
            [
                'name' => 'Red Dead Redemption 2',
                'slug' => 'red-dead-redemption-2',
                'category' => 'games',
                'description' => 'An open-world western adventure.',
                'platform' => 'PC',
                'product_type' => 'game',
                'price' => 24.99,
            ],
            [
                'name' => 'Stardew Valley',
                'slug' => 'stardew-valley',
                'category' => 'games',
                'description' => 'Build and manage your own farm.',
                'platform' => 'PC',
                'product_type' => 'game',
                'price' => 13.99,
            ],
            [
                'name' => 'Hades',
                'slug' => 'hades',
                'category' => 'games',
                'description' => 'Fight your way out of the Underworld.',
                'platform' => 'PC',
                'product_type' => 'game',
                'price' => 12.99,
            ],
            [
                'name' => 'Steam Wallet €20',
                'slug' => 'steam-wallet-20',
                'category' => 'gift-cards',
                'description' => 'Digital Steam Wallet credit.',
                'platform' => 'PC',
                'product_type' => 'gift_card',
                'price' => 20.00,
            ],
            [
                'name' => 'PlayStation Store €50',
                'slug' => 'playstation-store-50',
                'category' => 'gift-cards',
                'description' => 'Digital PlayStation Store credit.',
                'platform' => 'PlayStation',
                'product_type' => 'gift_card',
                'price' => 50.00,
            ],
        ];

        $products = [];

        foreach ($catalog as $item) {
            $product = Product::updateOrCreate(
                ['slug' => $item['slug']],
                [
                    'category_id' => $categories[$item['category']]->id,
                    'name' => $item['name'],
                    'description' => $item['description'],
                    'platform' => $item['platform'],
                    'product_type' => $item['product_type'],
                    'image_url' => null,
                    'is_active' => true,
                ]
            );

            $products[$item['slug']] = $product;
        }

        // 3. Demo sellers
        $sellerData = [
            [
                'name' => 'Pixel Keys',
                'slug' => 'pixel-keys',
                'description' => 'Demo digital games retailer.',
            ],
            [
                'name' => 'GameVault',
                'slug' => 'gamevault',
                'description' => 'Demo gaming marketplace seller.',
            ],
            [
                'name' => 'Digital Hub',
                'slug' => 'digital-hub',
                'description' => 'Demo digital products retailer.',
            ],
        ];

        $sellers = [];

        foreach ($sellerData as $item) {
            $seller = Seller::updateOrCreate(
                ['slug' => $item['slug']],
                [
                    'name' => $item['name'],
                    'description' => $item['description'],
                    'is_active' => true,
                ]
            );

            $sellers[] = $seller;
        }

        // 4. Offers and simulated digital keys
        $priceAdjustments = [-0.50, 0.25, 1.00];

        foreach ($catalog as $item) {
            $product = $products[$item['slug']];

            foreach ($sellers as $index => $seller) {
                $region = $index === 1 ? 'Europe' : 'Global';

                $offer = Offer::updateOrCreate(
                    [
                        'product_id' => $product->id,
                        'seller_id' => $seller->id,
                        'region' => $region,
                    ],
                    [
                        'price' => max(
                            1,
                            $item['price'] + $priceAdjustments[$index]
                        ),
                        'currency' => 'EUR',
                        'stock_quantity' => 0,
                        'is_active' => true,
                    ]
                );

                // Add demo keys without duplicating them on reruns.
                $existingKeys = $offer->digitalKeys()->count();

                for ($number = $existingKeys + 1; $number <= 2; $number++) {
                    $offer->digitalKeys()->create([
                        'key_value' => 'DEMO-NOT-REDEEMABLE-'
                            . $offer->id . '-'
                            . $number . '-'
                            . Str::upper(Str::random(8)),
                        'status' => 'available',
                    ]);
                }

                $availableKeys = $offer->digitalKeys()
                    ->where('status', 'available')
                    ->count();

                $offer->update([
                    'stock_quantity' => $availableKeys,
                ]);
            }
        }

        // 5. Homepage banner
        HomepageBlock::updateOrCreate(
            ['key' => 'main-banner'],
            [
                'title' => 'Great games. Better prices.',
                'subtitle' => 'Discover games and digital gift cards.',
                'type' => 'banner',
                'link_url' => '/store',
                'is_active' => true,
                'sort_order' => 0,
            ]
        );

        // 6. Best sellers section
        $bestSellers = HomepageBlock::updateOrCreate(
            ['key' => 'best-sellers'],
            [
                'title' => 'Best Sellers',
                'subtitle' => 'Popular games in our marketplace.',
                'type' => 'products',
                'link_url' => '/store',
                'is_active' => true,
                'sort_order' => 1,
            ]
        );

        $bestSellers->products()->sync([
            $products['cyberpunk-2077']->id => ['sort_order' => 0],
            $products['the-witcher-3']->id => ['sort_order' => 1],
            $products['elden-ring']->id => ['sort_order' => 2],
            $products['red-dead-redemption-2']->id => ['sort_order' => 3],
        ]);

        // 7. Special deals section
        $deals = HomepageBlock::updateOrCreate(
            ['key' => 'special-deals'],
            [
                'title' => 'Special Deals',
                'subtitle' => 'Discover more games for less.',
                'type' => 'products',
                'link_url' => '/store',
                'is_active' => true,
                'sort_order' => 2,
            ]
        );

        $deals->products()->sync([
            $products['stardew-valley']->id => ['sort_order' => 0],
            $products['hades']->id => ['sort_order' => 1],
            $products['steam-wallet-20']->id => ['sort_order' => 2],
        ]);
    }
}
