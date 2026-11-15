import { apiFetch } from './api';
import { useEffect, useState, type FormEvent } from 'react'
import './App.css'
import AuthModal from './AuthModal'

interface AuthUser {
  id: number
  name: string
  email: string
}

interface Seller {
  id: number
  name: string
  slug: string
}

interface Offer {
  id: number
  price: string | number
  currency: string
  region: string
  stock_quantity: number
  seller: Seller
}

interface Category {
  id: number
  name: string
  slug: string
}

interface Product {
  id: number
  name: string
  slug: string
  description: string | null
  platform: string | null
  product_type: string
  image_url: string | null
  category?: Category
  offers: Offer[]
}

interface HomepageBlock {
  id: number
  key: string
  title: string | null
  subtitle: string | null
  type: string
  image_url: string | null
  products: Product[]
}

interface CartItem {
  product: Product
  offer: Offer
}

interface OrderSummary {
  id: number
  user_id: number
  order_number: string
  status: string
  subtotal: string | number
  total: string | number
  currency: string
  payment_provider: string
  payment_reference: string | null
  paid_at: string | null
  created_at: string
  updated_at: string
}

interface DeliveredOrderItem {
  id: number
  product_name: string
  region: string
  unit_price: string | number
  currency: string
  delivered_key: string | null
}

interface OrderDetails {
  order: OrderSummary
  items: DeliveredOrderItem[]
}

type Page =
  | 'home'
  | 'store'
  | 'search'
  | 'product'
  | 'cart'
  | 'orders'
  | 'order-detail'
  | 'order-success'

function lowestPrice(product: Product): number | null {
  if (!product.offers?.length) return null
  return Math.min(...product.offers.map((offer) => Number(offer.price)))
}

function formatDate(value: string | null): string {
  if (!value) return '—'

  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString()
}

function ProductCard({
  product,
  onOpen,
}: {
  product: Product
  onOpen: (slug: string) => void
}) {
  const price = lowestPrice(product)

  return (
    <button className="product-card" onClick={() => onOpen(product.slug)}>
      <div
        className={`product-image ${product.image_url ? 'has-image' : ''}`}
        style={
          product.image_url
            ? { backgroundImage: `url("${product.image_url}")` }
            : undefined
        }
      >
        {!product.image_url && (
          <div className="image-placeholder">
            <span>
              {product.product_type === 'gift_card' ? 'GIFT CARD' : 'GAME KEY'}
            </span>
            <strong>{product.name}</strong>
          </div>
        )}
        <span className="product-platform">
          {product.platform || 'Digital'}
        </span>
      </div>

      <div className="product-info">
        <span className="product-category">
          {product.category?.name || 'Digital product'}
        </span>

        <h3>{product.name}</h3>

        <div className="product-price">
          <div>
            <span className="price-caption">Starting from</span>
            <strong>
              {price !== null ? `€${price.toFixed(2)}` : 'Unavailable'}
            </strong>
          </div>

          <span className="offer-count">
            {product.offers?.length || 0} offers
          </span>
        </div>
      </div>
    </button>
  )
}

function OrderItems({
  items,
  onCopy,
}: {
  items: DeliveredOrderItem[]
  onCopy: (key: string) => void
}) {
  return (
    <div className="order-items-list">
      {items.map((item) => (
        <article className="order-item-card" key={item.id}>
          <div className="order-item-heading">
            <div>
              <strong>{item.product_name}</strong>
              <span>{item.region} region</span>
            </div>
            <strong>
              {item.currency} {Number(item.unit_price).toFixed(2)}
            </strong>
          </div>

          {item.delivered_key ? (
            <div className="delivered-key-box">
              <div className="delivered-key-content">
                <span>Delivered demo key</span>
                <code>{item.delivered_key}</code>
              </div>
              <button
                className="small-primary"
                type="button"
                onClick={() => onCopy(item.delivered_key as string)}
              >
                Copy key
              </button>
            </div>
          ) : (
            <p className="key-unavailable">
              No digital key is attached to this order item.
            </p>
          )}
          <p className="demo-key-note">
            Demonstration only — this key is not redeemable in a real game or
            store.
          </p>
        </article>
      ))}
    </div>
  )
}

