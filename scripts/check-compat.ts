import { db } from "@/lib/db";
import { componentTypes, bodiceSkirtCompatibility, bodiceSleeveCompatibility } from "@/lib/db/schema";
import { sql } from "drizzle-orm";

async function main() {
  const types = await db.select({
    name: componentTypes.name,
    slug: componentTypes.slug,
    garmentPart: componentTypes.garmentPart,
  }).from(componentTypes);
  console.log("Component types:", JSON.stringify(types, null, 2));

  const [bsk] = await db.select({ count: sql<number>`count(*)` }).from(bodiceSkirtCompatibility);
  const [bsl] = await db.select({ count: sql<number>`count(*)` }).from(bodiceSleeveCompatibility);
  console.log("bodice-skirt edges:", bsk.count);
  console.log("bodice-sleeve edges:", bsl.count);
}
main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
