/**
 * Seed script untuk Firestore emulator — TMEP (The Mother Earth Protocol)
 *
 * Cara pakai:
 *   1. Pastikan Firebase emulator jalan: firebase emulators:start
 *   2. Jalankan: npm run seed
 *
 * Script ini aman dijalankan berulang kali — dokumen yang sudah ada
 * akan dilewati (menggunakan create(), bukan set()).
 */

// Set emulator host SEBELUM import firebase-admin
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

initializeApp({ projectId: 'migration-earth-project' });

const db  = getFirestore();
const auth = getAuth();

// ─── Data seed ────────────────────────────────────────────────────────────────

const USERS = [
  {
    uid:         'seed-user-1',
    email:       'eco.warrior@test.com',
    password:    'test123456',
    displayName: 'Eco Warrior',
    photoURL:    'https://picsum.photos/seed/eco/100/100',
    totalLikes:  340,
    soldNfts:    32,
    buybackCount: 18,
    isTopDeveloper: true,
  },
  {
    uid:         'seed-user-2',
    email:       'green.thumb@test.com',
    password:    'test123456',
    displayName: 'Green Thumb',
    photoURL:    'https://picsum.photos/seed/green/100/100',
    totalLikes:  155,
    soldNfts:    12,
    buybackCount: 4,
    isTopDeveloper: false,
  },
  {
    uid:         'seed-user-3',
    email:       'ocean.guardian@test.com',
    password:    'test123456',
    displayName: 'Ocean Guardian',
    photoURL:    'https://picsum.photos/seed/ocean/100/100',
    totalLikes:  256,
    soldNfts:    21,
    buybackCount: 11,
    isTopDeveloper: false,
  },
];

// Kategori sesuai CLAUDE.md: 'tree_planting' | 'ocean_cleanup' | 'wildlife_protection'
const NFTS = [
  {
    id:            'seed-nft-1',
    title:         'Amazonas Rebirth',
    description:   'NFT ini mendanai penanaman 100 pohon di Amazon Brasil, membantu memulihkan ekosistem vital.',
    imageUrl:      'https://images.unsplash.com/photo-1672207130896-0b4bc0083d3e?w=600&q=80',
    impact:        '100 pohon ditanam',
    category:      'tree_planting',
    likes:         128,
    createdBy:     'seed-user-1',
    owner:         'seed-user-2',
    forSale:       false,
    price:         1.5,
    isValid:       true,
    isRecommended: true,  // 1 dari 3 slot rekomendasi — vendor: user-1
    createdAt:     Timestamp.fromDate(new Date('2024-10-01')),
  },
  {
    id:            'seed-nft-2',
    title:         'Pacific Gyre Cleanup',
    description:   'Berkontribusi pada pengangkatan 50kg plastik dari Great Pacific Garbage Patch.',
    imageUrl:      'https://images.unsplash.com/photo-1465634836201-1d5651b9b6d6?w=600&q=80',
    impact:        '50kg plastik diangkat',
    category:      'ocean_cleanup',
    likes:         256,
    createdBy:     'seed-user-3',
    owner:         'seed-user-3',
    forSale:       true,
    price:         2.2,
    isValid:       true,
    isRecommended: true,  // 2 dari 3 slot rekomendasi — vendor: user-3
    createdAt:     Timestamp.fromDate(new Date('2024-11-15')),
  },
  {
    id:            'seed-nft-3',
    title:         'Savanna Elephant Adoption',
    description:   'Adopsi simbolis dan dukung perlindungan seekor gajah savana Afrika selama satu tahun.',
    imageUrl:      'https://images.unsplash.com/photo-1654066739382-571760af8b43?w=600&q=80',
    impact:        '1 gajah dilindungi',
    category:      'wildlife_protection',
    likes:         95,
    createdBy:     'seed-user-2',
    owner:         'seed-user-1',
    forSale:       false,
    price:         3.0,
    isValid:       true,
    isRecommended: false,
    createdAt:     Timestamp.fromDate(new Date('2024-12-05')),
  },
  {
    id:            'seed-nft-4',
    title:         'Coral Reef Restoration',
    description:   'Mendanai penanaman satu koloni karang baru di Great Barrier Reef.',
    imageUrl:      'https://images.unsplash.com/photo-1515555585025-54136276b6e3?w=600&q=80',
    impact:        '1 koloni karang ditanam',
    category:      'ocean_cleanup',
    likes:         180,
    createdBy:     'seed-user-3',
    owner:         'seed-user-1',
    forSale:       true,
    price:         1.8,
    isValid:       true,
    isRecommended: false,  // user-3 sudah punya nft-2 di slot rekomendasi
    createdAt:     Timestamp.fromDate(new Date('2025-01-20')),
  },
  {
    id:            'seed-nft-5',
    title:         'Siberian Tiger Sanctuary',
    description:   'Mendukung operasional sanctuary untuk harimau Siberia yang terancam punah.',
    imageUrl:      'https://images.unsplash.com/photo-1524132989408-c8ee48d8f147?w=600&q=80',
    impact:        'Dukungan sanctuary',
    category:      'wildlife_protection',
    likes:         42,
    createdBy:     'seed-user-2',
    owner:         'seed-user-2',
    forSale:       false,
    price:         4.5,
    isValid:       false, // Belum divalidasi — masuk antrian validation
    isRecommended: false,
    createdAt:     Timestamp.fromDate(new Date('2025-02-10')),
  },
  {
    id:            'seed-nft-6',
    title:         'Andean Cloud Forest',
    description:   'Melindungi 1 hektar habitat cloud forest unik di pegunungan Andes.',
    imageUrl:      'https://images.unsplash.com/photo-1568399032147-1011aa65f85a?w=600&q=80',
    impact:        '1 hektar dilindungi',
    category:      'tree_planting',
    likes:         78,
    createdBy:     'seed-user-1',
    owner:         'seed-user-3',
    forSale:       false,
    price:         2.5,
    isValid:       true,
    isRecommended: false,
    createdAt:     Timestamp.fromDate(new Date('2025-03-01')),
  },
  {
    id:            'seed-nft-7',
    title:         'Rhino Protection Unit',
    description:   'Mendanai unit ranger anti-perburuan selama satu bulan, melindungi badak hitam.',
    imageUrl:      'https://images.unsplash.com/photo-1535338134198-e28df7d54e3d?w=600&q=80',
    impact:        '1 unit ranger didanai',
    category:      'wildlife_protection',
    likes:         340,
    createdBy:     'seed-user-2',
    owner:         null,
    forSale:       true,
    price:         5.0,
    isValid:       true,
    isRecommended: true,  // 3 dari 3 slot rekomendasi — vendor: user-2
    createdAt:     Timestamp.fromDate(new Date('2025-03-15')),
  },
];

