import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Ghost, Home } from "lucide-react";

export default function NotFoundPage() {
  return (
    <div className="flex h-screen flex-col items-center justify-center gap-6 bg-background bg-gradient-aurora px-6 text-center">
      <motion.div
        animate={{ y: [0, -12, 0], rotate: [0, -4, 4, 0] }}
        transition={{ repeat: Infinity, duration: 3.5, ease: "easeInOut" }}
        className="flex h-24 w-24 items-center justify-center rounded-3xl bg-gradient-brand shadow-glow"
      >
        <Ghost className="h-12 w-12 text-white" />
      </motion.div>
      <div>
        <h1 className="text-6xl font-extrabold text-gradient">404</h1>
        <h2 className="mt-2 text-xl font-bold">This page ghosted you</h2>
        <p className="mx-auto mt-2 max-w-sm text-sm text-muted">
          The page you're looking for doesn't exist, moved on, or was never here at all. Spooky.
        </p>
      </div>
      <Link
        to="/"
        className="flex items-center gap-2 rounded-xl bg-gradient-brand px-6 py-3 text-sm font-medium text-white shadow-glow transition hover:opacity-95"
      >
        <Home className="h-4 w-4" /> Back to your chats
      </Link>
    </div>
  );
}
