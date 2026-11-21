/**
 * ==============================================================================
 * GROVE Multi-Brand E-Commerce Platform – Database Seed Script
 * ==============================================================================
 * Clears the existing database and seeds:
 * 1. Exactly 2 accounts in User collection: 1 User (user1), 1 Super Admin (admin)
 * 2. 1 Authorized Dealer per category in Dealer collection (with standalone credentials)
 * 3. 4 Categories: Agriculture & Farming, Electronics & Gadgets, Automotive & Spare Parts, Groceries
 * 4. 54 Catalog Products loaded directly from data/seed-products.json
 *    - Agriculture & Farming: 6 subcategories × 3 products = 18 products (DEALER_001)
 *    - Electronics & Gadgets: 6 subcategories × 3 products = 18 products (DEALER_002)
 *    - Automotive & Spare Parts: 6 subcategories × 3 products = 18 products (DEALER_003)
 * 5. 54 Warehouse Inventory records matching the products
 * 6. 54 Inventory Inbound Audit Transactions
 * 7. 1 Default delivery address for user1
 * 8. 1 Dealer location logistics hub for DEALER_001
 * 9. Demo customer orders & dealer suborders
 * 10. System Admin platform settings & initial audit log
 * ==============================================================================
 */

import fs from 'fs';
import { connectDB, disconnectDB } from './src/config/db.js';
import { ROLES } from './src/constants/roles.js';
import { DEALER_STATUS } from './src/constants/dealerStatus.js';

import { Category } from './src/modules/categories/category.model.js';
import { User } from './src/modules/users/user.model.js';
import { Dealer } from './src/modules/dealers/dealer.model.js';
import { Product } from './src/modules/products/product.model.js';
import { Inventory } from './src/modules/inventory/inventory.model.js';
import { InventoryTransaction } from './src/modules/inventory/inventoryTransaction.model.js';
import { DealerLocation } from './src/modules/dealer-locations/dealerLocation.model.js';
import { Address } from './src/modules/addresses/address.model.js';
import { Order } from './src/modules/orders/order.model.js';
import { DealerOrder } from './src/modules/orders/dealerOrder.model.js';
import { Payment } from './src/modules/payments/payment.model.js';
import { Settlement } from './src/modules/settlements/settlement.model.js';
import { Complaint } from './src/modules/complaints/complaint.model.js';
import { AdminSettings } from './src/modules/admin/models/adminSettings.model.js';
import { AuditLog } from './src/modules/admin/models/auditLog.model.js';
import { Cart } from './src/modules/cart/cart.model.js';
import { Wishlist } from './src/modules/wishlist/wishlist.model.js';

