'use strict';

require('dotenv').config();

/**
 * Supabase configuration file
 * This file can be used if you want to integrate Supabase Auth or other Supabase services
 * beyond just using the Postgres database.
 */

module.exports = {
  supabaseUrl: 'https://tnrwottbdozuvdcmugve.supabase.co',
  supabaseKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRucndvdHRiZG96dXZkY211Z3ZlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDc1NzM3MzksImV4cCI6MjA2MzE0OTczOX0.0NDPk0rIKNGEGjj87DPxyBkffxIRchfUop95lW-BedA',
  
  // Database connection string (for reference)
  databaseUrl: 'postgresql://postgres:Dk@9741397943@db.tnrwottbdozuvdcmugve.supabase.co:5432/postgres'
};
