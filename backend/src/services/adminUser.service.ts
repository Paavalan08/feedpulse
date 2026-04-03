import bcrypt from 'bcryptjs';
import User from '../models/User';

export const ensureDefaultAdminUser = async (): Promise<void> => {
  const defaultAdminName = process.env.ADMIN_NAME || 'FeedPulse Admin';
  const defaultAdminEmail = (process.env.ADMIN_EMAIL || 'admin@feedpulse.com').trim().toLowerCase();
  const defaultAdminPassword = process.env.ADMIN_PASSWORD || 'password123';

  const existingAdmin = await User.findOne({ email: defaultAdminEmail }).select('_id');

  if (existingAdmin) {
    return;
  }

  const passwordHash = await bcrypt.hash(defaultAdminPassword, 10);

  await User.create({
    name: defaultAdminName,
    email: defaultAdminEmail,
    passwordHash,
    role: 'admin',
  });

  console.log(`[Auth] Seeded default admin user: ${defaultAdminEmail}`);
};