import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://fqwbmxhwtkzxycwmrcle.supabase.co';
const supabaseServiceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZxd2JteGh3dGt6eHljd21yY2xlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTcxMjY0NTY3MywiZXhwIjoyMDI4MjIxNjczfQ.sqPkp1MY_0BJ9lYFewfZWZHytXajAxNDHm8YPWrudtM';  // Use the service role key

export const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
