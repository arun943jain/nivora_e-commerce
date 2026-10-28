import {
  connectDatabase,
  disconnectDatabase,
  isDatabaseConfigured,
} from "../config/db.js";
import { User } from "../models/index.js";
import { EMAIL_PATTERN, normalizeEmail } from "../utils/validators.js";

// Manual, server-side only promotion. There is intentionally no API endpoint
// that can grant the admin role.
const email = normalizeEmail(process.argv[2]);

if (!email || !EMAIL_PATTERN.test(email)) {
  console.error(
    "Usage: npm run promote-admin -- <email-of-an-existing-account>",
  );
  process.exit(1);
}

if (!isDatabaseConfigured()) {
  console.error(
    "[promote-admin] MONGODB_URI is not configured. Add it to server/.env first.",
  );
  process.exit(1);
}

const main = async () => {
  const connection = await connectDatabase();

  if (!connection.connected) {
    throw new Error("MongoDB is not connected; promotion aborted.");
  }

  const user = await User.findOne({ email });

  if (!user) {
    throw new Error(
      "No registered account uses that email. Register the account first, then run this command again.",
    );
  }

  if (user.role === "admin") {
    console.log(`[promote-admin] ${user.email} is already an administrator.`);
    return;
  }

  user.role = "admin";
  await user.save();
  console.log(`[promote-admin] Promoted ${user.email} to administrator.`);
};

main()
  .catch((error) => {
    console.error(`[promote-admin] ${error.message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectDatabase();
  });
