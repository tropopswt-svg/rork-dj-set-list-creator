/**
 * Test the backend scraper function directly
 */

// Import the scraper function from the backend
import { fetch1001TracklistWithMetadata } from '../backend/trpc/routes/scraper';

const url = "https://www.1001tracklists.com/tracklist/26b26jut/max-dean-luke-dean-wyld-lab11-birmingham-united-kingdom-2023-09-09.html";

async function main() {
  console.error(`Testing backend scraper with: ${url}\n`);
  
  try {
    const result = await fetch1001TracklistWithMetadata(url);
    
    console.error(`✅ Scraped successfully!\n`);
    console.error(`📀 Set: "${result.title || 'Unknown'}"`);
    console.error(`🎤 Artist: ${result.artist || 'Unknown'}`);
    if (result.venue) console.error(`📍 Venue: ${result.venue}`);
    if (result.date) console.error(`📅 Date: ${result.date}`);
    console.error(`🎵 Tracks: ${result.tracks.length}\n`);
    
    if (result.tracks.length > 0) {
      console.error('Tracklist:');
      console.error('─'.repeat(70));
      result.tracks.forEach((track, index) => {
        console.error(`${String(index + 1).padStart(3, ' ')}. [${track.timestamp.padEnd(8, ' ')}] ${track.artist} - ${track.title}`);
      });
      console.error('─'.repeat(70));
      
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.error('❌ No tracks extracted');
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

main();
