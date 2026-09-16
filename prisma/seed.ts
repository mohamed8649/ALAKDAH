/**
 * Database seed.
 *
 * Two distinct kinds of data:
 *
 *  1. CATALOGUE data — roles, permissions, plans, apps, themes. This is part of
 *     the product and is seeded in every environment, including production.
 *  2. DEMO data — a store with products and orders. Clearly marked, gated on
 *     SEED_DEMO, and every generated record carries a `seed` tag so it can
 *     never be mistaken for a merchant's real data.
 */

import { PrismaClient } from '@prisma/client';

import { APP_DEFINITIONS } from '../src/server/catalog/apps';
import { ADD_ONS, PLANS } from '../src/server/catalog/plans';
import { THEMES } from '../src/server/catalog/themes';
import { hashPassword } from '../src/lib/crypto';
import { ROLE_DEFINITIONS, permissionsForRole, ROLE_KEYS } from '../src/server/policies/permissions';
import { generateOrderNumber, slugify } from '../src/lib/slug';
import { normalisePhone } from '../src/lib/phone';
import { combinationSignature, generateCombinations } from '../src/features/products/variants';

const prisma = new PrismaClient();

async function seedCatalogue() {
  for (const key of ROLE_KEYS) {
    const definition = ROLE_DEFINITIONS[key];
    await prisma.role.upsert({
      where: { key },
      create: {
        key,
        nameAr: definition.nameAr,
        nameEn: definition.nameEn,
        description: definition.descriptionAr,
        isSystem: true,
        rank: definition.rank,
      },
      update: {
        nameAr: definition.nameAr,
        nameEn: definition.nameEn,
        description: definition.descriptionAr,
        rank: definition.rank,
      },
    });

    await prisma.rolePermission.deleteMany({ where: { roleKey: key } });
    await prisma.rolePermission.createMany({
      data: permissionsForRole(key).map((permission) => ({ roleKey: key, permissionKey: permission })),
      skipDuplicates: true,
    });
  }

  for (const plan of PLANS) {
    await prisma.plan.upsert({
      where: { key: plan.key },
      create: {
        key: plan.key,
        nameAr: plan.nameAr,
        nameEn: plan.nameEn,
        descriptionAr: plan.descriptionAr,
        monthlyPrice: plan.monthlyPrice,
        yearlyPrice: plan.yearlyPrice,
        currency: plan.currency,
        isPayg: plan.isPayg,
        position: plan.position,
      },
      update: {
        nameAr: plan.nameAr,
        nameEn: plan.nameEn,
        descriptionAr: plan.descriptionAr,
        monthlyPrice: plan.monthlyPrice,
        yearlyPrice: plan.yearlyPrice,
        position: plan.position,
      },
    });

    await prisma.planFeature.deleteMany({ where: { planKey: plan.key } });
    await prisma.planFeature.createMany({
      data: plan.features.map((featureKey) => ({ planKey: plan.key, featureKey, enabled: true })),
    });

    await prisma.planLimit.deleteMany({ where: { planKey: plan.key } });
    await prisma.planLimit.createMany({
      data: Object.entries(plan.limits).map(([limitKey, value]) => ({
        planKey: plan.key,
        limitKey,
        value,
      })),
    });
  }

  for (const addOn of ADD_ONS) {
    await prisma.addOn.upsert({
      where: { key: addOn.key },
      create: addOn,
      update: addOn,
    });
  }

  for (const app of APP_DEFINITIONS) {
    await prisma.appDefinition.upsert({
      where: { key: app.key },
      create: {
        key: app.key,
        nameAr: app.nameAr,
        nameEn: app.nameEn,
        descriptionAr: app.descriptionAr,
        descriptionEn: app.descriptionEn,
        category: app.category,
        icon: app.icon,
        settingsRoute: app.settingsRoute,
        isCore: app.isCore,
        requiredFeature: app.requiredFeature,
        position: app.position,
      },
      update: {
        nameAr: app.nameAr,
        descriptionAr: app.descriptionAr,
        category: app.category,
        icon: app.icon,
        settingsRoute: app.settingsRoute,
        requiredFeature: app.requiredFeature,
        position: app.position,
      },
    });
  }

  for (const theme of THEMES) {
    await prisma.themeDefinition.upsert({
      where: { key: theme.key },
      create: {
        key: theme.key,
        nameAr: theme.nameAr,
        nameEn: theme.nameEn,
        descriptionAr: theme.descriptionAr,
        previewImage: theme.previewImage,
        isPremium: theme.isPremium,
        position: theme.position,
        tokens: theme.tokens as object,
        sections: theme.sections as unknown as object,
      },
      update: {
        nameAr: theme.nameAr,
        descriptionAr: theme.descriptionAr,
        previewImage: theme.previewImage,
        position: theme.position,
        tokens: theme.tokens as object,
        sections: theme.sections as unknown as object,
      },
    });
  }

  console.log('✓ catalogue seeded (roles, plans, add-ons, apps, themes)');
}

