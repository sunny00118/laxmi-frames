// products-loader.js
// Laxmi Frames & Pooja Samagri Store - Supabase Product Loader
// VERSION 2.0 - With retry logic, caching, and error handling

import { supabase } from './supabase-config.js';

// ==========================================
// CONFIGURATION
// ==========================================

const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // ms
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes cache

// ==========================================
// CACHE SYSTEM (Simple in-memory cache)
// ==========================================

const cache = new Map();

function getCacheKey(key) {
    const item = cache.get(key);
    if (!item) return null;
    if (Date.now() - item.timestamp > CACHE_TTL) {
        cache.delete(key);
        return null;
    }
    return item.data;
}

function setCache(key, data) {
    cache.set(key, { data, timestamp: Date.now() });
}

// ==========================================
// RETRY HELPER
// ==========================================

async function withRetry(operation, retries = MAX_RETRIES) {
    let lastError;
    
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            const result = await operation();
            return result;
        } catch (error) {
            lastError = error;
            console.warn(`Attempt ${attempt}/${retries} failed:`, error.message);
            
            if (attempt < retries) {
                // Exponential backoff: 1s, 2s, 4s
                const delay = RETRY_DELAY * Math.pow(2, attempt - 1);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }
    
    throw lastError;
}

// ==========================================
// INPUT SANITIZATION
// ==========================================

