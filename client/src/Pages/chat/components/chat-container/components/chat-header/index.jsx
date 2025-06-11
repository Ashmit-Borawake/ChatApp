import { getColor } from "@/lib/utils";
import { useAppStore } from "@/store";
import { HOST } from "@/utils/constants";
import { Avatar, AvatarImage } from "@radix-ui/react-avatar";
import { RiCloseFill } from "react-icons/ri";
import { FiMoon, FiSun } from "react-icons/fi";
import { motion } from "framer-motion";

const ChatHeader = () => {
  const { closeChat, selectedChatData, selectedChatType, isDarkMode, toggleDarkMode } = useAppStore();
  
  return (
    <motion.div 
      className="h-[10vh] border-b border-gray-200 dark:border-slate-700 flex items-center justify-between px-4 md:px-8 bg-white dark:bg-slate-800 shadow-sm"
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div className="flex gap-5 items-center w-full justify-between">
        <div className="flex gap-3 items-center justify-center">
          <div className="w-12 h-12 relative">
            {selectedChatType === "contact" ? (
              <Avatar className="h-12 w-12 rounded-full overflow-hidden shadow-md">
                {selectedChatData.image ? (
                  <AvatarImage
                    src={`${HOST}/${selectedChatData.image}`}
                    alt="profile"
                    className="object-cover w-full h-full"
                  />
                ) : (
                  <motion.div
                    whileHover={{ scale: 1.05 }}
                    className={`uppercase h-12 w-12 text-lg border flex items-center justify-center rounded-full shadow-sm ${getColor(
                      selectedChatData.color
                    )}`}
                  >
                    {selectedChatData.firstName
                      ? selectedChatData.firstName.split("").shift()
                      : selectedChatData.email.split("").shift()}
                  </motion.div>
                )}
              </Avatar>
            ) : (
              <motion.div 
                whileHover={{ scale: 1.05 }}
                className="bg-indigo-100 dark:bg-indigo-900/40 h-12 w-12 flex items-center justify-center rounded-full shadow-sm text-indigo-600 dark:text-indigo-300"
              >
                #
              </motion.div>
            )}
          </div>
          <div className="font-medium text-gray-800 dark:text-gray-100">
            {selectedChatType == "channel" && selectedChatData.name}
            {selectedChatType === "contact" && selectedChatData.firstName
              ? `${selectedChatData.firstName} ${selectedChatData.lastName}`
              : selectedChatData.email}
          </div>
        </div>
        <div className="flex items-center gap-4">
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            className="p-2 rounded-full bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors"
            onClick={toggleDarkMode}
          >
            {isDarkMode ? <FiSun className="text-xl" /> : <FiMoon className="text-xl" />}
          </motion.button>
          
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            className="p-2 rounded-full bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors"
            onClick={closeChat}
          >
            <RiCloseFill className="text-xl" />
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
};

export default ChatHeader;
