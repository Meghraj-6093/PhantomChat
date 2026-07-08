-- End-to-end encryption support.

-- User keys: public key peers encrypt to, and the passphrase-wrapped private
-- key backup (opaque to the server).
ALTER TABLE "User" ADD COLUMN "publicKey" TEXT;
ALTER TABLE "User" ADD COLUMN "encryptedPrivateKey" TEXT;

-- Messages: flag rows whose `content` holds an encrypted envelope.
ALTER TABLE "Message" ADD COLUMN "isEncrypted" BOOLEAN NOT NULL DEFAULT false;
