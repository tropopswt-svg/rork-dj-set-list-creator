// 1001Tracklists Exporter - Content Script

function extractTracklist() {
  try {
    // Get set info
    const title = document.querySelector('#pageTitle')?.textContent?.trim() || 
                  document.title.replace(/ \| 1001Tracklists$/i, '');
    
    // Get DJ name
    let djName = '';
    const djLink = document.querySelector('a[href*="/dj/"]');
    if (djLink) {
      djName = djLink.textContent?.trim() || '';
    }
    if (!djName) {
      // Try to extract from title
      const parts = title.split(/\s*[-–@]\s*/);
      if (parts.length >= 2) {
        djName = parts[0].trim();
      }
    }
    
    // Get date
    let setDate = '';
    const dateEl = document.querySelector('.side1 .value');
    if (dateEl) {
      setDate = dateEl.textContent?.trim() || '';
    }
    // Try to find date in URL
    if (!setDate) {
      const urlMatch = location.href.match(/(\d{4}-\d{2}-\d{2})/);
      if (urlMatch) setDate = urlMatch[1];
    }
    
    // Get venue from title
    let venue = '';
    const venuePatterns = [
      /@\s*([^,\-–]+)/i,
      /(?:at|live at)\s+([^,\-–]+)/i,
    ];
    for (const pattern of venuePatterns) {
      const match = title.match(pattern);
      if (match) {
        venue = match[1].trim();
        break;
      }
    }
    
    // Extract tracks
    const tracks = [];
    
    // Method 1: Look for track items
    document.querySelectorAll('.tlpItem, .tlpTog').forEach((item) => {
      const artistEl = item.querySelector('.blueLinkColor, a[href*="/artist/"]');
      const trackEl = item.querySelector('.trackValue, span[itemprop="name"]');
      const timeEl = item.querySelector('.cueValueField');
      
      if (trackEl || artistEl) {
        const artist = artistEl?.textContent?.trim() || 'Unknown';
        const trackName = trackEl?.textContent?.trim() || 'Unknown';
        const timeStr = timeEl?.textContent?.trim() || '0:00';
        
        // Convert time to seconds
        const parts = timeStr.split(':').map(Number);
        let secs = 0;
        if (parts.length === 3) {
          secs = parts[0] * 3600 + parts[1] * 60 + parts[2];
        } else if (parts.length === 2) {
          secs = parts[0] * 60 + parts[1];
        }
        
        if (trackName !== 'Unknown' || artist !== 'Unknown') {
          tracks.push({ artist, trackName, secs, timeStr });
        }
      }
    });
    
    // Method 2: Try JSON-LD if no tracks found
    if (tracks.length === 0) {
      const jsonLdScript = document.querySelector('script[type="application/ld+json"]');
      if (jsonLdScript) {
        try {
          const jsonLd = JSON.parse(jsonLdScript.textContent);
          if (jsonLd.track && Array.isArray(jsonLd.track)) {
            jsonLd.track.forEach((t) => {
              if (t.name) {
                const parts = t.name.split(' - ');
                tracks.push({
                  artist: parts[0]?.trim() || 'Unknown',
                  trackName: parts.length > 1 ? parts.slice(1).join(' - ').trim() : t.name,
                  secs: 0,
                  timeStr: '0:00'
                });
              }
            });
          }
        } catch (e) {
          console.error('JSON-LD parse error:', e);
        }
      }
    }
    
    return {
      title,
      djName: djName || 'Unknown Artist',
      venue,
      setDate,
      url: location.href,
      tracks
    };
  } catch (e) {
    console.error('Extract error:', e);
    return null;
  }
}

function escapeCSV(value) {
  if (!value) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function generateCSV(data) {
  const header = 'type,set_name,set_artist,set_venue,set_date,set_cover_url,set_source_url,track_title,track_artist,timestamp_seconds,duration_seconds,bpm,key,album,track_cover_url,track_source_url';
  
  const rows = [header];
  
  // SET row
  rows.push([
    'SET',
    escapeCSV(data.title),
    escapeCSV(data.djName),
    escapeCSV(data.venue),
    escapeCSV(data.setDate),
    '', // cover_url
    escapeCSV(data.url),
    '', '', '', '', '', '', '', '', ''
  ].join(','));
  
  // TRACK rows
  data.tracks.forEach((track) => {
    rows.push([
      'TRACK',
      '', '', '', '', '', '',
      escapeCSV(track.trackName),
      escapeCSV(track.artist),
      track.secs.toString(),
      '', '', '', '', '', ''
    ].join(','));
  });
  
  return rows.join('\n');
}

function showNotification(message, isError = false) {
  const existing = document.getElementById('tl-exporter-notification');
  if (existing) existing.remove();
  
  const notification = document.createElement('div');
  notification.id = 'tl-exporter-notification';
  notification.className = isError ? 'tl-exporter-notification error' : 'tl-exporter-notification success';
  notification.textContent = message;
  document.body.appendChild(notification);
  
  setTimeout(() => notification.remove(), 3000);
}

function copyToClipboard() {
  const data = extractTracklist();
  
  if (!data || data.tracks.length === 0) {
    showNotification('No tracks found on this page!', true);
    return;
  }
  
  const csv = generateCSV(data);
  
  navigator.clipboard.writeText(csv).then(() => {
    showNotification(`Copied ${data.tracks.length} tracks to clipboard!`);
  }).catch((err) => {
    console.error('Clipboard error:', err);
    // Fallback: open in new window
    const w = window.open('', 'CSV Output', 'width=800,height=600');
    w.document.write(`<pre style="white-space: pre-wrap; word-break: break-all;">${csv}</pre>`);
    showNotification('CSV opened in new window (clipboard failed)');
  });
}

// Create floating button
function createExportButton() {
  const btn = document.createElement('button');
  btn.id = 'tl-exporter-btn';
  btn.innerHTML = '📋 Export CSV';
  btn.title = 'Export tracklist to CSV for DJ Set List Creator';
  btn.addEventListener('click', copyToClipboard);
  document.body.appendChild(btn);
}

// Initialize when page is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', createExportButton);
} else {
  createExportButton();
}