function sanitizeSearchTerm(term) {
    if (!term) return '';
    // Remove any characters that could be used for injection
    return term.replace(/[<>'\"%;()&+]/g, '').trim();
}

// ==========================================
// API FUNCTIONS WITH RETRY & CACHE
// ==========================================

// Get all products from Supabase
export async function getProducts(category = null) {
    const cacheKey = `products_${category || 'all'}`;
    const cached = getCacheKey(cacheKey);
    if (cached) {
        console.log('Returning cached products');
        return cached;
    }
    
    return withRetry(async () => {
        let query = supabase.from('products').select('*');
        
        if (category) {
            query = query.eq('category', category);
        }
        
        const { data, error } = await query.order('sort_order', { ascending: true });
        
        if (error) {
            console.error('Error fetching products:', error);
            throw new Error(`Failed to fetch products: ${error.message}`);
        }
        
        setCache(cacheKey, data || []);
        return data || [];
    });
}

// Get single product by ID or slug
export async function getProduct(id) {
    if (!id) {
        throw new Error('Product ID is required');
    }
    
    const cacheKey = `product_${id}`;
    const cached = getCacheKey(cacheKey);
    if (cached) return cached;
    
    return withRetry(async () => {
        // First try by slug
        let { data, error } = await supabase
            .from('products')
            .select('*')
            .eq('slug', id)
            .single();
        
        // If not found, try by UUID
        if (error && isValidUUID(id)) {
            const result = await supabase
                .from('products')
                .select('*')
                .eq('id', id)
                .single();
            data = result.data;
            error = result.error;
        }
        
        if (error) {
            console.error('Error fetching product:', error);
            throw new Error(`Product not found: ${error.message}`);
        }
        
        setCache(cacheKey, data);
        return data;
    });
}

// Helper to check if string is UUID
function isValidUUID(str) {
    if (!str) return false;
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(str);
}

// Get single product by slug
export async function getProductBySlug(slug) {
    if (!slug) throw new Error('Slug is required');
    
    const cacheKey = `product_slug_${slug}`;
    const cached = getCacheKey(cacheKey);
    if (cached) return cached;
    
    return withRetry(async () => {
        const { data, error } = await supabase
            .from('products')
            .select('*')
            .eq('slug', slug)
            .single();
        
        if (error) {
            throw new Error(`Product not found: ${error.message}`);
        }
        
        setCache(cacheKey, data);
        return data;
    });
}

// Place order
export async function placeOrder(orderData) {
    if (!orderData || !orderData.customer_name) {
        throw new Error('Invalid order data');
    }
    
    return withRetry(async () => {
        const { data, error } = await supabase
            .from('orders')
            .insert([orderData]);
        
        if (error) {
            throw new Error(`Failed to place order: ${error.message}`);
        }
        
        return { success: true, data };
    });
}

// Get all categories
export async function getCategories() {
    const cached = getCacheKey('categories');
    if (cached) return cached;
    
    return withRetry(async () => {
        const { data, error } = await supabase
            .from('products')
            .select('category');
        
        if (error) {
            throw new Error(`Failed to fetch categories: ${error.message}`);
        }
        
        const categories = [...new Set(data.map(p => p.category))];
        setCache('categories', categories);
        return categories;
    });
}

// Search products - NOW CONNECTED TO SUPABASE
export async function searchProducts(searchTerm) {
    const term = sanitizeSearchTerm(searchTerm);
    if (!term) return [];
    
    return withRetry(async () => {
        const { data, error } = await supabase
            .from('products')
            .select('*')
            .ilike('name', `%${term}%`)
            .order('sort_order', { ascending: true });
        
        if (error) {
            throw new Error(`Search failed: ${error.message}`);
        }
        
        return data || [];
    });
}

// Clear cache (call this after admin operations)
export function clearProductCache() {
    cache.clear();
    console.log('Product cache cleared');
}

// ==========================================
// FALLBACK PRODUCTS (if Supabase fails completely)
// ==========================================

export const FALLBACK_PRODUCTS = {
    shiv: {
        name: "Lord Shiva Photo Frame",
        price: 303,
        original_price: 399,
        discount: "24% OFF",
        badge: "Bestseller",
        rating: "4.2",
        reviews: "456",
        description: "Beautiful Lord Shiva photo frame with golden border. Perfect for your home temple or as a gift.",
        features: ["Premium quality photo print", "Durable golden frame", "Size: 12 x 18 inches", "Ready to hang"],
        image: "images/shivji.png",
        in_stock: true
    },
    hanuman: {
        name: "Hanuman Ji Photo Frame",
        price: 303,
        original_price: 399,
        discount: "24% OFF",
        badge: "Popular",
        rating: "4.2",
        reviews: "312",
        description: "Divine Hanuman Ji photo frame with premium golden border.",
        features: ["Premium quality photo print", "Durable golden frame", "Size: 12 x 18 inches", "Ready to hang"],
        image: "images/hanumanji.png",
        in_stock: true
    },
    durga: {
        name: "Maa Durga Photo Frame",
        price: 303,
        original_price: 399,
        discount: "24% OFF",
        badge: "New",
        rating: "4.2",
        reviews: "189",
        description: "Beautiful Maa Durga photo frame. Perfect for Navratri.",
        features: ["Premium quality photo print", "Durable golden frame", "Size: 12 x 18 inches"],
        image: "images/maadurga.png",
        in_stock: true
    },
    sai: {
        name: "Sai Baba Photo Frame",
        price: 281,
        original_price: 350,
        discount: "20% OFF",
        badge: "Top Rated",
        rating: "4.0",
        reviews: "7",
        description: "Sai Baba photo frame with elegant design.",
        features: ["Premium quality photo print", "Durable golden frame", "Size: 12 x 18 inches"],
        image: "images/saibaba.png",
        in_stock: true
    },
    loban: {
        name: "Pure Loban (50g)",
        price: 141,
        original_price: 180,
        discount: "22% OFF",
        badge: "",
        rating: "4.2",
        reviews: "89",
        description: "Pure and authentic Loban for your daily puja.",
        features: ["100% pure and natural", "50g pack", "Long lasting fragrance"],
        image: "images/loban.png",
        in_stock: true
    },
    rudraksha: {
        name: "Rudraksha Mala",
        price: 125,
        original_price: 160,
        discount: "22% OFF",
        badge: "",
        rating: "4.2",
        reviews: "234",
        description: "Authentic Rudraksha Mala for meditation.",
        features: ["Authentic Rudraksha beads", "108 beads mala", "Perfect for meditation"],
        image: "images/rmala.png",
        in_stock: true
    },
    mat: {
        name: "Traditional Pooja Mat",
        price: 159,
        original_price: 200,
        discount: "20% OFF",
        badge: "",
        rating: "4.2",
        reviews: "78",
        description: "Traditional pooja mat for your daily worship.",
        features: ["Soft and comfortable", "Easy to clean", "Durable material"],
        image: "images/mats.png",
        in_stock: true
    }
};