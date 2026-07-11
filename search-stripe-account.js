#!/usr/bin/env node

const admin = require('firebase-admin');

// Initialize Firebase Admin SDK using Application Default Credentials
// This works with Firebase CLI authentication
const projectId = 'vibyeventos';

try {
  admin.initializeApp({
    projectId: projectId,
  });
} catch (error) {
  if (error.code !== 'app/already-initialized') {
    console.error('Error initializing Firebase:', error.message);
    console.error('Make sure you are authenticated with: firebase login');
    process.exit(1);
  }
}

const db = admin.firestore();
const INCORRECT_ACCOUNT_ID = 'acct_1Tfmc9GcSoiXytGY';
const CORRECT_ACCOUNT_ID = 'acct_1Ts695KCF49ISh6x';

async function searchFirestore() {
  console.log(`\n🔍 Searching Firestore for incorrect Stripe account ID: ${INCORRECT_ACCOUNT_ID}\n`);
  console.log(`ℹ️  Correct ID should be: ${CORRECT_ACCOUNT_ID}\n`);
  
  const results = {
    found: [],
    collections: []
  };

  try {
    // Get all collections
    const collectionsSnapshot = await db.listCollections();
    
    if (collectionsSnapshot.length === 0) {
      console.log('❌ No collections found in Firestore');
      return;
    }

    console.log(`📊 Found ${collectionsSnapshot.length} collections. Searching...\n`);

    for (const collectionRef of collectionsSnapshot) {
      const collectionName = collectionRef.id;
      console.log(`📂 Checking collection: ${collectionName}`);
      
      const docsSnapshot = await collectionRef.get();
      
      if (docsSnapshot.empty) {
        console.log(`   └─ Empty collection\n`);
        continue;
      }

      let foundInCollection = false;

      for (const doc of docsSnapshot.docs) {
        const data = doc.data();
        const docString = JSON.stringify(data);
        
        if (docString.includes(INCORRECT_ACCOUNT_ID)) {
          foundInCollection = true;
          results.found.push({
            collection: collectionName,
            docId: doc.id,
            data: data
          });
          
          console.log(`   ✅ FOUND in document: ${doc.id}`);
        }
      }

      if (foundInCollection) {
        results.collections.push(collectionName);
      } else {
        console.log(`   └─ No matches\n`);
      }
    }

  } catch (error) {
    console.error('❌ Error querying Firestore:', error.message);
    process.exit(1);
  }

  // Print results summary
  console.log('\n' + '='.repeat(70));
  console.log('📋 SEARCH RESULTS');
  console.log('='.repeat(70) + '\n');

  if (results.found.length === 0) {
    console.log('✅ Good news! The incorrect Stripe account ID was NOT found in Firestore.\n');
  } else {
    console.log(`❌ WARNING: Found ${results.found.length} document(s) with the incorrect account ID!\n`);
    
    results.found.forEach((item, index) => {
      console.log(`\n${index + 1}. Collection: "${item.collection}" | Document ID: "${item.docId}"`);
      console.log('─'.repeat(70));
      console.log(JSON.stringify(item.data, null, 2));
    });
  }

  console.log('\n' + '='.repeat(70));
  console.log(`Total collections checked: ${results.collections.length + (collectionsSnapshot.length - results.collections.length)}`);
  console.log(`Collections with matches: ${results.collections.length}`);
  console.log('='.repeat(70) + '\n');

  await admin.app().delete();
  process.exit(results.found.length > 0 ? 1 : 0);
}

searchFirestore().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
