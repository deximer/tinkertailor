import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const email = process.env.SEED_USER_EMAIL;
const password = process.env.SEED_USER_PASSWORD;

if (!url || !serviceRoleKey || !email || !password) {
  console.error('Missing required env vars: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SEED_USER_EMAIL, SEED_USER_PASSWORD');
  process.exit(1);
}

const supabase = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  // Create seed user
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (error) {
    if (error.message.includes('already been registered')) {
      console.log(`User ${email} already exists, skipping.`);
    } else {
      console.error('Failed to create user:', error.message);
      process.exit(1);
    }
  } else {
    console.log(`Created user ${data.user.email} (${data.user.id})`);
  }

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
}

main();
