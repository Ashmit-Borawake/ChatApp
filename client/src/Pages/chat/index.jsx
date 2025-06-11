import { useAppStore } from "@/store";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import ContactsContainer from "./components/contacts-container";
import EmptyChatContainer from "./components/empty-chat-container";
import ChatContainer from "./components/chat-container";
import { motion, AnimatePresence } from "framer-motion";

function Chat() {
  const {
    userInfo,
    selectedChatType,
    isUploading,
    isDownloading,
    fileUploadProgress,
    fileDownloadProgress,
    isDarkMode,
    setIsDarkMode
  } = useAppStore();
  const navigate = useNavigate();
  
  // Initialize dark mode from localStorage on mount
  useEffect(() => {
    const storedDarkMode = localStorage.getItem('darkMode');
    if (storedDarkMode !== null) {
      setIsDarkMode(storedDarkMode === 'true');
    }
  }, [setIsDarkMode]);
  
  useEffect(() => {
    if (!userInfo.profileSetup) {
      toast("Please setup profile to continue.");
      navigate("/profile");
    }
  }, [userInfo, navigate]);

  // Upload/download loading screen animations
  const progressVariants = {
    hidden: { opacity: 0, scale: 0.8 },
    visible: { opacity: 1, scale: 1, transition: { duration: 0.3 } }
  };

  return (
    <div className={`flex h-[100vh] overflow-hidden text-gray-800 dark:text-gray-100 bg-white dark:bg-slate-900 ${isDarkMode ? "dark" : ""}`}>
      <AnimatePresence>
        {isUploading && (
          <motion.div 
            className="h-[100vh] w-[100vw] fixed top-0 z-50 left-0 bg-white/90 dark:bg-slate-900/90 flex items-center justify-center flex-col gap-5 backdrop-blur-md"
            initial="hidden"
            animate="visible"
            exit="hidden"
            variants={progressVariants}
          >
            <motion.div 
              className="text-3xl font-medium text-indigo-600 dark:text-indigo-400"
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            >
              Uploading File
            </motion.div>
            
            <div className="w-64 h-3 bg-gray-200 dark:bg-slate-700 rounded-full overflow-hidden">
              <motion.div 
                className="h-full bg-indigo-500 rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${fileUploadProgress}%` }}
                transition={{ duration: 0.2 }}
              />
            </div>
            <div className="text-gray-500 dark:text-gray-400 mt-2">{fileUploadProgress}%</div>
          </motion.div>
        )}
        
        {isDownloading && (
          <motion.div 
            className="h-[100vh] w-[100vw] fixed top-0 z-50 left-0 bg-white/90 dark:bg-slate-900/90 flex items-center justify-center flex-col gap-5 backdrop-blur-md"
            initial="hidden"
            animate="visible"
            exit="hidden"
            variants={progressVariants}
          >
            <motion.div 
              className="text-3xl font-medium text-indigo-600 dark:text-indigo-400"
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            >
              Downloading File
            </motion.div>
            
            <div className="w-64 h-3 bg-gray-200 dark:bg-slate-700 rounded-full overflow-hidden">
              <motion.div 
                className="h-full bg-indigo-500 rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${fileDownloadProgress}%` }}
                transition={{ duration: 0.2 }}
              />
            </div>
            <div className="text-gray-500 dark:text-gray-400 mt-2">{fileDownloadProgress}%</div>
          </motion.div>
        )}
      </AnimatePresence>
      
      <ContactsContainer />
      
      {selectedChatType === undefined ? (
        <EmptyChatContainer />
      ) : (
        <ChatContainer />
      )}
    </div>
  );
}

export default Chat;