// ─── Helper ───────────────────────────────────────────────────────────────────

async function upsertUser(user: typeof USERS[0]) {
  // Buat Auth account di emulator
  try {
    await auth.createUser({
      uid:         user.uid,
      email:       user.email,
      password:    user.password,
      displayName: user.displayName,
      photoURL:    user.photoURL,
    });
    console.log(`  [Auth] Created: ${user.email}`);
  } catch (err: any) {
    if (err.code === 'auth/uid-already-exists' || err.code === 'auth/email-already-exists') {
      console.log(`  [Auth] Already exists: ${user.email}`);
    } else {
      throw err;
    }
  }

  // Buat Firestore document
  const ref = db.collection('users').doc(user.uid);
  const snap = await ref.get();
  if (!snap.exists) {
    await ref.set({
      uid:            user.uid,
      email:          user.email,
      displayName:    user.displayName,
      photoURL:       user.photoURL,
      totalLikes:     user.totalLikes,
      soldNfts:       user.soldNfts,
      buybackCount:   user.buybackCount,
      isTopDeveloper: user.isTopDeveloper,
      createdAt:      Timestamp.now(),
    });
    console.log(`  [Firestore] Created user: ${user.displayName}`);
  } else {
    console.log(`  [Firestore] Skipped user (exists): ${user.displayName}`);
  }
}

async function upsertNft(nft: typeof NFTS[0]) {
  const ref = db.collection('nfts').doc(nft.id);
  const snap = await ref.get();
  if (!snap.exists) {
    await ref.set({
      title:         nft.title,
      description:   nft.description,
      imageUrl:      nft.imageUrl,
      impact:        nft.impact,
      category:      nft.category,
      likes:         nft.likes,
      createdBy:     nft.createdBy,
      owner:         nft.owner,
      forSale:       nft.forSale,
      price:         nft.price,
      isValid:       nft.isValid,
      isRecommended: nft.isRecommended,
      createdAt:     nft.createdAt,
    });
    console.log(`  [Firestore] Created NFT: ${nft.title}`);
  } else {
    console.log(`  [Firestore] Skipped NFT (exists): ${nft.title}`);
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n🌱 TMEP — Firestore Seed Script');
  console.log('================================');
  console.log(`📡 Firestore: ${process.env.FIRESTORE_EMULATOR_HOST}`);
  console.log(`🔐 Auth:      ${process.env.FIREBASE_AUTH_EMULATOR_HOST}\n`);

  console.log('👤 Seeding users...');
  for (const user of USERS) {
    await upsertUser(user);
  }

  console.log('\n🖼️  Seeding NFTs...');
  for (const nft of NFTS) {
    await upsertNft(nft);
  }

  console.log('\n✅ Seed selesai!');
  console.log('   Users: 3 (eco.warrior, green.thumb, ocean.guardian)');
  console.log('   NFTs:  7 (3 recommended, 1 invalid, 4 for-sale)');
  console.log('   Password semua test user: test123456\n');
}

main().catch((err) => {
  console.error('❌ Seed gagal:', err);
  process.exit(1);
});
