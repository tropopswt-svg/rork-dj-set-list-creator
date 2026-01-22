import { Artist } from '@/types';

export const mockArtists: Artist[] = [
  {
    id: '1',
    name: 'Dixon',
    imageUrl: 'https://i1.sndcdn.com/avatars-000149102513-l3t2u4-t500x500.jpg',
    genres: ['House', 'Deep House', 'Techno'],
    setsCount: 45,
    followersCount: 234000,
  },
  {
    id: '2',
    name: 'Âme',
    imageUrl: 'https://i1.sndcdn.com/avatars-000234453723-p3t7hm-t500x500.jpg',
    genres: ['House', 'Deep House'],
    setsCount: 38,
    followersCount: 189000,
  },
  {
    id: '3',
    name: 'Hunee',
    imageUrl: 'https://i1.sndcdn.com/avatars-000595485498-5s3c0o-t500x500.jpg',
    genres: ['House', 'Disco', 'Eclectic'],
    setsCount: 52,
    followersCount: 156000,
  },
  {
    id: '4',
    name: 'Ben Böhmer',
    imageUrl: 'https://i1.sndcdn.com/avatars-000629486092-w8ckly-t500x500.jpg',
    genres: ['Melodic House', 'Progressive'],
    setsCount: 29,
    followersCount: 412000,
  },
  {
    id: '5',
    name: 'Chris Stussy',
    imageUrl: 'https://i1.sndcdn.com/avatars-000597139977-4pv4u3-t500x500.jpg',
    genres: ['House', 'Deep House'],
    setsCount: 31,
    followersCount: 78000,
  },
  {
    id: '6',
    name: 'Sama\' Abdulhadi',
    imageUrl: 'https://i1.sndcdn.com/avatars-000544159498-2ebsn3-t500x500.jpg',
    genres: ['Techno', 'Industrial'],
    setsCount: 24,
    followersCount: 198000,
  },
  {
    id: '7',
    name: 'deadmau5',
    imageUrl: 'https://i1.sndcdn.com/avatars-000028793003-z4bxxz-t500x500.jpg',
    genres: ['Progressive House', 'Electro'],
    setsCount: 67,
    followersCount: 890000,
  },
  {
    id: '8',
    name: 'Eric Prydz',
    imageUrl: 'https://i1.sndcdn.com/avatars-000147925498-8aoj5b-t500x500.jpg',
    genres: ['Progressive House', 'Techno'],
    setsCount: 58,
    followersCount: 720000,
  },
  {
    id: '9',
    name: 'Nina Kraviz',
    imageUrl: 'https://i1.sndcdn.com/avatars-000335919042-c8i3vm-t500x500.jpg',
    genres: ['Techno', 'Acid'],
    setsCount: 41,
    followersCount: 345000,
  },
  {
    id: '10',
    name: 'Solomun',
    imageUrl: 'https://i1.sndcdn.com/avatars-000187309942-8gak9k-t500x500.jpg',
    genres: ['House', 'Melodic Techno'],
    setsCount: 63,
    followersCount: 567000,
  },
  {
    id: '11',
    name: 'Charlotte de Witte',
    imageUrl: 'https://i1.sndcdn.com/avatars-000003875866-9tfo8r-t500x500.jpg',
    genres: ['Techno', 'Acid Techno'],
    setsCount: 47,
    followersCount: 623000,
  },
  {
    id: '12',
    name: 'Peggy Gou',
    imageUrl: 'https://i1.sndcdn.com/avatars-000336772399-82lf3w-t500x500.jpg',
    genres: ['House', 'Techno', 'Disco'],
    setsCount: 35,
    followersCount: 489000,
  },
  {
    id: '13',
    name: 'Tale Of Us',
    imageUrl: 'https://i1.sndcdn.com/avatars-yRPAjSgPbBr7tKDW-S5QKUQ-t500x500.jpg',
    genres: ['Melodic Techno', 'Progressive'],
    setsCount: 44,
    followersCount: 534000,
  },
  {
    id: '14',
    name: 'Amelie Lens',
    imageUrl: 'https://i1.sndcdn.com/avatars-000062904581-w9lucq-t500x500.jpg',
    genres: ['Techno', 'Hard Techno'],
    setsCount: 39,
    followersCount: 478000,
  },
  {
    id: '15',
    name: 'Bicep',
    imageUrl: 'https://i1.sndcdn.com/avatars-000025476408-xiwwqe-t500x500.jpg',
    genres: ['House', 'Breakbeat', 'Electronica'],
    setsCount: 28,
    followersCount: 312000,
  },
  {
    id: '16',
    name: 'Black Coffee',
    imageUrl: 'https://i1.sndcdn.com/avatars-000030211073-6x2535-t500x500.jpg',
    genres: ['Afro House', 'Deep House'],
    setsCount: 56,
    followersCount: 445000,
  },
  {
    id: '17',
    name: 'Adriatique',
    imageUrl: 'https://i1.sndcdn.com/avatars-000001952498-tzdkvy-t500x500.jpg',
    genres: ['Melodic House', 'Techno'],
    setsCount: 33,
    followersCount: 267000,
  },
  {
    id: '18',
    name: 'Maceo Plex',
    imageUrl: 'https://i1.sndcdn.com/avatars-000230295498-yq8hxr-t500x500.jpg',
    genres: ['Techno', 'House'],
    setsCount: 51,
    followersCount: 398000,
  },
  {
    id: '19',
    name: 'Keinemusik',
    imageUrl: 'https://i1.sndcdn.com/avatars-000054093498-9t0c5v-t500x500.jpg',
    genres: ['House', 'Deep House'],
    setsCount: 42,
    followersCount: 523000,
  },
  {
    id: '20',
    name: 'Adam Beyer',
    imageUrl: 'https://i1.sndcdn.com/avatars-000000000000-000000-t500x500.jpg',
    genres: ['Techno'],
    setsCount: 72,
    followersCount: 456000,
  },
];

export function searchArtists(query: string): Artist[] {
  if (!query.trim()) return mockArtists.slice(0, 6);
  
  const normalizedQuery = query.toLowerCase().trim();
  return mockArtists
    .filter(artist => artist.name.toLowerCase().includes(normalizedQuery))
    .slice(0, 10);
}

export function findArtistByName(name: string): Artist | undefined {
  const normalizedName = name.toLowerCase().trim();
  return mockArtists.find(artist => 
    artist.name.toLowerCase() === normalizedName ||
    artist.name.toLowerCase().includes(normalizedName)
  );
}

export function getOrCreateArtist(name: string): Artist {
  const existing = findArtistByName(name);
  if (existing) return existing;
  
  return {
    id: `new-${Date.now()}`,
    name: name.trim(),
    genres: [],
    setsCount: 0,
    followersCount: 0,
  };
}
