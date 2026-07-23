"use strict";

// Usage: node scripts/create-user.js <username> <password> <displayName>
// Run with NODE_ENV unset (production .env) only at rollout, deliberately.

const bcrypt = require("bcrypt");
const db = require("../src/models");

const main = async () => {
  const [username, password, displayName] = process.argv.slice(2);
  if (!username || !password || !displayName) {
    console.error("Usage: node scripts/create-user.js <username> <password> <displayName>");
    process.exit(1);
  }
  if (password.length < 8) {
    console.error("Password must be at least 8 characters.");
    process.exit(1);
  }

  const password_hash = await bcrypt.hash(password, 10);
  const [user, created] = await db.User.findOrCreate({
    where: { username },
    defaults: { username, password_hash, display_name: displayName },
  });
  if (!created) {
    await user.update({ password_hash, display_name: displayName });
    console.log(`Updated existing user ${username}`);
  } else {
    console.log(`Created user ${username} (${user.id})`);
  }
  await db.sequelize.close();
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
