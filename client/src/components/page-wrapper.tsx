import { motion } from "framer-motion";
import { Navbar } from "./navbar";
import { ReactNode } from "react";

interface PageWrapperProps {
  children: ReactNode;
  className?: string;
}

export function PageWrapper({ children, className = "" }: PageWrapperProps) {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />
      <motion.main
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className={`flex-1 container mx-auto px-4 py-8 md:py-12 ${className}`}
      >
        {children}
      </motion.main>
      
      <footer className="py-8 border-t text-center text-sm text-muted-foreground bg-secondary/30">
        <p>© 2024 IdeaBox. Built for the community.</p>
      </footer>
    </div>
  );
}
