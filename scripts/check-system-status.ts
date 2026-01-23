/**
 * System Status Check - Verifies all components are configured correctly
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { existsSync } from 'fs';

interface Status {
  component: string;
  status: '✅' | '⚠️' | '❌';
  message: string;
}

function checkEnvVars(): Status[] {
  const results: Status[] = [];
  const envPath = join(process.cwd(), '.env');
  
  if (!existsSync(envPath)) {
    results.push({
      component: '.env file',
      status: '❌',
      message: 'Missing .env file'
    });
    return results;
  }
  
  const envContent = readFileSync(envPath, 'utf-8');
  const envVars: Record<string, { required: boolean; name: string }> = {
    ACRCLOUD_ACCESS_KEY: { required: true, name: 'ACRCloud Access Key' },
    ACRCLOUD_ACCESS_SECRET: { required: true, name: 'ACRCloud Access Secret' },
    SOUNDCLOUD_CLIENT_ID: { required: true, name: 'SoundCloud Client ID' },
    YT_DLP_PATH: { required: false, name: 'yt-dlp Path' },
  };
  
  for (const [key, info] of Object.entries(envVars)) {
    const regex = new RegExp(`^${key}=(.+)$`, 'm');
    const match = envContent.match(regex);
    
    if (info.required) {
      if (match && match[1] && match[1].trim().length > 0) {
        results.push({
          component: info.name,
          status: '✅',
          message: 'Configured'
        });
      } else {
        results.push({
          component: info.name,
          status: '❌',
          message: 'Missing or empty'
        });
      }
    } else {
      if (match && match[1] && match[1].trim().length > 0) {
        results.push({
          component: info.name,
          status: '✅',
          message: `Set to: ${match[1].trim()}`
        });
      } else {
        results.push({
          component: info.name,
          status: '⚠️',
          message: 'Not set (will use default)'
        });
      }
    }
  }
  
  return results;
}

function checkYtDlp(): Status[] {
  const results: Status[] = [];
  const envPath = join(process.cwd(), '.env');
  
  if (!existsSync(envPath)) {
    return results;
  }
  
  const envContent = readFileSync(envPath, 'utf-8');
  const ytDlpMatch = envContent.match(/^YT_DLP_PATH=(.+)$/m);
  
  if (ytDlpMatch) {
    const path = ytDlpMatch[1].trim();
    const resolvedPath = path.startsWith('./') 
      ? join(process.cwd(), path)
      : path;
    
    if (existsSync(resolvedPath)) {
      try {
        const stats = require('fs').statSync(resolvedPath);
        if (stats.isFile() && (stats.mode & parseInt('111', 8))) {
          results.push({
            component: 'yt-dlp binary',
            status: '✅',
            message: `Found and executable: ${path}`
          });
        } else {
          results.push({
            component: 'yt-dlp binary',
            status: '⚠️',
            message: `Found but not executable: ${path}`
          });
        }
      } catch {
        results.push({
          component: 'yt-dlp binary',
          status: '❌',
          message: `Cannot access: ${path}`
        });
      }
    } else {
      results.push({
        component: 'yt-dlp binary',
        status: '❌',
        message: `Not found at: ${path}`
      });
    }
  } else {
    // Check default location
    const defaultPath = join(process.cwd(), 'bin', 'yt-dlp');
    if (existsSync(defaultPath)) {
      results.push({
        component: 'yt-dlp binary',
        status: '✅',
        message: 'Found at default location: ./bin/yt-dlp'
      });
    } else {
      results.push({
        component: 'yt-dlp binary',
        status: '⚠️',
        message: 'Not found (YouTube resolution may not work)'
      });
    }
  }
  
  return results;
}

function checkCodeIntegrity(): Status[] {
  const results: Status[] = [];
  const scraperPath = join(process.cwd(), 'backend', 'trpc', 'routes', 'scraper.ts');
  
  if (!existsSync(scraperPath)) {
    results.push({
      component: 'Backend code',
      status: '❌',
      message: 'scraper.ts not found'
    });
    return results;
  }
  
  const content = readFileSync(scraperPath, 'utf-8');
  
  // Check if identifyTrackFromUrl uses the internal helper
  if (content.includes('identifyTrackFromUrlInternal')) {
    results.push({
      component: 'URL Resolution',
      status: '✅',
      message: 'identifyTrackFromUrl uses internal helper (SoundCloud/YouTube resolution enabled)'
    });
  } else {
    results.push({
      component: 'URL Resolution',
      status: '❌',
      message: 'identifyTrackFromUrl does not use internal helper - URL resolution may not work'
    });
  }
  
  // Check if SoundCloud resolution function exists
  if (content.includes('resolveSoundCloudToStreamUrl')) {
    results.push({
      component: 'SoundCloud Resolution',
      status: '✅',
      message: 'SoundCloud URL resolution function present'
    });
  } else {
    results.push({
      component: 'SoundCloud Resolution',
      status: '❌',
      message: 'SoundCloud URL resolution function missing'
    });
  }
  
  // Check if YouTube resolution function exists
  if (content.includes('resolveYouTubeToStreamUrl')) {
    results.push({
      component: 'YouTube Resolution',
      status: '✅',
      message: 'YouTube URL resolution function present'
    });
  } else {
    results.push({
      component: 'YouTube Resolution',
      status: '❌',
      message: 'YouTube URL resolution function missing'
    });
  }
  
  return results;
}

async function main() {
  console.log('🔍 System Status Check\n');
  console.log('='.repeat(60) + '\n');
  
  const allStatuses: Status[] = [];
  
  // Check environment variables
  console.log('📋 Environment Variables:\n');
  const envStatuses = checkEnvVars();
  envStatuses.forEach(s => {
    console.log(`  ${s.status} ${s.component}: ${s.message}`);
    allStatuses.push(s);
  });
  
  console.log('\n' + '-'.repeat(60) + '\n');
  
  // Check yt-dlp
  console.log('🔧 yt-dlp Configuration:\n');
  const ytDlpStatuses = checkYtDlp();
  ytDlpStatuses.forEach(s => {
    console.log(`  ${s.status} ${s.component}: ${s.message}`);
    allStatuses.push(s);
  });
  
  console.log('\n' + '-'.repeat(60) + '\n');
  
  // Check code integrity
  console.log('💻 Code Integrity:\n');
  const codeStatuses = checkCodeIntegrity();
  codeStatuses.forEach(s => {
    console.log(`  ${s.status} ${s.component}: ${s.message}`);
    allStatuses.push(s);
  });
  
  console.log('\n' + '='.repeat(60) + '\n');
  
  // Summary
  const successCount = allStatuses.filter(s => s.status === '✅').length;
  const warningCount = allStatuses.filter(s => s.status === '⚠️').length;
  const errorCount = allStatuses.filter(s => s.status === '❌').length;
  
  console.log('📊 Summary:\n');
  console.log(`  ✅ Working: ${successCount}`);
  console.log(`  ⚠️  Warnings: ${warningCount}`);
  console.log(`  ❌ Errors: ${errorCount}`);
  
  if (errorCount === 0 && warningCount === 0) {
    console.log('\n🎉 All systems operational!');
  } else if (errorCount === 0) {
    console.log('\n✅ Core systems working (some optional features may be limited)');
  } else {
    console.log('\n⚠️  Some issues detected - please review above');
  }
  
  console.log('\n');
}

main().catch(console.error);
