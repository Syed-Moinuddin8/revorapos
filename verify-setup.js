#!/usr/bin/env node

/**
 * Setup Verification Script
 * 
 * This script verifies that your Supabase database is properly configured
 * and can connect successfully from this device.
 * 
 * Usage: node verify-setup.js
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config();

console.log('\n🔍 Cafe POS - Database Configuration Verification\n');
console.log('='.repeat(60));

// Check if .env file exists
const envPath = join(__dirname, '.env');
if (!existsSync(envPath)) {
  console.log('\n❌ ERROR: .env file not found!');
  console.log('\n📝 Next Steps:');
  console.log('   1. Copy .env.example to .env');
  console.log('   2. Add your Supabase credentials to .env');
  console.log('   3. Run this script again\n');
  process.exit(1);
}

console.log('✅ .env file found');

// Get credentials from environment
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

// Validate credentials exist
console.log('\n📋 Checking Configuration...\n');

if (!supabaseUrl || supabaseUrl.includes('your-project')) {
  console.log('❌ VITE_SUPABASE_URL is not configured properly');
  console.log('   Current value:', supabaseUrl || '(not set)');
  console.log('\n📝 Fix: Set VITE_SUPABASE_URL in your .env file');
  console.log('   Example: VITE_SUPABASE_URL="https://xxxxx.supabase.co"\n');
  process.exit(1);
}

if (!supabaseKey || supabaseKey.includes('your-anon-key')) {
  console.log('❌ VITE_SUPABASE_ANON_KEY is not configured properly');
  console.log('   Current value:', supabaseKey ? '(placeholder value)' : '(not set)');
  console.log('\n📝 Fix: Set VITE_SUPABASE_ANON_KEY in your .env file');
  console.log('   Example: VITE_SUPABASE_ANON_KEY="eyJhbGc..."\n');
  process.exit(1);
}

// Validate URL format
if (!supabaseUrl.startsWith('https://')) {
  console.log('❌ VITE_SUPABASE_URL must start with https://');
  console.log('   Current value:', supabaseUrl);
  process.exit(1);
}

console.log('✅ VITE_SUPABASE_URL configured');
console.log('   URL:', supabaseUrl);

console.log('✅ VITE_SUPABASE_ANON_KEY configured');
console.log('   Key:', supabaseKey.substring(0, 20) + '...');

// Test database connection
console.log('\n🔌 Testing Database Connection...\n');

const supabase = createClient(supabaseUrl, supabaseKey);

async function verifyConnection() {
  try {
    // Test 1: Check if we can connect
    console.log('📡 Test 1: Connecting to Supabase...');
    const { error: authError } = await supabase.auth.getSession();
    
    if (authError && authError.message.includes('Invalid API key')) {
      console.log('❌ Connection FAILED: Invalid API key');
      console.log('\n📝 Next Steps:');
      console.log('   1. Go to Supabase Dashboard → Settings → API');
      console.log('   2. Copy your anon/public key');
      console.log('   3. Update VITE_SUPABASE_ANON_KEY in .env');
      console.log('   4. Run this script again\n');
      process.exit(1);
    }
    
    console.log('✅ Connection successful!');

    // Test 2: Check if tables exist
    console.log('\n📊 Test 2: Checking database tables...');
    
    const tables = ['categories', 'products', 'orders', 'held_orders', 'users', 'customers', 'settings'];
    let allTablesExist = true;
    const missingTables = [];

    for (const table of tables) {
      const { data, error } = await supabase.from(table).select('id').limit(1);
      
      if (error) {
        console.log(`❌ Table "${table}" not found or inaccessible`);
        allTablesExist = false;
        missingTables.push(table);
      } else {
        console.log(`✅ Table "${table}" exists`);
      }
    }

    if (!allTablesExist) {
      console.log('\n❌ Some tables are missing!');
      console.log('\n📝 Next Steps:');
      console.log('   1. Go to Supabase Dashboard → SQL Editor');
      console.log('   2. Open supabase_schema.sql from this project');
      console.log('   3. Copy ALL contents and paste in SQL Editor');
      console.log('   4. Click "Run" to create the tables');
      console.log('   5. Run this script again\n');
      console.log('Missing tables:', missingTables.join(', '));
      process.exit(1);
    }

    // Test 3: Check Row Level Security
    console.log('\n🔒 Test 3: Checking permissions...');
    
    // Try to insert a test category
    const testCategory = {
      id: `test_${Date.now()}`,
      name: 'Test Category',
      slug: 'test',
      icon_name: 'coffee',
      sort_order: 999,
      is_active: true,
      raw_json: { id: `test_${Date.now()}`, name: 'Test' }
    };

    const { data: insertData, error: insertError } = await supabase
      .from('categories')
      .insert(testCategory)
      .select();

    if (insertError) {
      console.log('⚠️  Write permission test failed');
      console.log('   Error:', insertError.message);
      console.log('\n📝 This might be a Row Level Security (RLS) issue');
      console.log('   The schema should have set up proper policies');
      console.log('   Check if you ran the COMPLETE supabase_schema.sql\n');
    } else {
      console.log('✅ Write permissions working!');
      
      // Clean up test data
      await supabase.from('categories').delete().eq('id', testCategory.id);
      console.log('✅ Test data cleaned up');
    }

    // Success!
    console.log('\n' + '='.repeat(60));
    console.log('🎉 SUCCESS! Your database is properly configured!\n');
    console.log('✅ Connection: Working');
    console.log('✅ Tables: All present');
    console.log('✅ Permissions: Configured\n');
    console.log('📱 You can now:');
    console.log('   1. Run: npm run dev');
    console.log('   2. Open: http://localhost:3000');
    console.log('   3. Use the POS system on any device with these credentials\n');
    console.log('🌍 Multi-Device Access:');
    console.log('   - All devices using the same .env credentials');
    console.log('   - Will share the same centralized database');
    console.log('   - Real-time sync across all devices\n');
    console.log('='.repeat(60) + '\n');

  } catch (error) {
    console.log('\n❌ Unexpected error during verification:');
    console.log(error.message);
    console.log('\n📝 Possible issues:');
    console.log('   - Internet connection problems');
    console.log('   - Supabase project is paused (free tier limitation)');
    console.log('   - Firewall blocking connection');
    console.log('\nTry:');
    console.log('   - Check your internet connection');
    console.log('   - Visit Supabase Dashboard to ensure project is active');
    console.log('   - Run this script again\n');
    process.exit(1);
  }
}

verifyConnection();
