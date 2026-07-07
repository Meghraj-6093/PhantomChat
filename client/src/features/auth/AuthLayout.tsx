import { Outlet } from "react-router-dom";
import { motion } from "framer-motion";
import { Ghost } from "lucide-react";

export default function AuthLayout() {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background bg-gradient-aurora px-4 py-10">
      {/* floating orbs */}
      <motion.div
        className="pointer-events-none absolute -left-32 top-1/4 h-96 w-96 rounded-full bg-primary/20 blur-3xl"
        animate={{ y: [0, 40, 0], x: [0, 20, 0] }}
        transition={{ repeat: Infinity, duration: 14, ease: "easeInOut" }}
      />
      <motion.div
        className="pointer-events-none absolute -right-32 bottom-1/4 h-96 w-96 rounded-full bg-accent/20 blur-3xl"
        animate={{ y: [0, -40, 0], x: [0, -20, 0] }}
        transition={{ repeat: Infinity, duration: 16, ease: "easeInOut" }}
      />

      <div className="relative z-10 w-full max-w-md">
        <motion.div
          className="mb-8 flex flex-col items-center gap-3"
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-brand shadow-glow">
            <Ghost className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-gradient">PhantomChat</h1>
          <p className="text-sm text-muted">Where conversations come alive 👻</p>
        </motion.div>

        <motion.div
          className="glass rounded-xl3 p-6 sm:p-8"
          initial={{ opacity: 0, y: 16, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ delay: 0.1 }}
        >
          <Outlet />
        </motion.div>
      </div>
    </div>
  );
}