async function seedDatabase() {
  console.log('🚀 Starting GROVE Database Seed Process...');
  await connectDB();

  // 1. Clear ALL collections
  console.log('🧹 Clearing existing database collections...');
  await Promise.all([
    User.deleteMany({}),
    Dealer.deleteMany({}),
    Category.deleteMany({}),
    Product.deleteMany({}),
    Inventory.deleteMany({}),
    InventoryTransaction.deleteMany({}),
    Address.deleteMany({}),
    DealerLocation.deleteMany({}),
    Order.deleteMany({}),
    DealerOrder.deleteMany({}),
    Payment.deleteMany({}),
    Settlement.deleteMany({}),
    Complaint.deleteMany({}),
    AdminSettings.deleteMany({}),
    AuditLog.deleteMany({}),
    Cart.deleteMany({}),
    Wishlist.deleteMany({})
  ]);
  console.log('✅ All existing collections cleared successfully.\n');

  // 2. Seed Categories (matching exact frontend constants & subcategories)
  console.log('🌱 Seeding Categories...');
  const categories = await Category.create([
    {
      name: 'Agriculture & Farming',
      slug: 'agriculture',
      description: 'Machinery, irrigation, tillage equipment, seeds, and agronomy solutions.',
      icon: 'Sprout',
      commissionRate: 5.0,
      status: 'Active',
      subcategories: [
        { name: 'Hybrid Seeds', slug: 'hybrid-seeds', description: 'Certified high-yield hybrid crop and vegetable seeds' },
        { name: 'Fertilizers & Soil Nutrition', slug: 'fertilizers-soil', description: 'Bio-fertilizers, organic compost, and micronutrients' },
        { name: 'Crop Protection', slug: 'crop-protection', description: 'Sprayers, pest management, and biological treatments' },
        { name: 'Irrigation & Drip Systems', slug: 'irrigation-drip', description: 'Drip lines, sprinkler kits, valves, and tubing' },
        { name: 'Solar Pumps', slug: 'solar-pumps', description: 'Solar submersible pumps and clean energy pumping' },
        { name: 'Farm Machinery', slug: 'farm-machinery', description: 'Tractors, power tillers, cultivators, and implements' }
      ]
    },
    {
      name: 'Electronics & Gadgets',
      slug: 'electronics',
      description: 'Field electronics, smart wearables, rugged computing, audio, and sensors.',
      icon: 'Smartphone',
      commissionRate: 7.0,
      status: 'Active',
      subcategories: [
        { name: 'Audio & Headphones', slug: 'audio-headphones', description: 'Industrial noise-cancelling and communication gear' },
        { name: 'Laptops & Computers', slug: 'laptops-computers', description: 'Rugged field laptops and portable computing' },
        { name: 'Wearables & Smartwatches', slug: 'wearables-smartwatches', description: 'Smartwatches, activity and biometric trackers' },
        { name: 'Keyboards & Accessories', slug: 'keyboards-accessories', description: 'Industrial and mechanical peripherals' },
        { name: 'Smart Sensors & IoT', slug: 'smart-sensors-iot', description: 'Telemetry units, wireless environmental sensors' },
        { name: 'Drones & Robotics', slug: 'drones-robotics', description: 'Agricultural spraying and survey drones' }
      ]
    },
    {
      name: 'Automotive & Spare Parts',
      slug: 'automotive',
      description: 'OEM parts, heavy vehicle braking, filtration, and all-terrain tires.',
      icon: 'Cog',
      commissionRate: 6.0,
      status: 'Active',
      subcategories: [
        { name: 'Tires & Wheels', slug: 'tires-wheels', description: 'Commercial tractor and haulage tires' },
        { name: 'Braking Systems', slug: 'braking-systems', description: 'Brake pads, rotors, drums, and hydraulics' },
        { name: 'Suspension & Steering', slug: 'suspension-steering', description: 'Shock absorbers, leaf springs, and steering racks' },
        { name: 'Electrical & Battery', slug: 'electrical-battery', description: 'Heavy-duty commercial batteries and alternators' },
        { name: 'Engine & Drivetrain', slug: 'engine-drivetrain', description: 'Oil filters, pistons, belts, and gear assemblies' },
        { name: 'Spares & Accessories', slug: 'spares-accessories', description: 'Emergency roadside spares, jacks, and toolkits' }
      ]
    },
    {
      name: 'Groceries',
      slug: 'groceries',
      description: 'Daily pantry essentials, fresh produce, and organic farm goods.',
      icon: 'ShoppingBasket',
      commissionRate: 4.0,
      status: 'Active',
      subcategories: [
        { name: 'Daily Essentials', slug: 'daily-essentials', description: 'Grains, oils, and pulses' },
        { name: 'Organic Produce', slug: 'organic-produce', description: 'Farm fresh fruits and vegetables' }
      ]
    }
  ]);

  const agriCat = categories.find((c) => c.slug === 'agriculture');
  const elecCat = categories.find((c) => c.slug === 'electronics');
  const autoCat = categories.find((c) => c.slug === 'automotive');
  const grocCat = categories.find((c) => c.slug === 'groceries');

  console.log(`✅ Seeded ${categories.length} categories.\n`);

  // 3. Seed Exactly 2 Demo Accounts in User Collection (1 user, 1 admin - NO dealers in User collection)
  console.log('👤 Seeding 2 Demo Accounts in User Collection (1 user, 1 admin)...');
  const [user1, admin] = await User.create([
    {
      name: 'User One',
      email: 'user1@grove.com',
      password: 'Password@123',
      role: ROLES.USER,
      phone: '+91 98765 43210',
      status: 'ACTIVE',
      isEmailVerified: true
    },
    {
      name: 'Super Admin',
      email: 'admin@grove.com',
      password: 'Admin@123',
      role: ROLES.SUPER_ADMIN,
      phone: '+91 99999 00000',
      status: 'ACTIVE',
      isEmailVerified: true
    }
  ]);

  console.log('✅ Created 2 User accounts:');
  console.log('   - Customer:    user1@grove.com    (Password@123)');
  console.log('   - Super Admin: admin@grove.com    (Admin@123)\n');

  // 4. Seed 1 Dealer per Category directly into Dealer Collection (standalone authentication)
  console.log('🏢 Seeding 1 Dealer for Each Category in Dealer Collection...');
  
  // Dealer 1 - Agriculture & Farming
  const dealerEntity = await Dealer.create({
    dealerCode: 'DEALER_001',
    businessName: 'Apex Machinery & Equipment Solutions',
    businessType: 'Authorized Dealer',
    primaryCategory: agriCat._id,
    primaryCategoryName: agriCat.name,
    ownerName: 'Dealer One',
    officialEmail: 'dealer1@grove.com',
    password: 'Password@123',
    phone: '+91 98220 12345',
    gstin: '27AABCA1234F1Z5',
    pan: 'AABCA1234F',
    businessAddress: {
      address: 'Plot 42, Sanaswadi Industrial Area, Pune-Nagar Road',
      city: 'Pune',
      state: 'Maharashtra',
      pincode: '412208'
    },
    warehouseAddress: 'Plot 42, Sanaswadi Industrial Area, Pune-Nagar Road, Pune - 412208',
    location: {
      type: 'Point',
      coordinates: [73.8567, 18.5204]
    },
    status: DEALER_STATUS.APPROVED,
    bankVerificationStatus: 'VERIFIED',
    mustChangePassword: false,
    tier: 'Gold Tier',
    commissionRate: 5.0,
    bankDetails: {
      accountName: 'Apex Machinery & Equipment Solutions',
      accountNumber: '987654321098',
      ifsc: 'SBIN0001234',
      bankName: 'State Bank of India'
    },
    kycDocuments: [
      { name: 'GSTIN Registration Certificate', url: 'https://grove.internal/docs/gstin.pdf', status: 'Verified' },
      { name: 'Business License', url: 'https://grove.internal/docs/license.pdf', status: 'Verified' }
    ],
    storeSettings: {
      tagline: 'Leading Agricultural Equipment & Industrial Hardware',
      description: 'Certified dealer for agricultural machinery, precision irrigation, electronics telemetry, and commercial automotive spares.',
      operatingHours: 'Mon - Sat: 08:30 AM - 07:30 PM',
      isOpen: true,
      fulfillmentSLA: 99.5
    }
  });
  console.log(`✅ Created Dealer 1 (Agri):        ${dealerEntity.businessName} (${dealerEntity.dealerCode})`);

  // Dealer 2 - Electronics & Gadgets
  const dealer2Entity = await Dealer.create({
    dealerCode: 'DEALER_002',
    businessName: 'ElectroTech Smart Components & Sensors',
    businessType: 'Authorized Dealer',
    primaryCategory: elecCat._id,
    primaryCategoryName: elecCat.name,
    ownerName: 'Dealer Two',
    officialEmail: 'dealer2@grove.com',
    password: 'Password@123',
    phone: '+91 98220 54321',
    gstin: '27XYZPA9876Q1Z2',
    pan: 'XYZPA9876Q',
    businessAddress: {
      address: 'Survey No 88, Hadapsar Electronic Estate',
      city: 'Pune',
      state: 'Maharashtra',
      pincode: '411028'
    },
    warehouseAddress: 'Survey No 88, Hadapsar Electronic Estate, Pune - 411028',
    location: {
      type: 'Point',
      coordinates: [73.9312, 18.5089]
    },
    status: DEALER_STATUS.APPROVED,
    bankVerificationStatus: 'VERIFIED',
    mustChangePassword: false,
    tier: 'Silver Tier',
    commissionRate: 5.0,
    bankDetails: {
      accountName: 'ElectroTech Smart Components & Sensors',
      accountNumber: '987654321099',
      ifsc: 'HDFC0001234',
      bankName: 'HDFC Bank'
    },
    kycDocuments: [
      { name: 'GSTIN Registration Certificate', url: 'https://grove.internal/docs/gstin-el.pdf', status: 'Verified' },
      { name: 'Business License', url: 'https://grove.internal/docs/license-el.pdf', status: 'Verified' }
    ],
    storeSettings: {
      tagline: 'Precision Agri-Sensors & Telemetry Electronics',
      description: 'Authorized regional dealer for field cameras, telemetry laptops, solar pumps, and smart agriculture monitoring.',
      operatingHours: 'Mon - Sat: 09:00 AM - 08:00 PM',
      isOpen: true,
      fulfillmentSLA: 98.8
    }
  });
  console.log(`✅ Created Dealer 2 (Electronics): ${dealer2Entity.businessName} (${dealer2Entity.dealerCode})`);

  // Dealer 3 - Automotive & Spare Parts
  const dealer3Entity = await Dealer.create({
    dealerCode: 'DEALER_003',
    businessName: 'AutoMech Heavy Commercial Spares',
    businessType: 'Authorized Dealer',
    primaryCategory: autoCat._id,
    primaryCategoryName: autoCat.name,
    ownerName: 'Dealer Three',
    officialEmail: 'dealer3@grove.com',
    password: 'Password@123',
    phone: '+91 98220 67890',
    gstin: '27DEFGH5678J1Z9',
    pan: 'DEFGH5678J',
    businessAddress: {
      address: 'Plot 15, Chakan Auto Hub Phase 2',
      city: 'Pune',
      state: 'Maharashtra',
      pincode: '410501'
    },
    warehouseAddress: 'Plot 15, Chakan Auto Hub Phase 2, Pune - 410501',
    location: {
      type: 'Point',
      coordinates: [73.8643, 18.7589]
    },
    status: DEALER_STATUS.APPROVED,
    bankVerificationStatus: 'VERIFIED',
    mustChangePassword: false,
    tier: 'Gold Tier',
    commissionRate: 5.0,
    bankDetails: {
      accountName: 'AutoMech Heavy Commercial Spares',
      accountNumber: '987654321100',
      ifsc: 'ICIC0001234',
      bankName: 'ICICI Bank'
    },
    kycDocuments: [
      { name: 'GSTIN Registration Certificate', url: 'https://grove.internal/docs/gstin-au.pdf', status: 'Verified' },
      { name: 'Business License', url: 'https://grove.internal/docs/license-au.pdf', status: 'Verified' }
    ],
    storeSettings: {
      tagline: 'OEM Tractor Engine & Drivetrain Components',
      description: 'Authorized regional dealer for tractor replacement parts, commercial farm tires, hydraulic systems, and tool kits.',
      operatingHours: 'Mon - Sat: 08:30 AM - 07:30 PM',
      isOpen: true,
      fulfillmentSLA: 99.2
    }
  });
  console.log(`✅ Created Dealer 3 (Automotive):  ${dealer3Entity.businessName} (${dealer3Entity.dealerCode})`);

  // Dealer 4 - Groceries
  const dealer4Entity = await Dealer.create({
    dealerCode: 'DEALER_004',
    businessName: 'FreshHarvest Organic Farm Groceries',
    businessType: 'Authorized Dealer',
    primaryCategory: grocCat._id,
    primaryCategoryName: grocCat.name,
    ownerName: 'Dealer Four',
    officialEmail: 'dealer4@grove.com',
    password: 'Password@123',
    phone: '+91 98220 98765',
    gstin: '27GHIJK9012K1Z3',
    pan: 'GHIJK9012K',
    businessAddress: {
      address: 'Shop 12, APMC Market Yard, Gultekdi',
      city: 'Pune',
      state: 'Maharashtra',
      pincode: '411037'
    },
    warehouseAddress: 'Shop 12, APMC Market Yard, Gultekdi, Pune - 411037',
    location: {
      type: 'Point',
      coordinates: [73.8687, 18.4901]
    },
    status: DEALER_STATUS.APPROVED,
    bankVerificationStatus: 'VERIFIED',
    mustChangePassword: false,
    tier: 'Silver Tier',
    commissionRate: 4.0,
    bankDetails: {
      accountName: 'FreshHarvest Organic Groceries',
      accountNumber: '987654321101',
      ifsc: 'KKBK0001234',
      bankName: 'Kotak Mahindra Bank'
    },
    kycDocuments: [
      { name: 'GSTIN Registration Certificate', url: 'https://grove.internal/docs/gstin-gr.pdf', status: 'Verified' },
      { name: 'FSSAI Food License', url: 'https://grove.internal/docs/fssai-gr.pdf', status: 'Verified' }
    ],
    storeSettings: {
      tagline: 'Farm-Fresh Organic Staples & Pantry Goods',
      description: 'Authorized local cooperative dealer supplying certified organic grains, cold-pressed oils, and seasonal farm harvests.',
      operatingHours: 'Mon - Sun: 07:00 AM - 09:00 PM',
      isOpen: true,
      fulfillmentSLA: 99.4
    }
  });
  console.log(`✅ Created Dealer 4 (Groceries):   ${dealer4Entity.businessName} (${dealer4Entity.dealerCode})\n`);

  // 5. Seed Catalog Products loaded directly from data/seed-products.json
  console.log('📦 Loading and Seeding Products from data/seed-products.json...');
  const seedProductsRaw = JSON.parse(
    fs.readFileSync(new URL('./data/seed-products.json', import.meta.url), 'utf8')
  );

  const categoryMap = new Map([
    ['Agriculture & Farming', agriCat],
    ['Electronics & Gadgets', elecCat],
    ['Automotive & Spare Parts', autoCat],
    ['Groceries', grocCat]
  ]);

  const dealerMap = new Map([
    ['DEALER_001', dealerEntity],
    ['DEALER_002', dealer2Entity],
    ['DEALER_003', dealer3Entity],
    ['DEALER_004', dealer4Entity]
  ]);

  const productsToInsert = seedProductsRaw.map((p) => {
    const cat = categoryMap.get(p.categoryName) || agriCat;
    const dlr = dealerMap.get(p.dealerCode) || dealerEntity;

    return {
      name: p.name,
      sku: p.sku,
      slug: p.slug,
      category: cat._id,
      categoryName: cat.name,
      subcategory: p.subcategory,
      dealer: dlr._id,
      dealerCode: dlr.dealerCode,
      dealerName: dlr.businessName,
      brand: p.brand || 'GROVE Prime',
      description: p.description,
      price: p.price,
      mrp: p.mrp,
      discount: p.discount || 0,
      stock: p.stock || 30,
      threshold: 10,
      status: 'Active',
      image: p.image,
      images: Array.isArray(p.images) && p.images.length > 0 ? p.images : [p.image],
      rating: p.rating || 4.5,
      reviewCount: p.reviewCount || 10,
      specs: p.specs || {},
      highlights: p.highlights || [],
      deliveryInfo: {
        standardDays: '2 - 4 Business Days',
        shippingFee: 'FREE Express Delivery',
        dispatchTime: 'Dispatched within 24 Hours'
      }
    };
  });

  const createdProducts = await Product.create(productsToInsert);
  console.log(`✅ Seeded ${createdProducts.length} catalog products perfectly mapped to their respective dealers.\n`);

  // 6. Seed Warehouse Inventory Records & Initial Stock Ledger
  console.log('📊 Seeding Warehouse Inventory Records...');
  const inventoryDocs = createdProducts.map((prod) => ({
    product: prod._id,
    dealer: prod.dealer,
    sku: prod.sku,
    currentStock: prod.stock,
    reservedStock: 0,
    threshold: prod.threshold || 10,
    locationBay: 'Bay A-01',
    status: prod.stock > 10 ? 'In Stock' : prod.stock > 0 ? 'Low Stock' : 'Out of Stock'
  }));

  const createdInventory = await Inventory.create(inventoryDocs);

  const transactions = createdInventory.map((inv) => ({
    product: inv.product,
    dealer: inv.dealer,
    type: 'PURCHASE_RESTOCK',
    quantityChange: inv.currentStock,
    balanceAfter: inv.currentStock,
    reason: 'Initial Seed Inbound Balance',
    performedBy: admin._id
  }));

  await InventoryTransaction.create(transactions);
  console.log(`✅ Seeded ${createdInventory.length} inventory records and audit transactions.\n`);

  // 7. Seed Default Delivery Address for user1
  console.log('📍 Seeding Default Delivery Address for user1...');
  const userAddress = await Address.create({
    user: user1._id,
    name: user1.name,
    mobile: '9876543210',
    pincode: '411016',
    house: 'Flat 402, Green Meadows Apartment',
    street: 'Model Colony, Shivajinagar',
    landmark: 'Near Symbiosis College',
    city: 'Pune',
    state: 'Maharashtra',
    type: 'Home',
    isDefault: true,
    coordinates: {
      lat: 18.5362,
      lng: 73.8340
    }
  });
  console.log('✅ Seeded delivery address for user1.\n');

  // 8. Seed Regional Dealer Hub for DEALER_001
  console.log('🚚 Seeding Regional Logistics Depot for DEALER_001...');
  await DealerLocation.create({
    hubCode: 'HUB-PUN-01',
    dealer: dealerEntity._id,
    dealerName: dealerEntity.businessName,
    hubType: 'Regional Spares & Logistics Depot',
    city: 'Pune',
    state: 'Maharashtra',
    pincode: '411001',
    address: 'Plot 42, Sanaswadi Industrial Logistics Complex',
    contactPhone: dealerEntity.phone,
    capacityTons: 250,
    serviceRadiusKm: 150,
    activePinCodesCount: 48,
    status: 'Operational',
    location: {
      type: 'Point',
      coordinates: [73.8567, 18.5204]
    }
  });
  console.log('✅ Seeded logistics depot.\n');

  // 9. Seed Real Customer Orders & Dealer Suborders
  console.log('🛍️ Seeding Customer Orders and Dealer Suborders...');
  const orderSeeds = [
    {
      orderNumber: 'ORD-7821',
      items: [{ sku: 'SKU-AG-10', quantity: 1 }],
      orderStatus: 'Delivered',
      paymentMethod: 'upi',
      paymentStatus: 'Completed',
      daysAgo: 10,
      trackingNumber: 'DEL-AG-882190'
    },
    {
      orderNumber: 'ORD-7822',
      items: [{ sku: 'SKU-AG-01', quantity: 2 }],
      orderStatus: 'Shipped',
      paymentMethod: 'card',
      paymentStatus: 'Completed',
      daysAgo: 4,
      trackingNumber: 'DEL-AG-993182'
    },
    {
      orderNumber: 'ORD-7823',
      items: [{ sku: 'SKU-EL-01', quantity: 1 }],
      orderStatus: 'Processing',
      paymentMethod: 'netbanking',
      paymentStatus: 'Completed',
      daysAgo: 2,
      trackingNumber: 'DEL-EL-440192'
    },
    {
      orderNumber: 'ORD-7824',
      items: [{ sku: 'SKU-AU-04', quantity: 2 }],
      orderStatus: 'Placed',
      paymentMethod: 'cod',
      paymentStatus: 'Pending',
      daysAgo: 0,
      trackingNumber: ''
    },
    {
      orderNumber: 'ORD-7825',
      items: [{ sku: 'SKU-AG-07', quantity: 1 }],
      orderStatus: 'Delivered',
      paymentMethod: 'upi',
      paymentStatus: 'Completed',
      daysAgo: 18,
      trackingNumber: 'DEL-AG-110294'
    },
    // Multi-Category Multi-Dealer Order: 2 Agri (Dealer 1) + 1 Electronics (Dealer 2)
    {
      orderNumber: 'ORD-7826',
      items: [
        { sku: 'SKU-AG-01', quantity: 1 },
        { sku: 'SKU-AG-02', quantity: 1 },
        { sku: 'SKU-EL-01', quantity: 1 }
      ],
      orderStatus: 'Placed',
      paymentMethod: 'upi',
      paymentStatus: 'Completed',
      daysAgo: 1,
      trackingNumber: ''
    }
  ];

  for (const s of orderSeeds) {
    const createdAt = new Date(Date.now() - s.daysAgo * 24 * 60 * 60 * 1000);
    const orderItems = [];
    const dealerItemMap = new Map();

    for (const itemSeed of s.items) {
      const prod = createdProducts.find((p) => p.sku === itemSeed.sku);
      if (!prod) continue;

      const subtotal = prod.price * itemSeed.quantity;
      const itemImage = prod.image || (Array.isArray(prod.images) ? prod.images[0] : '');
      const itemRecord = {
        product: prod._id,
        name: prod.name,
        sku: prod.sku,
        price: prod.price,
        mrp: prod.mrp || prod.price,
        quantity: itemSeed.quantity,
        category: prod.categoryName || 'General',
        dealer: prod.dealer,
        dealerCode: prod.dealerCode,
        dealerName: prod.dealerName,
        image: itemImage,
        subtotal
      };
      orderItems.push(itemRecord);

      const dealerItemRecord = {
        product: prod._id,
        name: prod.name,
        sku: prod.sku,
        price: prod.price,
        mrp: prod.mrp || prod.price,
        quantity: itemSeed.quantity,
        subtotal,
        category: prod.categoryName || '',
        subcategory: prod.subcategory || '',
        image: itemImage,
        grade: 'Commercial Grade'
      };

      // Group items by dealer for discrete fulfillment suborders
      const dIdStr = prod.dealer.toString();
      if (!dealerItemMap.has(dIdStr)) {
        dealerItemMap.set(dIdStr, {
          dealerId: prod.dealer,
          dealerCode: prod.dealerCode,
          dealerName: prod.dealerName,
          items: [],
          subtotal: 0
        });
      }
      const dEntry = dealerItemMap.get(dIdStr);
      dEntry.items.push(dealerItemRecord);
      dEntry.subtotal += subtotal;
    }

    const itemsTotal = orderItems.reduce((acc, curr) => acc + curr.subtotal, 0);
    const deliveryFee = 0;
    const tax = Math.round(itemsTotal * 0.18);
    const grandTotal = itemsTotal + deliveryFee + tax;

    // Create Master Parent Order
    const masterOrder = await Order.create({
      orderNumber: s.orderNumber,
      customer: user1._id,
      customerSnapshot: {
        name: user1.name,
        email: user1.email,
        phone: user1.phone
      },
      shippingAddress: {
        name: userAddress.name,
        mobile: userAddress.mobile,
        pincode: userAddress.pincode,
        house: userAddress.house,
        street: userAddress.street,
        landmark: userAddress.landmark,
        city: userAddress.city,
        state: userAddress.state
      },
      items: orderItems,
      dealers: Array.from(dealerItemMap.values()).map((d) => d.dealerId),
      pricing: {
        itemsTotal,
        discount: 0,
        deliveryFee,
        tax,
        total: grandTotal
      },
      payment: {
        method: s.paymentMethod,
        methodLabel: s.paymentMethod === 'upi' ? 'Unified Payments Interface' : s.paymentMethod === 'card' ? 'Credit/Debit Card' : 'Net Banking',
        status: s.paymentStatus,
        transactionId: `TXN-ORD-${s.orderNumber}-${Math.floor(1000 + Math.random() * 9000)}`,
        paidAt: s.paymentStatus === 'Completed' ? createdAt : null
      },
      orderStatus: s.orderStatus,
      fulfillmentStatus: s.orderStatus === 'Delivered' ? 'Fulfilled' : s.orderStatus === 'Shipped' ? 'In Transit' : 'Unfulfilled',
      timeline: [
        {
          status: 'Placed',
          title: 'Order Placed',
          note: 'Customer completed checkout successfully.',
          timestamp: createdAt
        },
        ...(s.orderStatus === 'Shipped' || s.orderStatus === 'Delivered'
          ? [
              {
                status: 'Shipped',
                title: 'Order Dispatched',
                note: `Cargo handed over to carrier. Tracking: ${s.trackingNumber}`,
                timestamp: new Date(createdAt.getTime() + 24 * 3600000)
              }
            ]
          : []),
        ...(s.orderStatus === 'Delivered'
          ? [
              {
                status: 'Delivered',
                title: 'Order Delivered',
                note: 'Consignment signed and received by customer.',
                timestamp: new Date(createdAt.getTime() + 72 * 3600000)
              }
            ]
          : [])
      ],
      createdAt
    });

    // Create Dealer Suborders
    const createdDealerOrderIds = [];
    let dealerIndex = 1;

    for (const dEntry of dealerItemMap.values()) {
      const commissionRate = 5.0;
      const commissionAmount = Math.round((dEntry.subtotal * commissionRate) / 100);
      const netSettlementAmount = dEntry.subtotal - commissionAmount;
      const subOrderNumber = `${s.orderNumber}-D${dealerIndex++}`;

      const dealerOrder = await DealerOrder.create({
        parentOrder: masterOrder._id,
        parentOrderNumber: masterOrder.orderNumber,
        orderNumber: subOrderNumber,
        dealer: dEntry.dealerId,
        dealerCode: dEntry.dealerCode,
        customer: user1._id,
        customerSnapshot: {
          name: user1.name,
          email: user1.email,
          phone: user1.phone,
          address: `${userAddress.house}, ${userAddress.street}, ${userAddress.city}`,
          city: userAddress.city,
          state: userAddress.state
        },
        items: dEntry.items,
        subtotal: dEntry.subtotal,
        commissionRate,
        commissionAmount,
        netSettlementAmount,
        orderStatus: s.orderStatus,
        fulfillmentPartner: 'Delhivery Express Cargo',
        trackingNumber: s.trackingNumber || `DEL-${dEntry.dealerCode}-${Math.floor(100000 + Math.random() * 900000)}`,
        estimatedDelivery: '3 - 5 Business Days',
        payoutStatus: s.orderStatus === 'Delivered' ? 'Settled' : 'Pending Escrow',
        timeline: [
          {
            status: 'Placed',
            title: 'Suborder Routed to Dealer',
            note: `Suborder assigned to ${dEntry.dealerName}.`,
            timestamp: createdAt
          },
          ...(s.orderStatus === 'Shipped' || s.orderStatus === 'Delivered'
            ? [
                {
                  status: 'Shipped',
                  title: 'Dispatched from Dealer Depot',
                  note: `Dispatched with tracking ${s.trackingNumber}`,
                  timestamp: new Date(createdAt.getTime() + 24 * 3600000)
                }
              ]
            : []),
          ...(s.orderStatus === 'Delivered'
            ? [
                {
                  status: 'Delivered',
                  title: 'Delivered to Customer',
                  note: 'Delivered and verified by consignee.',
                  timestamp: new Date(createdAt.getTime() + 72 * 3600000)
                }
              ]
            : [])
        ],
        createdAt
      });

      createdDealerOrderIds.push(dealerOrder._id);

      if (s.orderStatus === 'Delivered') {
        await Settlement.create({
          settlementId: `SETTL-${subOrderNumber}`,
          dealer: dEntry.dealerId,
          dealerName: dEntry.dealerName,
          cycle: 'Weekly Standard Payout',
          grossAmount: dEntry.subtotal,
          commissionDeducted: commissionAmount,
          taxDeducted: Math.round(dEntry.subtotal * 0.01),
          netPayout: netSettlementAmount - Math.round(dEntry.subtotal * 0.01),
          bankRef: `NEFT${Math.floor(100000000 + Math.random() * 900000000)}`,
          status: 'SETTLED',
          dealerOrders: [dealerOrder._id],
          settledAt: new Date(createdAt.getTime() + 96 * 3600000)
        });
      }
    }

    masterOrder.dealerOrders = createdDealerOrderIds;
    await masterOrder.save();

    await Payment.create({
      transactionId: `TXN-ORD-${s.orderNumber}-${Math.floor(1000 + Math.random() * 9000)}`,
      order: masterOrder._id,
      orderNumber: masterOrder.orderNumber,
      customer: user1._id,
      customerName: user1.name,
      amount: masterOrder.pricing.total,
      currency: 'INR',
      paymentMethod: s.paymentMethod,
      status: s.paymentStatus === 'Completed' ? 'COMPLETED' : 'PENDING',
      escrowStatus: s.orderStatus === 'Delivered' ? 'Released' : 'Escrow Held',
      paidAt: s.paymentStatus === 'Completed' ? createdAt : null
    });
  }
  console.log(`✅ Seeded ${orderSeeds.length} customer orders and dealer suborders.\n`);

  // 10. Seed System Admin Settings & Audit Log
  console.log('⚙️ Seeding Admin Platform Settings & Audit Log...');
  await AdminSettings.create({
    general: {
      marketplaceName: 'GROVE Agritech & Commercial Marketplace',
      supportEmail: 'operations@grove.com',
      supportPhone: '+91 80000 12345',
      defaultCurrency: 'INR (₹)',
      maintenanceMode: false
    },
    commission: {
      defaultCommissionRate: 5.0,
      minPayoutThreshold: 10000,
      escrowHoldPeriodDays: 3,
      taxTcsRate: 1.0
    },
    notifications: {
      emailOnNewKyc: true,
      emailOnLowStock: true,
      emailDailySummary: true
    },
    updatedBy: admin._id
  });

  await AuditLog.create({
    logId: 'LOG-INIT-001',
    action: 'PLATFORM_BOOTSTRAP_SEED',
    actor: admin._id,
    actorRole: 'SUPER_ADMIN',
    targetEntity: 'System',
    targetId: 'SEED_INIT',
    details: 'Database initialized with 2 User accounts (user1, admin), 4 Dealer accounts, and 54 catalog products loaded from seed-products.json.',
    ipAddress: '127.0.0.1'
  });
  console.log('✅ Seeded Admin Settings and Audit Log.\n');

  console.log('==============================================================');
  console.log('🎉 SEEDING COMPLETE! Summary of Seeded Data:');
  console.log('==============================================================');
  console.log(`• Categories:    ${categories.length} (Agriculture, Electronics, Automotive, Groceries)`);
  console.log(`• Users (users): Exactly 2 accounts`);
  console.log(`  - Customer:               user1@grove.com   / Password@123`);
  console.log(`  - Super Admin:            admin@grove.com   / Admin@123`);
  console.log(`• Dealers (dealers): Exactly 4 Verified Category Dealers`);
  console.log(`  - Dealer 1 (Agriculture): dealer1@grove.com / Password@123 (DEALER_001)`);
  console.log(`  - Dealer 2 (Electronics): dealer2@grove.com / Password@123 (DEALER_002)`);
  console.log(`  - Dealer 3 (Automotive):  dealer3@grove.com / Password@123 (DEALER_003)`);
  console.log(`  - Dealer 4 (Groceries):   dealer4@grove.com / Password@123 (DEALER_004)`);
  console.log(`• Products:      ${createdProducts.length} Total Products (18 per category, 3 per subcategory)`);
  console.log(`  - Agriculture: 18 products (SKU-AG-01 to SKU-AG-18) -> DEALER_001`);
  console.log(`  - Electronics: 18 products (SKU-EL-01 to SKU-EL-18) -> DEALER_002`);
  console.log(`  - Automotive:  18 products (SKU-AU-01 to SKU-AU-18) -> DEALER_003`);
  console.log(`• Inventories:   ${createdInventory.length} Active Stock Records`);
  console.log(`• Delivery Hubs: 1 Operational Logistics Hub`);
  console.log(`• Addresses:     1 Default Customer Address`);
  console.log('==============================================================\n');

  await disconnectDB();
  process.exit(0);
}

seedDatabase().catch(async (err) => {
  console.error('❌ Database seed process failed with error:', err);
  await disconnectDB();
  process.exit(1);
});
