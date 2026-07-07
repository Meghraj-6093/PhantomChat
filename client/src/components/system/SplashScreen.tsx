import { motion } from "framer-motion";
import { Ghost } from "lucide-react";

export function SplashScreen() {
  return (
    <div className="flex h-screen flex-col items-center justify-center gap-6 bg-background bg-gradient-aurora">
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", damping: 15 }}
        className="flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-brand shadow-glow"
      >
        <motion.div
          animate={{ y: [0, -6, 0] }}
          transition={{ repeat: Infinity, duration: 1.8, ease: "easeInOut" }}
        >
          <Ghost className="h-10 w-10 text-white" />
        </motion.div>
      </motion.div>
      <div className="text-center">
        <h1 className="text-2xl font-bold tracking-tight text-gradient">PhantomChat</h1>
        <div className="mt-4 flex justify-center gap-1.5">
          {[0, 1, 2].map((i) => (
            <motion.span
              key={i}
              className="h-2 w-2 rounded-full bg-primary"
              animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1, 0.8] }}
              transition={{ repeat: Infinity, duration: 1.2, delay: i * 0.2 }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