// ---------------------------------------------------------------------------
// Demo data
// ---------------------------------------------------------------------------

const DEMO_TAG = 'seed';

const DEMO_PRODUCTS = [
  {
    name: 'سماعة بلوتوث لاسلكية',
    shortDescription: 'عزل ضوضاء نشط\nبطارية ٣٠ ساعة\nشحن سريع USB-C',
    price: 189_000,
    compareAtPrice: 249_000,
    stock: 42,
    options: [
      { name: 'اللون', values: ['أسود', 'أبيض', 'أزرق'] },
    ],
  },
  {
    name: 'ساعة ذكية رياضية',
    shortDescription: 'قياس نبض مستمر\nمقاومة للماء\nإشعارات الهاتف',
    price: 320_000,
    compareAtPrice: 399_000,
    stock: 18,
    options: [
      { name: 'اللون', values: ['أسود', 'فضي'] },
      { name: 'المقاس', values: ['40mm', '44mm'] },
    ],
  },
  {
    name: 'حقيبة ظهر مقاومة للماء',
    shortDescription: 'جيب مخصص للابتوب\nقماش مقاوم للماء\nحزام مريح',
    price: 145_000,
    compareAtPrice: null,
    stock: 7,
    options: [],
  },
  {
    name: 'مكنسة سيارة محمولة',
    shortDescription: 'شفط قوي\nسلك طويل\nفلتر قابل للغسل',
    price: 95_000,
    compareAtPrice: 120_000,
    stock: 0,
    options: [],
  },
  {
    name: 'طقم عناية بالبشرة',
    shortDescription: 'غسول لطيف\nمرطب يومي\nواقي شمس',
    price: 210_000,
    compareAtPrice: null,
    stock: 30,
    options: [],
  },
];

const DEMO_REGIONS = [
  { state: 'طرابلس', cities: ['طرابلس المركز', 'تاجوراء', 'جنزور'] },
  { state: 'بنغازي', cities: ['بنغازي المركز', 'الكويفية'] },
  { state: 'مصراتة', cities: ['مصراتة المركز', 'زليتن'] },
  { state: 'سبها', cities: ['سبها المركز'] },
];

const DEMO_CUSTOMERS = [
  'أحمد المبروك', 'فاطمة الزهراء', 'محمد الفيتوري', 'سارة بن علي', 'يوسف بالحاج',
  'مريم الشريف', 'عمر التائب', 'ليلى الورفلي', 'خالد الزوي', 'هدى المقري',
];

const DEMO_STATUSES = [
  'NEW', 'NEW', 'CONFIRMED', 'CONFIRMED', 'PROCESSING',
  'SHIPPED', 'DELIVERED', 'DELIVERED', 'DELIVERED', 'CANCELLED',
] as const;

