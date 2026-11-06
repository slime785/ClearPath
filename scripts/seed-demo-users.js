const db = require("../firebase");
const { getAuth } = require("firebase-admin/auth");
const { FieldValue } = require("firebase-admin/firestore");

const auth = getAuth();

const demoUsers = [
  {
    email: "emma@test.com",
    username: "emma",
    passwordVariable: "DEMO_PARENT1_PASSWORD"
  },
  {
    email: "jacob@test.com",
    username: "jacob",
    passwordVariable: "DEMO_PARENT2_PASSWORD"
  },
  {
    email: "admin22@test.com",
    username: "admin22",
    passwordVariable: "DEMO_ADMIN_PASSWORD"
  }
];

async function findOrCreateAccount(demoUser) {
  try {
    // Keep the account and UID if it already exists.
    return await auth.getUserByEmail(demoUser.email);
  } catch (error) {
    if (error.code !== "auth/user-not-found") {
      throw error;
    }

    // Only needed when creating this account in a fresh Firebase project.
    const password = process.env[demoUser.passwordVariable];
    if (!password) {
      throw new Error(
        `Missing ${demoUser.passwordVariable}; needed to create ${demoUser.email}`
      );
    }

    return await auth.createUser({
      email: demoUser.email,
      password
    });
  }
}

async function seedDemoUsers() {
  for (const demoUser of demoUsers) {
    const user = await findOrCreateAccount(demoUser);
    const profileRef = db.collection("users").doc(user.uid);
    const existingProfile = await profileRef.get();

    const profile = { username: demoUser.username };

    // Set createdAt once; preserve it on later runs.
    if (!existingProfile.exists || !existingProfile.get("createdAt")) {
      profile.createdAt = FieldValue.serverTimestamp();
    }

    await profileRef.set(profile, { merge: true });
    console.log(`Set up profile for ${demoUser.username} (${user.uid})`);
  }
}

seedDemoUsers().catch((error) => {
  console.error("Demo setup failed:", error.message);
  process.exitCode = 1;
});