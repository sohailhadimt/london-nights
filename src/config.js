export const TITLE = 'London Nights';

export const SPAWN = { x: -4, z: -66 }; // Mid-span of London Bridge, looking south toward The Shard

export const LANDMARKS = {
  shard: { x: 89, z: 332, h: 310, name: 'The Shard' },
  gherkin: { x: 511, z: -782, h: 180, name: 'The Gherkin' },
  towerBridgeN: { x: 871, z: 172 },
  towerBridgeS: { x: 839, z: 245 },
};

export const HEIGHT_OVERRIDES = {
  'The Shard': 310,
  '30 St Mary Axe': 180,
  '22 Bishopsgate Tower': 278,
  'Heron Tower': 230,
  'The Leadenhall Building': 225,
  'Tower 42': 183,
  'Sky Garden': 160,
  'Willis Towers Watson': 125,
  'Shard Place': 96,
};

export const DRIVEABLE = new Set([
  'motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'unclassified',
  'residential', 'living_street', 'service', 'motorway_link', 'trunk_link',
  'primary_link', 'secondary_link', 'tertiary_link', 'road',
]);

export const BUS_ROUTE_NAMES = [
  'Borough High Street',
  'London Bridge',
  'King William Street',
  'Gracechurch Street',
  'Leadenhall Street',
];

export const TUBE_STATIONS = [
  'London Bridge', 'Borough', 'Monument', 'Bank', 'Cannon Street',
  'Mansion House', "St. Paul's", 'Liverpool Street', 'Aldgate', 'Tower Hill',
];

export const CAR_COLORS = [
  '#1a1a1a', '#f4f4f4', '#b10b0b', '#0b3d91', '#d4af37',
  '#0f6b4c', '#ff6a00', '#8b8b8b', '#5b2c6f', '#c0c0c0',
];

export const SKIN_TONES = [
  '#f3d1b8', '#e0b894', '#c58c5c', '#a0663c', '#6e3b1f', '#3b2216',
];

export const HAIR_COLORS = [
  '#1a120c', '#3b2a1a', '#6b3f1f', '#c4a35a', '#d8d2c8', '#2a1a14', '#8b1e1e',
];

export const PERFORMANCE = {
  pedCount: { mobile: 28, desktop: 64 },
  trafficCount: { mobile: 14, desktop: 28 },
  pixelRatio: { mobile: 1.25, desktop: 1.75 },
  shadow: { mobile: 1024, desktop: 2048 },
  fogNear: 260,
  fogFar: 720,
};

export function isMobile() {
  return window.matchMedia('(pointer: coarse)').matches ||
    /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
}
