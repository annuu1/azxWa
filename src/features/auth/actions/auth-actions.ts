'use server';

import { db } from '@/shared/database';
import { users, organizations } from '@/shared/database/schema';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { createToken } from '../lib/auth-utils';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export async function login(formData: FormData) {
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;

  if (!email || !password) {
    return { error: 'Email and password are required' };
  }

  const [user] = await db.select().from(users).where(eq(users.email, email));

  if (!user || !(await bcrypt.compare(password, user.password))) {
    return { error: 'Invalid email or password' };
  }

  const token = await createToken({
    userId: user.id,
    organizationId: user.organizationId,
    role: user.role,
  });

  const cookieStore = await cookies();
  cookieStore.set('auth_token', token, {
    httpOnly: true,
    secure: false, // Ensures session cookie persists over HTTP in self-hosted deployments
    sameSite: 'lax',
    path: '/',     // Crucial: ensures auth_token is sent for all routes (/dashboard/crm, /dashboard/whatsapp, etc.)
    maxAge: 60 * 60 * 24 * 7, // 7 days
  });

  redirect('/dashboard');
}

export async function register(formData: FormData) {
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;
  const orgName = formData.get('orgName') as string;

  if (!email || !password || !orgName) {
    return { error: 'All fields are required' };
  }

  const hashedContext = await bcrypt.hash(password, 10);

  try {
    const result = await db.transaction(async (tx) => {
      const [newOrg] = await tx.insert(organizations).values({
        name: orgName,
      }).returning();

      const [newUser] = await tx.insert(users).values({
        email,
        password: hashedContext,
        organizationId: newOrg.id,
        role: 'ORG_ADMIN',
      }).returning();

      return { newUser, newOrg };
    });

    const token = await createToken({
      userId: result.newUser.id,
      organizationId: result.newOrg.id,
      role: result.newUser.role,
    });

    const cookieStore = await cookies();
    cookieStore.set('auth_token', token, {
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });

    redirect('/dashboard');
  } catch (error: any) {
    if (error.message?.includes('users_email_unique')) {
      return { error: 'Email already exists' };
    }
    return { error: 'Something went wrong' };
  }
}

export async function logout() {
  const cookieStore = await cookies();
  cookieStore.delete('auth_token');
  redirect('/login');
}
