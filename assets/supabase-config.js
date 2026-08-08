/**
 * Same Supabase project as your public website -- paste the SAME
 * Project URL and anon public key you used in the main site's
 * assets/supabase-config.js. This is safe: what this key can actually
 * DO is controlled by whether the visitor is logged in, not by the
 * key itself.
 */
const SUPABASE_URL = "https://ueyyzshhqizcgnzleigg.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVleXl6c2hocWl6Y2duemxlaWdnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ0NjI3MzcsImV4cCI6MjEwMDAzODczN30.9Vk_DAjjqdqRyHKA-68fwzjQhZomijARiqyqfKWz5Jo";

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
