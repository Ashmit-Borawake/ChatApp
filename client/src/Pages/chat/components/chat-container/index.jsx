import { useEffect } from "react";
import { motion } from "framer-motion";
import MessageBar from "./components/message-bar/index.jsx";
import ChatHeader from "./components/chat-header/index.jsx";
import MessageContainer from "./components/message-container/index.jsx";
import { useAppStore } from "@/store";

const ChatContainer = () => {
  const { isDarkMode, setIsDarkMode } = useAppStore();

  // Init dark mode from localStorage on mount
  useEffect(() => {
    const storedDarkMode = localStorage.getItem('darkMode');
    if (storedDarkMode !== null) {
      setIsDarkMode(storedDarkMode === 'true');
    }
  }, [setIsDarkMode]);

  // Theme class management
  useEffect(() => {
    // Apply or remove dark mode class on body
    if (isDarkMode) {
      document.body.classList.add('dark');
    } else {
      document.body.classList.remove('dark');
    }
  }, [isDarkMode]);

  return (
    <motion.div 
      className="fixed top-0 h-[100vh] w-[100vw] bg-slate-50 dark:bg-slate-900 flex flex-col md:static md:flex-1 shadow-lg rounded-lg overflow-hidden"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
    >
      <ChatHeader />
      <MessageContainer />
      <MessageBar />
    </motion.div>
  );
};

export default ChatContainer;
