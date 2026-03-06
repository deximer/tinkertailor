import { createClient } from '@supabase/supabase-js';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { profiles } from '../lib/db/schema/profiles';
import { eq } from 'drizzle-orm';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const email = process.env.SEED_USER_EMAIL;
const password = process.env.SEED_USER_PASSWORD;
const databaseUrl = process.env.DATABASE_URL;

if (!url || !serviceRoleKey || !email || !password || !databaseUrl) {
  console.error('Missing required env vars: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SEED_USER_EMAIL, SEED_USER_PASSWORD, DATABASE_URL');
  process.exit(1);
}

const supabase = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const sql = postgres(databaseUrl);
const db = drizzle(sql);

type UserRole = 'admin' | 'creator' | 'shopper';

async function ensureProfile(userId: string, role: UserRole, label: string) {
  const existing = await db.select().from(profiles).where(eq(profiles.id, userId));
  if (existing.length > 0) {
    console.log(`Profile for ${label} already exists (role: ${existing[0].role}), skipping.`);
    return;
  }
  await db.insert(profiles).values({ id: userId, role });
  console.log(`Created profile for ${label} with role: ${role}`);
}

async function createSeedUser(
  userEmail: string,
  userPassword: string,
  role: UserRole,
  label: string,
): Promise<string | null> {
  const { data, error } = await supabase.auth.admin.createUser({
    email: userEmail,
    password: userPassword,
    email_confirm: true,
  });

  let userId: string | null = null;

  if (error) {
    if (error.message.includes('already been registered')) {
      console.log(`User ${userEmail} already exists, looking up ID.`);
      const { data: listData } = await supabase.auth.admin.listUsers();
      const found = listData?.users?.find((u) => u.email === userEmail);
      userId = found?.id ?? null;
    } else {
      console.error(`Failed to create ${label}:`, error.message);
      return null;
    }
  } else {
    userId = data.user.id;
    console.log(`Created user ${data.user.email} (${data.user.id})`);
  }

  if (userId) {
    await ensureProfile(userId, role, label);
  }

  return userId;
}

async function main() {
  // Create seed users with explicit roles: one admin, one creator, one shopper
  await createSeedUser(email!, password!, 'admin', 'admin user');

  // Derive additional test users from the seed email
  const [localPart, domain] = email!.split('@');
  const creatorEmail = `${localPart}+creator@${domain}`;
  await createSeedUser(creatorEmail, password!, 'creator', 'creator user');

  const shopperEmail = `${localPart}+shopper@${domain}`;
  await createSeedUser(shopperEmail, password!, 'shopper', 'shopper user');

  // Create models storage bucket (private — authenticated read via signed URLs)
  const { error: bucketError } = await supabase.storage.createBucket('models', {
    public: false,
    fileSizeLimit: 52428800, // 50 MB
    allowedMimeTypes: [
      'application/octet-stream',  // OBJ/MTL files
      'text/plain',                // OBJ/MTL as text
      'model/obj',
    ],
  });

  if (bucketError) {
    if (bucketError.message.includes('already exists')) {
      console.log('Storage bucket "models" already exists, skipping.');
      const { error: updateErr } = await supabase.storage.updateBucket('models', {
        public: false,
      });
      if (updateErr) {
        console.warn('Could not update bucket to private:', updateErr.message);
      } else {
        console.log('Updated "models" bucket to private.');
      }
    } else {
      console.error('Failed to create models bucket:', bucketError.message);
      process.exit(1);
    }
  } else {
    console.log('Created storage bucket "models" (private).');
  }

  // Add Storage RLS policy: authenticated users can read objects from the models bucket.
  const policyName = 'Authenticated users can read models';
  const { error: policyError } = await supabase.rpc('exec_sql', {
    sql: `
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_policies WHERE policyname = '${policyName}'
        ) THEN
          CREATE POLICY "${policyName}"
            ON storage.objects FOR SELECT
            TO authenticated
            USING (bucket_id = 'models');
        END IF;
      END $$;
    `,
  });

  if (policyError) {
    console.warn(
      'Could not create Storage RLS policy via exec_sql RPC:',
      policyError.message,
    );
    console.warn(
      'Manual step: In Supabase Dashboard → Storage → models bucket → Policies,',
      "add a SELECT policy for authenticated role with USING (bucket_id = 'models').",
    );
  } else {
    console.log('Storage RLS policy created: authenticated users can read models.');
  }

  // Close the database connection
  await sql.end();
}

main();
