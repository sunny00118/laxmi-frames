// supabase-config.js
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const SUPABASE_URL = 'https://fwjgxzsldgyqcdopjypd.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ3amd4enNsZGd5cWNkb3BqeXBkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIyNzgzMDEsImV4cCI6MjA5Nzg1NDMwMX0.7Iu8MIkiKZBENFdgCWm6MM0-TgHG6ln8ncD2abkW9kU';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);