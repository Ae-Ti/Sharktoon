"use client";

import { motion, AnimatePresence } from "framer-motion";
import { AlertCircle, CheckCircle, Info } from "lucide-react";

export interface ToastProps {
  message: string | null;
  tone?: "info" | "warning" | "success" | "danger";
}

export function Toast({ message, tone = "warning" }: ToastProps) {
  return (
    <AnimatePresence>
      {message && (
        <motion.div
          initial={{ opacity: 0, y: 16, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 16, scale: 0.95 }}
          transition={{ duration: 0.2 }}
          className="fixed bottom-20 sm:bottom-8 left-1/2 -translate-x-1/2 z-50 max-w-[92vw] pointer-events-none select-none"
        >
          <div className="flex items-center gap-2 rounded-full bg-ink/95 px-4 py-2.5 text-xs sm:text-sm font-semibold text-white shadow-xl backdrop-blur-md border border-white/10">
            {tone === "warning" && <AlertCircle className="size-4 text-warning shrink-0" />}
            {tone === "danger" && <AlertCircle className="size-4 text-danger shrink-0" />}
            {tone === "success" && <CheckCircle className="size-4 text-success shrink-0" />}
            {tone === "info" && <Info className="size-4 text-brand shrink-0" />}
            <span className="whitespace-nowrap">{message}</span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
