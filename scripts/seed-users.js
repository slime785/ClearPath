const db = require('../firebase');
const { getAuth } = require('firebase-admin/auth');

const auth = getAuth();

const accounts = [
  { email: 'parent1@test.com', username: 'parent1' },
  { email: 'parent2@test.com', username: 'parent2' },
  { email: 'admin@test.com', username: 'admin' }
];

async function main() {
  for (const account of accounts) {
    // Find this account in Firebase Authentication.
    const authUser = await auth.getUserByEmail(account.email);

    // Create or update its Firestore profile using the account's UID.
    await db.collection('users').doc(authUser.uid).set(
      { username: account.username },
      { merge: true }
    );

    console.log(`Set up profile for ${account.username}`);
  }
}

main().catch(error => {
  console.error('Profile setup failed:', error.message);
  process.exitCode = 1;
});