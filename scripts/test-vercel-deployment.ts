#!/usr/bin/env bun

/**
 * Test script to verify Vercel deployment is working correctly
 * 
 * Usage:
 *   bun run scripts/test-vercel-deployment.ts
 * 
 * Or test a specific URL:
 *   VERCEL_URL=https://your-app.vercel.app bun run scripts/test-vercel-deployment.ts
 */

const VERCEL_URL = process.env.VERCEL_URL || 'https://dashboard-lovat-two-22.vercel.app';

interface TestResult {
  name: string;
  url: string;
  method: string;
  status: 'pass' | 'fail' | 'error';
  message: string;
  response?: any;
}

const tests: TestResult[] = [];

async function testEndpoint(
  name: string,
  url: string,
  options: RequestInit = {}
): Promise<TestResult> {
  try {
    console.log(`\n🧪 Testing: ${name}`);
    console.log(`   URL: ${url}`);
    console.log(`   Method: ${options.method || 'GET'}`);

    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    const status = response.ok ? 'pass' : 'fail';
    let responseData: any;
    const contentType = response.headers.get('content-type');

    if (contentType?.includes('application/json')) {
      responseData = await response.json();
    } else {
      responseData = await response.text();
    }

    const message = response.ok
      ? `✅ Status ${response.status}`
      : `❌ Status ${response.status}`;

    console.log(`   ${message}`);

    return {
      name,
      url,
      method: options.method || 'GET',
      status,
      message: `${response.status} ${response.statusText}`,
      response: responseData,
    };
  } catch (error: any) {
    console.log(`   ❌ Error: ${error.message}`);
    return {
      name,
      url,
      method: options.method || 'GET',
      status: 'error',
      message: error.message,
    };
  }
}

async function runTests() {
  console.log('🚀 Testing Vercel Deployment');
  console.log(`📍 Base URL: ${VERCEL_URL}\n`);

  // Test 1: Health check (root endpoint)
  tests.push(
    await testEndpoint('Health Check', `${VERCEL_URL}/`)
  );

  // Test 2: tRPC endpoint (should handle GET)
  tests.push(
    await testEndpoint('tRPC Endpoint', `${VERCEL_URL}/api/trpc`)
  );

  // Test 3: Legacy API - Sets list
  tests.push(
    await testEndpoint('Legacy API - Sets', `${VERCEL_URL}/api/sets?limit=5`)
  );

  // Test 4: CORS headers
  try {
    const response = await fetch(`${VERCEL_URL}/`, {
      method: 'OPTIONS',
      headers: {
        'Origin': 'https://example.com',
        'Access-Control-Request-Method': 'GET',
      },
    });
    const hasCors = response.headers.get('access-control-allow-origin') === '*';
    tests.push({
      name: 'CORS Headers',
      url: `${VERCEL_URL}/`,
      method: 'OPTIONS',
      status: hasCors ? 'pass' : 'fail',
      message: hasCors ? 'CORS enabled' : 'CORS not configured',
    });
    console.log(`\n🧪 Testing: CORS Headers`);
    console.log(`   ${hasCors ? '✅' : '❌'} CORS ${hasCors ? 'enabled' : 'not configured'}`);
  } catch (error: any) {
    tests.push({
      name: 'CORS Headers',
      url: `${VERCEL_URL}/`,
      method: 'OPTIONS',
      status: 'error',
      message: error.message,
    });
  }

  // Print summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 Test Summary');
  console.log('='.repeat(60));

  const passed = tests.filter(t => t.status === 'pass').length;
  const failed = tests.filter(t => t.status === 'fail').length;
  const errors = tests.filter(t => t.status === 'error').length;

  tests.forEach(test => {
    const icon = test.status === 'pass' ? '✅' : test.status === 'fail' ? '⚠️' : '❌';
    console.log(`${icon} ${test.name}: ${test.message}`);
  });

  console.log('\n' + '='.repeat(60));
  console.log(`Total: ${tests.length} | ✅ Passed: ${passed} | ⚠️ Failed: ${failed} | ❌ Errors: ${errors}`);
  console.log('='.repeat(60));

  if (failed === 0 && errors === 0) {
    console.log('\n🎉 All tests passed! Your Vercel deployment is working correctly.');
    process.exit(0);
  } else {
    console.log('\n⚠️ Some tests failed. Check the output above for details.');
    process.exit(1);
  }
}

runTests().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
