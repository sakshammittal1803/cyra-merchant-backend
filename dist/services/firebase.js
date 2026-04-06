"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.listenToFirebaseOrders = listenToFirebaseOrders;
exports.updateFirebaseOrderStatus = updateFirebaseOrderStatus;
exports.syncMenuToFirebase = syncMenuToFirebase;
exports.getFirebaseMenu = getFirebaseMenu;
exports.convertFirebaseOrderToMerchant = convertFirebaseOrderToMerchant;
const axios_1 = __importDefault(require("axios"));
const FIREBASE_DB_URL = process.env.FIREBASE_DATABASE_URL || 'https://cyra-b50e8-default-rtdb.firebaseio.com';
// Listen for new orders from Firebase
async function listenToFirebaseOrders(callback) {
    console.log('🎧 Starting Firebase order listener...');
    console.log(`📍 Firebase URL: ${FIREBASE_DB_URL}`);
    try {
        // Poll Firebase for new orders every 2 seconds
        setInterval(async () => {
            try {
                // Get all orders (not just pending, to see everything)
                const response = await axios_1.default.get(`${FIREBASE_DB_URL}/orders.json`);
                if (response.data) {
                    const allOrders = Object.entries(response.data);
                    const pendingOrders = allOrders.filter(([_, order]) => order.status === 'pending');
                    if (allOrders.length > 0) {
                        console.log(`📦 Firebase check: ${allOrders.length} total orders, ${pendingOrders.length} pending`);
                    }
                    // Process pending orders
                    pendingOrders.forEach(([key, order]) => {
                        // Check if order is new (not processed yet)
                        if (!processedOrders.has(key)) {
                            console.log(`🆕 NEW ORDER DETECTED!`);
                            console.log(`   Order ID: ${key}`);
                            console.log(`   Customer: ${order.customerName}`);
                            console.log(`   Total: ₹${order.totalAmount}`);
                            console.log(`   Items: ${order.items?.length || 0}`);
                            processedOrders.add(key);
                            callback({ firebaseKey: key, ...order });
                        }
                    });
                }
                else {
                    // No orders in Firebase yet
                    if (Date.now() % 10000 < 2000) { // Log every 10 seconds
                        console.log('📭 No orders in Firebase yet');
                    }
                }
            }
            catch (error) {
                console.error('❌ Error fetching Firebase orders:', error);
                if (axios_1.default.isAxiosError(error)) {
                    console.error('   Status:', error.response?.status);
                    console.error('   Message:', error.message);
                }
            }
        }, 2000);
        console.log('✅ Firebase order listener started successfully');
        console.log('⏰ Polling every 2 seconds for new orders...');
    }
    catch (error) {
        console.error('❌ Error setting up Firebase listener:', error);
    }
}
// Track processed orders to avoid duplicates
const processedOrders = new Set();
// Update order status in Firebase
async function updateFirebaseOrderStatus(firebaseKey, status) {
    try {
        await axios_1.default.patch(`${FIREBASE_DB_URL}/orders/${firebaseKey}.json`, { status, merchantUpdatedAt: Date.now() });
        console.log(`Updated Firebase order ${firebaseKey} to status: ${status}`);
    }
    catch (error) {
        console.error('Error updating Firebase order:', error);
    }
}
// Sync menu to Firebase
async function syncMenuToFirebase(menuItems) {
    try {
        console.log(`🔄 Syncing ${menuItems.length} items to Firebase...`);
        const menuData = menuItems.reduce((acc, item) => {
            acc[item.id] = {
                name: item.name,
                description: item.description,
                price: item.price,
                category: item.category,
                phase: item.phase || 'all',
                restaurantName: item.restaurantName || 'Restaurant', // Add restaurant name
                imageUrl: item.image_url,
                isAvailable: item.is_available,
                createdAt: item.created_at,
                updatedAt: Date.now(),
            };
            return acc;
        }, {});
        await axios_1.default.put(`${FIREBASE_DB_URL}/merchantMenu.json`, menuData);
        console.log('✅ Menu synced to Firebase successfully');
    }
    catch (error) {
        console.error('❌ Error syncing menu to Firebase:', error);
        if (axios_1.default.isAxiosError(error)) {
            console.error('Response:', error.response?.data);
            console.error('Status:', error.response?.status);
        }
    }
}
// Get menu from Firebase
async function getFirebaseMenu() {
    try {
        const response = await axios_1.default.get(`${FIREBASE_DB_URL}/merchantMenu.json`);
        return response.data || {};
    }
    catch (error) {
        console.error('Error getting Firebase menu:', error);
        return {};
    }
}
// Process Firebase order and convert to merchant format
function convertFirebaseOrderToMerchant(firebaseOrder) {
    return {
        cyra_order_id: firebaseOrder.orderId || `FB-${Date.now()}`,
        customer_name: firebaseOrder.customerName || 'Firebase Customer',
        customer_phone: firebaseOrder.customerPhone || '',
        customer_email: firebaseOrder.customerEmail || '',
        delivery_address: firebaseOrder.deliveryAddress || {
            address: '',
            city: '',
            state: '',
            pincode: '',
            fullAddress: ''
        },
        status: 'pending',
        total_amount: firebaseOrder.totalAmount || 0,
        customer_notes: firebaseOrder.notes || '',
        items: (firebaseOrder.items || []).map((item) => ({
            item_name: item.name,
            quantity: item.quantity,
            price: item.price,
            menu_item_id: item.menuItemId,
        })),
        firebase_key: firebaseOrder.firebaseKey,
        created_at: new Date(firebaseOrder.timestamp || Date.now()).toISOString(),
        updated_at: new Date().toISOString(),
    };
}
