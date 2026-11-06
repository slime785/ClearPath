const db = require('../firebase');
const { getAuth } = require('firebase-admin/auth');

const auth = getAuth();

const accounts = [
  { email: 'parent1@test.com', role: 'parent', caseId: 'case1' },
  { email: 'parent2@test.com', role: 'parent', caseId: 'case1' },
  { email: 'parent3@test.com', role: 'parent', caseId: 'case2' },
  { email: 'parent4@test.com', role: 'parent', caseId: 'case2' },
  { email: 'admin@test.com', role: 'admin', caseId: null }
];

async function main() {
  for (const account of accounts) {
    const authUser = await auth.getUserByEmail(account.email);

    await db.collection('users').doc(authUser.uid).set(
      {
        email: account.email,
        role: account.role,
        caseId: account.caseId
      },
      { merge: true }
    );

    console.log(`Set up ${account.email} as ${account.role}, ${account.caseId}`);
  }
}

main().catch(error => {
  console.error('Case setup failed:', error.message);
  process.exitCode = 1;
});