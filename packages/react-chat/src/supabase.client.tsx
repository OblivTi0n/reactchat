import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://fqwbmxhwtkzxycwmrcle.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZxd2JteGh3dGt6eHljd21yY2xlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MTI2NDU2NzMsImV4cCI6MjAyODIyMTY3M30._4JHp5pEcRvHo_WnCXuTJmz1sqhrVAqprJxXyfY5QPA';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
