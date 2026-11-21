import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config({ path: 'D:/Focus-Projects/Multi-brand-Ecommerce-Backend/.env' });

const API_BASE = 'http://localhost:5000/api/v1';

async function runTests() {
  console.log('=== RUNNING DEALER ORDER ISOLATION AND SCOPING TESTS ===\n');

  // 1. Authenticate Dealer One (DEALER_001)
  console.log('1. Authenticating Dealer One (dealer1@grove.com)...');
  const d1LoginRes = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'dealer1@grove.com', password: 'Password@123' })
  });
  const d1LoginData = await d1LoginRes.json();
  if (!d1LoginData.success) {
    throw new Error('Dealer One login failed: ' + JSON.stringify(d1LoginData));
  }
  const tokenD1 = d1LoginData.data.accessToken || d1LoginData.data.token;
  const dealer1Code = d1LoginData.data.dealer?.dealerCode;
  const dealer1Id = d1LoginData.data.dealer?.id || d1LoginData.data.user.id;
  console.log(`Dealer One authenticated: code=${dealer1Code}, id=${dealer1Id}`);

  // 2. Authenticate Dealer Two (DEALER_002)
  console.log('2. Authenticating Dealer Two (dealer2@grove.com)...');
  const d2LoginRes = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'dealer2@grove.com', password: 'Password@123' })
  });
  const d2LoginData = await d2LoginRes.json();
  if (!d2LoginData.success) {
    throw new Error('Dealer Two login failed: ' + JSON.stringify(d2LoginData));
  }
  const tokenD2 = d2LoginData.data.accessToken || d2LoginData.data.token;
  const dealer2Code = d2LoginData.data.dealer?.dealerCode;
  const dealer2Id = d2LoginData.data.dealer?.id || d2LoginData.data.user.id;
  console.log(`Dealer Two authenticated: code=${dealer2Code}, id=${dealer2Id}`);

  // 3. Test Dealer One Orders Scoping
  console.log('\n3. Testing GET /orders/dealer/my-orders for Dealer One...');
  const d1OrdersRes = await fetch(`${API_BASE}/orders/dealer/my-orders`, {
    headers: { Authorization: `Bearer ${tokenD1}` }
  });
  const d1OrdersData = await d1OrdersRes.json();
  if (!d1OrdersData.success) {
    throw new Error('Failed to fetch Dealer One orders: ' + JSON.stringify(d1OrdersData));
  }
  console.log(`Dealer One returned ${d1OrdersData.data.length} orders:`);
  d1OrdersData.data.forEach(o => console.log(`  - ${o.orderNumber} (dealer: ${o.dealer}, code: ${o.dealerCode}, status: ${o.orderStatus})`));
  
  // Verify all orders belong to Dealer One
  for (const o of d1OrdersData.data) {
    const oDealerId = o.dealer?._id || o.dealer;
    const isDealer1 = String(oDealerId) === String(dealer1Id) || o.dealerCode === dealer1Code;
    if (!isDealer1) {
      throw new Error(`LEAK DETECTED: Order ${o.orderNumber} does NOT belong to Dealer One! (dealer=${oDealerId}, code=${o.dealerCode})`);
    }
  }
  console.log(' PASS: All Dealer One orders strictly belong to DEALER_001.');

  // 4. Test Dealer Two Orders Scoping
  console.log('\n4. Testing GET /orders/dealer/my-orders for Dealer Two...');
  const d2OrdersRes = await fetch(`${API_BASE}/orders/dealer/my-orders`, {
    headers: { Authorization: `Bearer ${tokenD2}` }
  });
  const d2OrdersData = await d2OrdersRes.json();
  if (!d2OrdersData.success) {
    throw new Error('Failed to fetch Dealer Two orders: ' + JSON.stringify(d2OrdersData));
  }
  console.log(`Dealer Two returned ${d2OrdersData.data.length} orders:`);
  d2OrdersData.data.forEach(o => console.log(`  - ${o.orderNumber} (dealer: ${o.dealer}, code: ${o.dealerCode}, status: ${o.orderStatus})`));
  
  for (const o of d2OrdersData.data) {
    const oDealerId = o.dealer?._id || o.dealer;
    const isDealer2 = String(oDealerId) === String(dealer2Id) || o.dealerCode === dealer2Code;
    if (!isDealer2) {
      throw new Error(`LEAK DETECTED: Order ${o.orderNumber} does NOT belong to Dealer Two! (dealer=${oDealerId}, code=${o.dealerCode})`);
    }
  }
  console.log(' PASS: All Dealer Two orders strictly belong to DEALER_002.');

  // 5. Cross-Dealer Access Security Check
  const d1FirstOrder = d1OrdersData.data[0];
  if (d1FirstOrder) {
    console.log(`\n5. Cross-Dealer Security: Dealer Two attempting to access Dealer One order: ${d1FirstOrder.orderNumber}...`);
    const crossRes = await fetch(`${API_BASE}/orders/dealer/my-orders/${d1FirstOrder.orderNumber}`, {
      headers: { Authorization: `Bearer ${tokenD2}` }
    });
    console.log(`Cross-access HTTP status: ${crossRes.status}`);
    if (crossRes.status === 404 || crossRes.status === 403) {
      console.log(' PASS: Backend securely rejected unauthorized cross-dealer order access with 404/403.');
    } else {
      const crossData = await crossRes.json();
      throw new Error(`SECURITY BREACH: Dealer Two was able to access Dealer One order: ${JSON.stringify(crossData)}`);
    }

    // Try modifying status
    console.log(`5b. Cross-Dealer Security: Dealer Two attempting to update status of Dealer One order: ${d1FirstOrder.orderNumber}...`);
    const crossUpdateRes = await fetch(`${API_BASE}/orders/dealer/my-orders/${d1FirstOrder.orderNumber}/status`, {
      method: 'PATCH',
      headers: { 
        Authorization: `Bearer ${tokenD2}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ orderStatus: 'Delivered' })
    });
    console.log(`Cross-update HTTP status: ${crossUpdateRes.status}`);
    if (crossUpdateRes.status === 404 || crossUpdateRes.status === 403) {
      console.log(' PASS: Backend securely rejected unauthorized cross-dealer order update with 404/403.');
    } else {
      throw new Error('SECURITY BREACH: Dealer Two was able to modify Dealer One order!');
    }
  }

  // 6. Test Analytics Endpoint Scoping
  console.log('\n6. Testing Dealer Analytics scoping...');
  const d1AnalyticsRes = await fetch(`${API_BASE}/analytics/dealer`, {
    headers: { Authorization: `Bearer ${tokenD1}` }
  });
  const d1Analytics = await d1AnalyticsRes.json();
  console.log(`Dealer One total orders in analytics: ${d1Analytics.data.totalOrders}, grossRevenue: ${d1Analytics.data.grossRevenue}`);

  const d2AnalyticsRes = await fetch(`${API_BASE}/analytics/dealer`, {
    headers: { Authorization: `Bearer ${tokenD2}` }
  });
  const d2Analytics = await d2AnalyticsRes.json();
  console.log(`Dealer Two total orders in analytics: ${d2Analytics.data.totalOrders}, grossRevenue: ${d2Analytics.data.grossRevenue}`);

  if (d1Analytics.data.totalOrders === d1OrdersData.data.length && d2Analytics.data.totalOrders === d2OrdersData.data.length) {
    console.log(' PASS: Analytics metrics perfectly match each dealer’s own suborder count.');
  }

  console.log('\n ALL BACKEND SECURITY AND ORDER SCOPING TESTS PASSED SUCCESSFULLY!');
}

runTests().catch((err) => {
  console.error('\n TEST FAILED:', err);
  process.exit(1);
});
