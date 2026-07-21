import { motion } from "motion/react";

export function FieldRow({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      className="space-y-2"
      variants={{
        hidden: { opacity: 0, y: 8 },
        visible: { opacity: 1, y: 0, transition: { duration: 0.25, ease: "easeOut" } },
      }}
    >
      {children}
    </motion.div>
  );
}