async function seedDemo() {
  const email = 'demo@alakdah.ly';
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log('✓ demo store already exists, skipping');
    return;
  }

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash: await hashPassword('demo1234'),
      fullName: 'تاجر تجريبي',
      locale: 'ar',
    },
  });

  const store = await prisma.store.create({
    data: {
      slug: 'demo',
      name: 'متجر العقدة التجريبي',
      description: 'متجر تجريبي لعرض إمكانيات المنصة.',
      ownerId: user.id,
      phone: '0912345678',
      currency: 'LYD',
      timezone: 'Africa/Tripoli',
      country: 'LY',
      members: { create: { userId: user.id, roleKey: 'owner' } },
    },
  });

  // Reuse the same bootstrap a real registration runs, so the demo store is
  // configured exactly like a merchant's own new store.
  const { seedStoreDefaults } = await import('../src/server/bootstrap/store-defaults');
  await seedStoreDefaults(store.id);

  const growth = await prisma.plan.findUnique({ where: { key: 'growth' } });
  if (growth) {
    const now = new Date();
    await prisma.subscription.update({
      where: { storeId: store.id },
      data: {
        planKey: growth.key,
        status: 'ACTIVE',
        currentPeriodEnd: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59),
      },
    });
  }

  // Products
  const productIds: Array<{ id: string; price: number; name: string; variantIds: string[] }> = [];

  for (const [index, definition] of DEMO_PRODUCTS.entries()) {
    const product = await prisma.product.create({
      data: {
        storeId: store.id,
        name: definition.name,
        slug: slugify(definition.name, 'product'),
        sku: `DEMO-${String(index + 1).padStart(3, '0')}`,
        shortDescription: definition.shortDescription,
        description: `${definition.name}\n\n${definition.shortDescription}\n\nبيانات تجريبية للعرض فقط.`,
        status: 'ACTIVE',
        visibility: 'VISIBLE',
        price: definition.price,
        compareAtPrice: definition.compareAtPrice,
        cost: Math.round(definition.price * 0.6),
        trackInventory: true,
        stockQuantity: definition.stock,
        lowStockThreshold: 10,
        hasVariants: definition.options.length > 0,
        tags: [DEMO_TAG],
      },
    });

    const variantIds: string[] = [];

    if (definition.options.length > 0) {
      const optionInputs = [];
      for (const [optionIndex, option] of definition.options.entries()) {
        const created = await prisma.productOption.create({
          data: { productId: product.id, name: option.name, position: optionIndex },
        });

        const values = [];
        for (const [valueIndex, value] of option.values.entries()) {
          const createdValue = await prisma.productOptionValue.create({
            data: { optionId: created.id, value, position: valueIndex },
          });
          values.push({ id: createdValue.id, value, position: valueIndex });
        }

        optionInputs.push({ id: created.id, name: option.name, position: optionIndex, values });
      }

      const combinations = generateCombinations(optionInputs);
      const perVariant = Math.max(1, Math.floor(definition.stock / Math.max(1, combinations.length)));

      for (const [position, combination] of combinations.entries()) {
        const variant = await prisma.productVariant.create({
          data: {
            productId: product.id,
            signature: combinationSignature(combination.optionValueIds),
            title: combination.title,
            sku: `DEMO-${String(index + 1).padStart(3, '0')}-${position + 1}`,
            stockQuantity: perVariant,
            position,
          },
        });
        variantIds.push(variant.id);

        await prisma.variantOptionValue.createMany({
          data: combination.optionValueIds.map((optionValueId) => ({
            variantId: variant.id,
            optionValueId,
          })),
        });
      }

      await prisma.product.update({
        where: { id: product.id },
        data: { stockQuantity: perVariant * combinations.length },
      });
    }

    productIds.push({ id: product.id, price: definition.price, name: definition.name, variantIds });
  }

  // A call-center agent, plus a routing rule for the first product.
  const agent = await prisma.agent.create({
    data: {
      storeId: store.id,
      fullName: 'سارة الوكيلة',
      username: 'sara',
      email: 'sara@alakdah.ly',
      passwordHash: await hashPassword('agent1234'),
      isActive: true,
      roleKey: 'call_center_agent',
    },
  });

  await prisma.agentAssignmentRule.create({
    data: {
      storeId: store.id,
      name: 'طلبات السماعات → سارة',
      agentId: agent.id,
      productId: productIds[0]!.id,
      priority: 0,
    },
  });

  // Orders spread across the last 45 days so the charts have a shape.
  const now = Date.now();

  for (let index = 0; index < 60; index += 1) {
    const daysAgo = Math.floor((index / 60) * 45);
    const createdAt = new Date(now - daysAgo * 24 * 60 * 60 * 1000 - (index % 24) * 3600 * 1000);

    const region = DEMO_REGIONS[index % DEMO_REGIONS.length]!;
    const city = region.cities[index % region.cities.length]!;
    const customerName = DEMO_CUSTOMERS[index % DEMO_CUSTOMERS.length]!;
    const phoneDigits = `09${String(10_000_000 + index * 137).slice(0, 8)}`;
    const phone = normalisePhone(phoneDigits, 'LY');
    const status = DEMO_STATUSES[index % DEMO_STATUSES.length]!;

    const product = productIds[index % productIds.length]!;
    const quantity = (index % 3) + 1;
    const lineTotal = product.price * quantity;
    const shipping = 15_000;
    const total = lineTotal + shipping;

    const customer = await prisma.customer.upsert({
      where: { storeId_phone: { storeId: store.id, phone: phone.canonical } },
      create: {
        storeId: store.id,
        name: customerName,
        phone: phone.canonical,
        phoneRaw: phoneDigits,
        tags: [DEMO_TAG],
      },
      update: {},
    });

    const order = await prisma.order.create({
      data: {
        storeId: store.id,
        orderNumber: generateOrderNumber(6),
        customerId: customer.id,
        status,
        paymentStatus: status === 'DELIVERED' ? 'PAID' : 'PENDING',
        paymentMethod: 'COD',
        shippingStatus:
          status === 'DELIVERED' ? 'DELIVERED' : status === 'SHIPPED' ? 'IN_TRANSIT' : 'NOT_SHIPPED',
        subtotal: lineTotal,
        shippingAmount: shipping,
        total,
        currency: 'LYD',
        source: index % 5 === 0 ? 'MANUAL' : 'STOREFRONT',
        assignedAgentId: index % 3 === 0 ? agent.id : null,
        customerName,
        customerPhone: phone.canonical,
        customerPhoneRaw: phoneDigits,
        state: region.state,
        city,
        address: `شارع ${index + 1}، ${city}`,
        tags: [DEMO_TAG],
        createdAt,
        confirmedAt: status === 'NEW' ? null : createdAt,
        deliveredAt: status === 'DELIVERED' ? new Date(createdAt.getTime() + 172_800_000) : null,
        cancelledAt: status === 'CANCELLED' ? new Date(createdAt.getTime() + 3_600_000) : null,
        items: {
          create: {
            productId: product.id,
            variantId: product.variantIds[0] ?? null,
            nameSnapshot: product.name,
            skuSnapshot: null,
            unitPrice: product.price,
            quantity,
            total: lineTotal,
          },
        },
        history: {
          create: {
            fromStatus: null,
            toStatus: 'NEW',
            actorType: 'SYSTEM',
            actorName: 'Seed',
            createdAt,
          },
        },
      },
    });

    if (status !== 'NEW') {
      await prisma.orderStatusHistory.create({
        data: {
          orderId: order.id,
          fromStatus: 'NEW',
          toStatus: status,
          actorType: 'SYSTEM',
          actorName: 'Seed',
          createdAt: new Date(createdAt.getTime() + 3_600_000),
        },
      });
    }

    await prisma.customer.update({
      where: { id: customer.id },
      data: {
        ordersCount: { increment: 1 },
        totalSpent: { increment: status === 'CANCELLED' ? 0 : total },
        lastOrderAt: createdAt,
      },
    });

    // Product view events, so the product analytics conversion column has a
    // denominator rather than being permanently hidden.
    await prisma.analyticsEvent.createMany({
      data: Array.from({ length: 6 }, (_, viewIndex) => ({
        storeId: store.id,
        name: 'product_viewed',
        productId: product.id,
        createdAt: new Date(createdAt.getTime() - viewIndex * 600_000),
      })),
    });
  }

  console.log('✓ demo store seeded');
  console.log('  merchant: demo@alakdah.ly / demo1234');
  console.log('  agent:    store "demo", username "sara" / agent1234');
}

async function main() {
  await seedCatalogue();

  if (process.env.SEED_DEMO === '1' || process.argv.includes('--demo')) {
    await seedDemo();
  } else {
    console.log('· demo data skipped (set SEED_DEMO=1 to include it)');
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
