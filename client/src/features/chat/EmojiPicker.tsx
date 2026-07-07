import { useState } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

const CATEGORIES: Array<{ name: string; icon: string; emojis: string[] }> = [
  {
    name: "Smileys",
    icon: "😀",
    emojis: ["😀","😃","😄","😁","😆","😅","😂","🤣","😊","😇","🙂","😉","😍","🥰","😘","😗","😋","😛","🤪","🤨","🧐","🤓","😎","🥳","😏","😒","😞","😔","😟","😕","🙁","☹️","😣","😖","😫","😩","🥺","😢","😭","😤","😠","😡","🤬","🤯","😳","🥵","🥶","😱","😨","😰","😥","😓","🤗","🤔","🤭","🤫","🤥","😶","😐","😑","😬","🙄","😯","😴","🤤","😪","😮","😲","🥱","😵","🤐","🥴","🤢","🤮","🤧","😷","🤒","🤕","🤑","🤠"],
  },
  {
    name: "Gestures",
    icon: "👍",
    emojis: ["👍","👎","👌","🤌","✌️","🤞","🤟","🤘","🤙","👈","👉","👆","👇","☝️","👋","🤚","🖐️","✋","🖖","👏","🙌","🤲","🤝","🙏","✍️","💪","🦾","🖕","💅"],
  },
  {
    name: "Hearts",
    icon: "❤️",
    emojis: ["❤️","🧡","💛","💚","💙","💜","🖤","🤍","🤎","💔","❣️","💕","💞","💓","💗","💖","💘","💝","💟","♥️","💯","💢","💥","💫","💦","💨"],
  },
  {
    name: "Animals",
    icon: "🐱",
    emojis: ["🐶","🐱","🐭","🐹","🐰","🦊","🐻","🐼","🐨","🐯","🦁","🐮","🐷","🐸","🐵","🐔","🐧","🐦","🐤","🦆","🦅","🦉","🦇","🐺","🐗","🐴","🦄","🐝","🐛","🦋","🐌","🐞","🐜","🪰","🐢","🐍","🦎","🦂","🦀","🐙","🦑","🐠","🐟","🐬","🐳","🦈","👻","👽","🤖","💀","🎃"],
  },
  {
    name: "Food",
    icon: "🍕",
    emojis: ["🍏","🍎","🍐","🍊","🍋","🍌","🍉","🍇","🍓","🫐","🍈","🍒","🍑","🥭","🍍","🥥","🥝","🍅","🥑","🌮","🌯","🍕","🍔","🍟","🌭","🥪","🍗","🍖","🍜","🍝","🍣","🍱","🥟","🍤","🍙","🍚","🍘","🍥","🍡","🍧","🍨","🍦","🥧","🧁","🍰","🎂","🍮","🍭","🍬","🍫","🍿","🍩","🍪","☕","🍵","🧋","🥤","🍺","🍻","🥂","🍷"],
  },
  {
    name: "Activity",
    icon: "⚽",
    emojis: ["⚽","🏀","🏈","⚾","🥎","🎾","🏐","🏉","🥏","🎱","🪀","🏓","🏸","🏒","🥍","🏏","🥅","⛳","🪁","🏹","🎣","🎽","🎮","🎲","🎯","🎳","🎪","🎭","🎨","🎬","🎤","🎧","🎼","🎹","🥁","🎷","🎺","🎸","🪕","🎻","♟️","🚀","✈️","🚗","🏆","🥇","🥈","🥉","🏅","🎖️","🎗️","🎫","🎟️"],
  },
];

export function EmojiPicker({ onPick }: { onPick: (emoji: string) => void }) {
  const [category, setCategory] = useState(0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      className="glass-strong w-72 rounded-2xl p-2"
    >
      <div className="mb-1 flex gap-0.5 border-b border-line pb-1.5">
        {CATEGORIES.map((c, i) => (
          <button
            key={c.name}
            onClick={() => setCategory(i)}
            title={c.name}
            className={cn(
              "flex-1 rounded-lg py-1 text-sm transition",
              i === category ? "bg-primary/20" : "opacity-50 hover:opacity-100"
            )}
          >
            {c.icon}
          </button>
        ))}
      </div>
      <div className="grid max-h-52 grid-cols-8 gap-0.5 overflow-y-auto">
        {CATEGORIES[category]!.emojis.map((e) => (
          <button
            key={e}
            onClick={() => onPick(e)}
            className="rounded-lg p-1 text-lg transition hover:scale-125 hover:bg-slate-700/30"
          >
            {e}
          </button>
        ))}
      </div>
    </motion.div>
  );
}