function App() {
  const [page, setPage] = useState<Page>('home')

  const [blocks, setBlocks] = useState<HomepageBlock[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [searchResults, setSearchResults] = useState<Product[]>([])
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [cart, setCart] = useState<CartItem[]>([])

  const [orders, setOrders] = useState<OrderSummary[]>([])
  const [selectedOrder, setSelectedOrder] = useState<OrderDetails | null>(null)
  const [completedOrder, setCompletedOrder] = useState<OrderDetails | null>(null)

  const [searchText, setSearchText] = useState('')

  const [filters, setFilters] = useState({
    category: '',
    platform: '',
    region: '',
    min_price: '',
    max_price: '',
    sort: 'newest',
  })

  const [loading, setLoading] = useState(false)
  const [checkoutLoading, setCheckoutLoading] = useState(false)
  const [ordersLoading, setOrdersLoading] = useState(false)
  const [orderLoading, setOrderLoading] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  // Authentication state.
  const [authOpen, setAuthOpen] = useState(false)
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null)

  // Restore an existing session when the app opens.
  useEffect(() => {
    const token = sessionStorage.getItem('keynest_token')
    if (!token) return

    let cancelled = false

    const restoreSession = async () => {
      try {
        const response = await apiFetch('/api/user', {
          headers: {
            Accept: 'application/json',
            Authorization: `Bearer ${token}`,
          },
        })

        if (!response.ok) throw new Error('Session expired.')

        const result = await response.json()

        if (!cancelled) setCurrentUser(result.user)
      } catch {
        if (!cancelled) sessionStorage.removeItem('keynest_token')
      }
    }

    restoreSession()

    return () => {
      cancelled = true
    }
  }, [])

  // Handle successful login or registration.
  const handleAuthSuccess = (user: AuthUser, token: string) => {
    sessionStorage.setItem('keynest_token', token)
    setCurrentUser(user)
    setAuthOpen(false)
    setNotice(`Welcome to KeyNest, ${user.name}!`)
  }

  // Handle logout.
  const handleLogout = async () => {
    const token = sessionStorage.getItem('keynest_token')
    let message = 'You have been signed out.'

    try {
      if (token) {
        const response = await apiFetch('/api/logout', {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            Authorization: `Bearer ${token}`,
          },
        })

        if (!response.ok) {
          message = 'Signed out locally. Server confirmation was unavailable.'
        }
      }
    } catch {
      message = 'Signed out locally. Server connection was unavailable.'
    } finally {
      sessionStorage.removeItem('keynest_token')
      setCurrentUser(null)
      setOrders([])
      setSelectedOrder(null)
      setCompletedOrder(null)
      setPage('home')
      setNotice(message)
    }
  }

  // Load homepage content from Laravel.
  useEffect(() => {
    const loadHomepage = async () => {
      try {
        const response = await apiFetch('/api/homepage')

        if (!response.ok) throw new Error('Could not load homepage.')

        const result = await response.json()
        setBlocks(result.data || [])
      } catch {
        setError(
          'Unable to connect to the marketplace. Check that Laravel is running.',
        )
      }
    }

    loadHomepage()
  }, [])

  // Load filtered products from Laravel.
  useEffect(() => {
    if (page !== 'store') return

    const controller = new AbortController()

    const loadProducts = async () => {
      setLoading(true)
      setError('')

      try {
        const params = new URLSearchParams()

        Object.entries(filters).forEach(([key, value]) => {
          if (value) params.set(key, value)
        })

        const response = await apiFetch(`/api/products?${params.toString()}`, {
          signal: controller.signal,
        })

        if (!response.ok) throw new Error('Could not load products.')

        const result = await response.json()
        setProducts(result.data || [])
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return
        setError('Could not load the store. Please try again.')
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }

    loadProducts()

    return () => controller.abort()
  }, [page, filters])

  // Load the authenticated user's order history.
  useEffect(() => {
    if (page !== 'orders') return

    const token = sessionStorage.getItem('keynest_token')

    if (!currentUser || !token) {
      setNotice('Please sign in to view your order history.')
      setAuthOpen(true)
      setPage('home')
      return
    }

    const controller = new AbortController()

    const loadOrders = async () => {
      setOrdersLoading(true)
      setError('')

      try {
        const response = await apiFetch('/api/orders', {
          signal: controller.signal,
          headers: {
            Accept: 'application/json',
            Authorization: `Bearer ${token}`,
          },
        })

        const result = await response.json()

        if (!response.ok) {
          throw new Error(result.message || 'Could not load your orders.')
        }

        setOrders(result.data || [])
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return
        setError(
          err instanceof Error ? err.message : 'Could not load your orders.',
        )
      } finally {
        if (!controller.signal.aborted) setOrdersLoading(false)
      }
    }

    loadOrders()

    return () => controller.abort()
  }, [page, currentUser])

  const goHome = () => {
    setPage('home')
    setSelectedProduct(null)
    setError('')
    setNotice('')
  }

  const openStore = () => {
    setPage('store')
    setSelectedProduct(null)
    setError('')
    setNotice('')
  }

  // Search products.
  const handleSearch = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const term = searchText.trim()
    if (term.length < 2) return

    setLoading(true)
    setError('')
    setNotice('')

    try {
      const response = await apiFetch(
        `/api/search?q=${encodeURIComponent(term)}`,
      )
      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.message || 'Search failed.')
      }

      setSearchResults(result.data || [])
      setPage('search')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed.')
    } finally {
      setLoading(false)
    }
  }

  // Load an individual product and its current seller offers.
  const openProduct = async (slug: string) => {
    setPage('product')
    setSelectedProduct(null)
    setLoading(true)
    setError('')
    setNotice('')

    try {
      const response = await apiFetch(
        `/api/products/${encodeURIComponent(slug)}`,
      )
      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.message || 'Product not found.')
      }

      setSelectedProduct(result.data)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Could not load product.',
      )
    } finally {
      setLoading(false)
    }
  }

  // Add one seller offer to the basket.
  const addToCart = (product: Product, offer: Offer) => {
    const exists = cart.some((item) => item.offer.id === offer.id)

    if (exists) {
      setNotice('This offer is already in your basket.')
      return
    }

    if (offer.stock_quantity < 1) {
      setNotice('This offer is currently out of stock.')
      return
    }

    setCart((current) => [...current, { product, offer }])
    setNotice(`${product.name} added to your basket.`)
  }

  const removeFromCart = (offerId: number) => {
    setCart((current) =>
      current.filter((item) => item.offer.id !== offerId),
    )
  }

  const cartTotal = cart.reduce(
    (total, item) => total + Number(item.offer.price),
    0,
  )

  // Submit the basket to Laravel. The backend calculates the final price.
  const handleCheckout = async () => {
    if (cart.length === 0) return

    const token = sessionStorage.getItem('keynest_token')

    if (!currentUser || !token) {
      setNotice('Please sign in before continuing to checkout.')
      setAuthOpen(true)
      return
    }

    setCheckoutLoading(true)
    setError('')
    setNotice('')

    try {
      const response = await apiFetch('/api/checkout', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          items: cart.map((item) => ({ offer_id: item.offer.id })),
        }),
      })

      const result: {
        message?: string
        data?: OrderDetails
        errors?: Record<string, string[]>
      } = await response.json()

      if (!response.ok) {
        const validationMessage = result.errors
          ? Object.values(result.errors).flat().join(' ')
          : ''
        throw new Error(
          validationMessage || result.message || 'Checkout could not be completed.',
        )
      }

      if (!result.data?.order || !Array.isArray(result.data.items)) {
        throw new Error('The server returned an unexpected order response.')
      }

      setCompletedOrder(result.data)
      setCart([])
      setPage('order-success')
      setNotice('')
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Checkout failed. Please try again.',
      )
    } finally {
      setCheckoutLoading(false)
    }
  }

  // Open one order and retrieve its delivered keys.
  const openOrder = async (orderNumber: string) => {
    const token = sessionStorage.getItem('keynest_token')

    if (!currentUser || !token) {
      setNotice('Please sign in to view this order.')
      setAuthOpen(true)
      return
    }

    setPage('order-detail')
    setSelectedOrder(null)
    setOrderLoading(true)
    setError('')

    try {
      const response = await apiFetch(
        `/api/orders/${encodeURIComponent(orderNumber)}`,
        {
          headers: {
            Accept: 'application/json',
            Authorization: `Bearer ${token}`,
          },
        },
      )

      const result: { data?: OrderDetails; message?: string } =
        await response.json()

      if (!response.ok) {
        throw new Error(result.message || 'Could not load this order.')
      }

      if (!result.data?.order || !Array.isArray(result.data.items)) {
        throw new Error('The server returned an unexpected order response.')
      }

      setSelectedOrder(result.data)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Could not load this order.',
      )
      setPage('orders')
    } finally {
      setOrderLoading(false)
    }
  }

  const handleCopyKey = async (key: string) => {
    try {
      await navigator.clipboard.writeText(key)
      setNotice('Demo key copied to clipboard.')
    } catch {
      setNotice('Copy was unavailable. Select the key and copy it manually.')
    }
  }

  const banner = blocks.find((block) => block.type === 'banner')
  const homepageSections = blocks.filter(
    (block) => block.type !== 'banner',
  )

  return (
    <div className="app">
      <div className="announcement">
        <span>YOUR NEXT FAVOURITE GAME STARTS HERE</span>
        <span>Digital games. Great prices. Instant delivery.</span>
      </div>

      <header className="main-header">
        <div className="header-inner">
          <button className="brand" onClick={goHome}>
            KEYNEST<span>.</span>
          </button>

          <button className="store-link" onClick={openStore}>
            Store
          </button>

          <form className="search-form" onSubmit={handleSearch}>
            <span className="search-icon">⌕</span>
            <input
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              placeholder="Search games, gift cards and more..."
              aria-label="Search products"
              minLength={2}
            />
            <button type="submit">Search</button>
          </form>

          <div className="header-actions">
            <button
              className="header-link"
              onClick={() => setPage('cart')}
            >
              Basket <span className="cart-count">{cart.length}</span>
            </button>

            {currentUser && (
              <button
                className="header-link"
                onClick={() => {
                  setError('')
                  setPage('orders')
                }}
              >
                Orders
              </button>
            )}

            {currentUser ? (
              <>
                <span className="header-user">Hi, {currentUser.name}</span>
                <button className="account-button" onClick={handleLogout}>
                  Sign out
                </button>
              </>
            ) : (
              <button
                className="account-button"
                onClick={() => setAuthOpen(true)}
              >
                Sign in
              </button>
            )}
          </div>
        </div>
      </header>

      <nav className="category-nav">
        <div className="category-inner">
          <button onClick={openStore}>All products</button>

          <button
            onClick={() => {
              setFilters((old) => ({ ...old, category: 'games' }))
              setPage('store')
            }}
          >
            Games
          </button>

          <button
            onClick={() => {
              setFilters((old) => ({ ...old, category: 'gift-cards' }))
              setPage('store')
            }}
          >
            Gift cards
          </button>

          <span className="nav-note">
            Great deals on digital entertainment
          </span>
        </div>
      </nav>

      <main className="main-content">
        {notice && (
          <div className="notice">
            {notice}
            <button onClick={() => setNotice('')}>×</button>
          </div>
        )}

        {error && <div className="error-message">{error}</div>}

        {loading && (
          <div className="loading-message">Loading marketplace...</div>
        )}

        {/* Homepage */}
        {page === 'home' && !loading && (
          <>
            <section className="hero">
              <div className="hero-content">
                <span className="eyebrow">LEVEL UP YOUR GAME</span>
                <h1>{banner?.title || 'Great games. Better prices.'}</h1>
                <p>
                  {banner?.subtitle ||
                    'Discover your next adventure and find great deals on digital games and gift cards.'}
                </p>
                <button className="primary-button" onClick={openStore}>
                  Explore the store <span>→</span>
                </button>
                <div className="hero-features">
                  <span>✓ Great prices</span>
                  <span>✓ Digital delivery</span>
                  <span>✓ Multiple sellers</span>
                </div>
              </div>

              <div className="hero-art">
                <div className="hero-orbit orbit-one" />
                <div className="hero-orbit orbit-two" />
                <div className="hero-glow" />
                <div className="hero-key">KEY</div>
                <div className="hero-art-label">GAME ON.</div>
              </div>
            </section>

            {blocks.length === 0 ? (
              <div className="empty-state">
                Homepage content is being prepared.
              </div>
            ) : (
              homepageSections.map((section) => (
                <section className="product-section" key={section.id}>
                  <div className="section-heading">
                    <div>
                      <span className="eyebrow">
                        PICK YOUR NEXT ADVENTURE
                      </span>
                      <h2>{section.title}</h2>
                      <p>{section.subtitle}</p>
                    </div>
                    <button className="text-button" onClick={openStore}>
                      View all <span>→</span>
                    </button>
                  </div>

                  <div className="product-grid">
                    {section.products?.map((product) => (
                      <ProductCard
                        key={product.id}
                        product={product}
                        onOpen={openProduct}
                      />
                    ))}
                  </div>
                </section>
              ))
            )}
          </>
        )}

        {/* Store catalogue with category, platform, region, price and sorting filters. */}
        {page === 'store' && (
          <section className="store-page">
            <div className="page-heading">
              <span className="eyebrow">THE MARKETPLACE</span>
              <h1>Explore the store</h1>
              <p>
                Find your next game and compare offers from different sellers.
              </p>
            </div>

            <div className="filters">
              <label>
                Category
                <select
                  value={filters.category}
                  onChange={(event) =>
                    setFilters((old) => ({
                      ...old,
                      category: event.target.value,
                    }))
                  }
                >
                  <option value="">All categories</option>
                  <option value="games">Games</option>
                  <option value="gift-cards">Gift cards</option>
                </select>
              </label>

              <label>
                Platform
                <select
                  value={filters.platform}
                  onChange={(event) =>
                    setFilters((old) => ({
                      ...old,
                      platform: event.target.value,
                    }))
                  }
                >
                  <option value="">All platforms</option>
                  <option value="PC">PC</option>
                  <option value="PlayStation">PlayStation</option>
                </select>
              </label>

              <label>
                Region
                <select
                  value={filters.region}
                  onChange={(event) =>
                    setFilters((old) => ({
                      ...old,
                      region: event.target.value,
                    }))
                  }
                >
                  <option value="">All regions</option>
                  <option value="Europe">Europe</option>
                  <option value="Global">Global</option>
                </select>
              </label>

              <label>
                Minimum price (€)
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={filters.min_price}
                  onChange={(event) =>
                    setFilters((old) => ({
                      ...old,
                      min_price: event.target.value,
                    }))
                  }
                  placeholder="Any"
                />
              </label>

              <label>
                Maximum price (€)
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={filters.max_price}
                  onChange={(event) =>
                    setFilters((old) => ({
                      ...old,
                      max_price: event.target.value,
                    }))
                  }
                  placeholder="Any"
                />
              </label>

              <label>
                Sort by
                <select
                  value={filters.sort}
                  onChange={(event) =>
                    setFilters((old) => ({
                      ...old,
                      sort: event.target.value,
                    }))
                  }
                >
                  <option value="newest">Newest</option>
                  <option value="price_asc">Price: low to high</option>
                  <option value="price_desc">Price: high to low</option>
                  <option value="name_asc">Name: A–Z</option>
                </select>
              </label>
            </div>

            {!loading && (
              <>
                <div className="results-heading">
                  <strong>{products.length} products</strong>
                  <span>Compare offers from our demo sellers</span>
                </div>

                <div className="product-grid">
                  {products.map((product) => (
                    <ProductCard
                      key={product.id}
                      product={product}
                      onOpen={openProduct}
                    />
                  ))}
                </div>

                {products.length === 0 && (
                  <div className="empty-state">
                    No products found. Try changing your filters.
                  </div>
                )}
              </>
            )}
          </section>
        )}

        {/* Search results */}
        {page === 'search' && !loading && (
          <section className="store-page">
            <div className="page-heading">
              <span className="eyebrow">SEARCH RESULTS</span>
              <h1>Results for "{searchText}"</h1>
              <p>{searchResults.length} matching products found.</p>
            </div>

            <div className="product-grid">
              {searchResults.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  onOpen={openProduct}
                />
              ))}
            </div>

            {searchResults.length === 0 && (
              <div className="empty-state">
                No matching products. Try another search.
              </div>
            )}
          </section>
        )}

        {/* Product details and seller offers */}
        {page === 'product' && selectedProduct && (
          <section className="product-page">
            <button className="back-button" onClick={openStore}>
              ← Back to store
            </button>

            <div className="product-detail">
              <div className="detail-art">
                <span>
                  {selectedProduct.category?.name || 'Digital product'}
                </span>
                <strong>{selectedProduct.name}</strong>
                <small>
                  {selectedProduct.platform || 'Digital delivery'}
                </small>
              </div>

              <div className="detail-info">
                <span className="eyebrow">DIGITAL PRODUCT</span>
                <h1>{selectedProduct.name}</h1>
                <p>{selectedProduct.description}</p>

                <div className="detail-meta">
                  <span>
                    Platform:{' '}
                    <strong>{selectedProduct.platform || 'Digital'}</strong>
                  </span>
                  <span>
                    Category:{' '}
                    <strong>{selectedProduct.category?.name}</strong>
                  </span>
                </div>

                <h2>Compare seller offers</h2>

                <div className="offer-list">
                  {selectedProduct.offers?.map((offer) => (
                    <div className="offer-row" key={offer.id}>
                      <div>
                        <strong>
                          {offer.seller?.name || 'Marketplace seller'}
                        </strong>
                        <span>
                          {offer.region} · {offer.stock_quantity} available
                        </span>
                      </div>

                      <div className="offer-action">
                        <strong>
                          €{Number(offer.price).toFixed(2)}
                        </strong>
                        <button
                          className="small-primary"
                          onClick={() => addToCart(selectedProduct, offer)}
                          disabled={offer.stock_quantity < 1}
                        >
                          {offer.stock_quantity > 0 ? 'Add' : 'Sold out'}
                        </button>
                      </div>
                    </div>
                  ))}

                  {selectedProduct.offers?.length === 0 && (
                    <p>No active seller offers are available right now.</p>
                  )}
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Shopping basket and checkout */}
        {page === 'cart' && (
          <section className="store-page">
            <div className="page-heading">
              <span className="eyebrow">YOUR BASKET</span>
              <h1>Shopping basket</h1>
              <p>Review your selected digital products.</p>
            </div>

            {cart.length === 0 ? (
              <div className="empty-state">
                Your basket is empty.
                <button className="primary-button" onClick={openStore}>
                  Browse the store
                </button>
              </div>
            ) : (
              <div className="cart-layout">
                <div className="cart-items">
                  {cart.map((item) => (
                    <div className="cart-item" key={item.offer.id}>
                      <div>
                        <strong>{item.product.name}</strong>
                        <span>
                          {item.offer.seller.name} · {item.offer.region}
                        </span>
                      </div>

                      <strong>
                        €{Number(item.offer.price).toFixed(2)}
                      </strong>

                      <button onClick={() => removeFromCart(item.offer.id)}>
                        Remove
                      </button>
                    </div>
                  ))}
                </div>

                <aside className="cart-summary">
                  <h2>Order summary</h2>
                  <div>
                    <span>Subtotal</span>
                    <strong>€{cartTotal.toFixed(2)}</strong>
                  </div>
                  <div>
                    <span>Total</span>
                    <strong className="summary-total">
                      €{cartTotal.toFixed(2)}
                    </strong>
                  </div>

                  <p className="checkout-demo-note">
                    This is a simulated checkout. No real payment will be
                    taken, and all delivered keys are non-redeemable demo data.
                  </p>

                  <button
                    className="primary-button"
                    onClick={handleCheckout}
                    disabled={checkoutLoading || cart.length === 0}
                  >
                    {checkoutLoading ? 'Processing...' : 'Continue to checkout'}
                  </button>

                  {!currentUser && (
                    <p className="checkout-signin-note">
                      You will be asked to sign in before checkout.
                    </p>
                  )}
                </aside>
              </div>
            )}
          </section>
        )}

        {/* Successful simulated checkout and delivered keys */}
        {page === 'order-success' && completedOrder && (
          <section className="store-page order-page">
            <div className="order-success-heading">
              <span className="eyebrow">CHECKOUT COMPLETE</span>
              <h1>Thank you for your order!</h1>
              <p>
                Your demo order has been created and the digital demo keys are
                shown below. No real payment was processed.
              </p>
            </div>

            <div className="order-summary-card">
              <div>
                <span>Order number</span>
                <strong>{completedOrder.order.order_number}</strong>
              </div>
              <div>
                <span>Status</span>
                <strong className="order-status">
                  {completedOrder.order.status}
                </strong>
              </div>
              <div>
                <span>Total</span>
                <strong>
                  {completedOrder.order.currency}{' '}
                  {Number(completedOrder.order.total).toFixed(2)}
                </strong>
              </div>
              <div>
                <span>Order date</span>
                <strong>{formatDate(completedOrder.order.created_at)}</strong>
              </div>
            </div>

            <h2 className="order-section-title">Your digital delivery</h2>
            <OrderItems
              items={completedOrder.items}
              onCopy={handleCopyKey}
            />

            <div className="order-page-actions">
              <button
                className="primary-button"
                onClick={() => {
                  setError('')
                  setPage('orders')
                }}
              >
                View my orders
              </button>
              <button className="back-button" onClick={openStore}>
                Continue shopping
              </button>
            </div>
          </section>
        )}

        {/* Authenticated order history */}
        {page === 'orders' && (
          <section className="store-page order-page">
            <div className="page-heading">
              <span className="eyebrow">YOUR ACCOUNT</span>
              <h1>Order history</h1>
              <p>View your previous orders and delivered demo keys.</p>
            </div>

            {ordersLoading ? (
              <div className="loading-message">Loading your orders...</div>
            ) : orders.length === 0 ? (
              <div className="empty-state">
                You have not placed any orders yet.
                <button className="primary-button" onClick={openStore}>
                  Browse the store
                </button>
              </div>
            ) : (
              <div className="orders-list">
                {orders.map((order) => (
                  <button
                    className="order-card"
                    key={order.id}
                    onClick={() => openOrder(order.order_number)}
                  >
                    <div>
                      <span>Order number</span>
                      <strong>{order.order_number}</strong>
                    </div>
                    <div>
                      <span>Date</span>
                      <strong>{formatDate(order.created_at)}</strong>
                    </div>
                    <div>
                      <span>Status</span>
                      <strong className="order-status">{order.status}</strong>
                    </div>
                    <div>
                      <span>Total</span>
                      <strong>
                        {order.currency} {Number(order.total).toFixed(2)}
                      </strong>
                    </div>
                    <span className="order-card-arrow">View order →</span>
                  </button>
                ))}
              </div>
            )}
          </section>
        )}

        {/* Individual order details */}
        {page === 'order-detail' && (
          <section className="store-page order-page">
            <button
              className="back-button"
              onClick={() => {
                setError('')
                setPage('orders')
              }}
            >
              ← Back to order history
            </button>

            {orderLoading ? (
              <div className="loading-message">Loading order details...</div>
            ) : selectedOrder ? (
              <>
                <div className="page-heading">
                  <span className="eyebrow">ORDER DETAILS</span>
                  <h1>{selectedOrder.order.order_number}</h1>
                  <p>
                    Placed {formatDate(selectedOrder.order.created_at)} ·{' '}
                    Status: {selectedOrder.order.status}
                  </p>
                </div>

                <div className="order-summary-card">
                  <div>
                    <span>Subtotal</span>
                    <strong>
                      {selectedOrder.order.currency}{' '}
                      {Number(selectedOrder.order.subtotal).toFixed(2)}
                    </strong>
                  </div>
                  <div>
                    <span>Total</span>
                    <strong>
                      {selectedOrder.order.currency}{' '}
                      {Number(selectedOrder.order.total).toFixed(2)}
                    </strong>
                  </div>
                  <div>
                    <span>Payment mode</span>
                    <strong>Simulated</strong>
                  </div>
                </div>

                <h2 className="order-section-title">Delivered products</h2>
                <OrderItems
                  items={selectedOrder.items}
                  onCopy={handleCopyKey}
                />
              </>
            ) : (
              <div className="empty-state">
                Order details are not available.
              </div>
            )}
          </section>
        )}
      </main>

      <footer className="footer">
        <div className="footer-inner">
          <button className="brand" onClick={goHome}>
            KEYNEST<span>.</span>
          </button>

          <p>
            An independent digital gaming marketplace prototype created
            for an academic assignment. Not affiliated with Eneba.
          </p>

          <span>Demo marketplace · All prices in EUR</span>
        </div>
      </footer>

      {/* Authentication modal */}
      {authOpen && (
        <AuthModal
          onClose={() => setAuthOpen(false)}
          onSuccess={handleAuthSuccess}
        />
      )}
    </div>
  )
}

export default App
