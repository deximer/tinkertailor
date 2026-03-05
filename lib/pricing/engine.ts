/**
 * Pricing engine — calculates order totals for Tinker Tailor garments.
 *
 * Formula:
 *   subtotal = silhouette base_price + SUM(fabric_skins.price_markup per product_component)
 *   shippingCost = FLAT_SHIPPING_RATE
 *   total = subtotal + shippingCost
 *
 * All monetary values are returned as strings with 2 decimal places for
 * numeric precision (matching Drizzle's numeric column output).
 */

import { eq } from "drizzle-orm";
import {
  products,
  productComponents,
  silhouetteTemplates,
  fabricSkins,
} from "@/lib/db/schema";
import { db } from "@/lib/db";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Flat shipping rate for MVP (USD). */
export const FLAT_SHIPPING_RATE = "9.95";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PricingBreakdown {
  subtotal: string;
  shippingCost: string;
  total: string;
}

// ---------------------------------------------------------------------------
// Main pricing function
// ---------------------------------------------------------------------------

/**
 * Calculate the full order total for a product.
 *
 * 1. Look up the product to get its silhouetteTemplateId
 * 2. Get the base price from silhouette_templates
 * 3. Get all product_components; join to fabric_skins for price_markup
 * 4. Sum fabric markups (components with no fabric have 0 markup)
 * 5. Add flat shipping
 *
 * @throws {Error} if the product is not found
 * @throws {Error} if the product has no silhouette template assigned
 */
export async function calculateOrderTotal(params: {
  productId: string;
}): Promise<PricingBreakdown> {
  const { productId } = params;

  // 1. Look up the product
  const productRows = await db
    .select({
      id: products.id,
      silhouetteTemplateId: products.silhouetteTemplateId,
    })
    .from(products)
    .where(eq(products.id, productId));

  if (productRows.length === 0) {
    throw new Error(`Product not found: ${productId}`);
  }

  const product = productRows[0];

  if (!product.silhouetteTemplateId) {
    throw new Error(
      `Product has no silhouette template assigned: ${productId}`,
    );
  }

  // 2. Get the silhouette base price
  const silhouetteRows = await db
    .select({
      basePrice: silhouetteTemplates.basePrice,
    })
    .from(silhouetteTemplates)
    .where(eq(silhouetteTemplates.id, product.silhouetteTemplateId));

  if (silhouetteRows.length === 0) {
    throw new Error(
      `Silhouette template not found: ${product.silhouetteTemplateId}`,
    );
  }

  const basePrice = parseFloat(silhouetteRows[0].basePrice);

  // 3. Get all product components with their fabric markups
  const componentRows = await db
    .select({
      fabricSkinId: productComponents.fabricSkinId,
    })
    .from(productComponents)
    .where(eq(productComponents.productId, productId));

  // 4. Sum fabric markups
  let fabricMarkupTotal = 0;

  for (const row of componentRows) {
    if (!row.fabricSkinId) {
      // No fabric selected on this component — treat markup as 0
      continue;
    }

    const fabricRows = await db
      .select({
        priceMarkup: fabricSkins.priceMarkup,
      })
      .from(fabricSkins)
      .where(eq(fabricSkins.id, row.fabricSkinId));

    if (fabricRows.length > 0) {
      fabricMarkupTotal += parseFloat(fabricRows[0].priceMarkup);
    }
  }

  // 5. Calculate totals
  const subtotal = basePrice + fabricMarkupTotal;
  const shippingCost = parseFloat(FLAT_SHIPPING_RATE);
  const total = subtotal + shippingCost;

  return {
    subtotal: subtotal.toFixed(2),
    shippingCost: FLAT_SHIPPING_RATE,
    total: total.toFixed(2),
  };
}
