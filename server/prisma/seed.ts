import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const password = await bcrypt.hash("Password123!", 12);

  const admin = await prisma.user.upsert({
    where: { email: "admin@phantomchat.app" },
    update: {},
    create: {
      email: "admin@phantomchat.app",
      username: "phantom_admin",
      displayName: "Phantom Admin",
      passwordHash: password,
      role: "ADMIN",
      emailVerified: true,
      bio: "Keeper of the phantom realm.",
    },
  });

  const alice = await prisma.user.upsert({
    where: { email: "alice@phantomchat.app" },
    update: {},
    create: {
      email: "alice@phantomchat.app",
      username: "alice",
      displayName: "Alice Nguyen",
      passwordHash: password,
      emailVerified: true,
      bio: "Design systems + coffee ☕",
    },
  });

  const bob = await prisma.user.upsert({
    where: { email: "bob@phantomchat.app" },
    update: {},
    create: {
      email: "bob@phantomchat.app",
      username: "bob",
      displayName: "Bob Martinez",
      passwordHash: password,
      emailVerified: true,
      bio: "Backend goblin 🧌",
    },
  });

  await prisma.friendship.upsert({
    where: { requesterId_addresseeId: { requesterId: alice.id, addresseeId: bob.id } },
    update: { status: "ACCEPTED" },
    create: { requesterId: alice.id, addresseeId: bob.id, status: "ACCEPTED" },
  });

  const lounge = await prisma.chat.findFirst({ where: { name: "The Phantom Lounge" } });
  if (!lounge) {
    const chat = await prisma.chat.create({
      data: {
        type: "GROUP",
        name: "The Phantom Lounge",
        description: "The default hangout for every new phantom. Say hi! 👻",
        isPublic: true,
        ownerId: admin.id,
        members: {
          create: [
            { userId: admin.id, role: "OWNER" },
            { userId: alice.id, role: "MEMBER" },
            { userId: bob.id, role: "MEMBER" },
          ],
        },
      },
    });
    await prisma.message.createMany({
      data: [
        { chatId: chat.id, senderId: admin.id, content: "Welcome to **PhantomChat v6** 👻 — rebuilt from the ground up." },
        { chatId: chat.id, senderId: alice.id, content: "The new glass UI is gorgeous 😍" },
        { chatId: chat.id, senderId: bob.id, content: "Try `Ctrl+K` for the command palette!" },
      ],
    });
  }

  const announcements = await prisma.chat.findFirst({ where: { name: "announcements" } });
  if (!announcements) {
    await prisma.chat.create({
      data: {
        type: "CHANNEL",
        name: "announcements",
        description: "Official PhantomChat news. Read-only for members.",
        isPublic: true,
        ownerId: admin.id,
        members: { create: [{ userId: admin.id, role: "OWNER" }] },
      },
    });
  }

  console.log("✅ Seed complete. Users: phantom_admin / alice / bob — password: Password123!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
