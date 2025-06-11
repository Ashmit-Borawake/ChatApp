import { apiClient } from "@/lib/api-client";
import { useAppStore } from "@/store";
import {
  GET_ALL_MESSAGES_ROUTE,
  GET_CHANNEL_MESSAGES,
  HOST,
} from "@/utils/constants";
import moment from "moment";
import { useEffect, useRef, useState } from "react";
import { MdFolderZip } from "react-icons/md";
import { IoMdArrowRoundDown } from "react-icons/io";
import { IoCloseSharp } from "react-icons/io5";
import { Avatar, AvatarFallback, AvatarImage } from "@radix-ui/react-avatar";
import { getColor } from "@/lib/utils";
import { languages } from "@/utils/languages";
import { useSocket } from "@/context/Socketcontext";
import { motion, AnimatePresence } from "framer-motion";

const MessageContainer = () => {
  const scrollRef = useRef();
  const socket = useSocket();
  const {
    selectedChatType,
    selectedChatData,
    userInfo,
    selectedChatMessages,
    setSelectedChatMessages,
    setFileDownloadProgress,
    setIsDownloading,
  } = useAppStore();

  const [showImage, setShowImage] = useState(false);
  const [imageURL, setImageURL] = useState(null);
  const [isTyping, setIsTyping] = useState(false); // For typing indicator

  useEffect(() => {
    const getMessages = async () => {
      try {
        const response = await apiClient.post(
          GET_ALL_MESSAGES_ROUTE,
          { id: selectedChatData._id },
          { withCredentials: true }
        );
        if (response.data.messages) {
          setSelectedChatMessages(response.data.messages);
        }
      } catch (error) {
        console.error({ error });
      }
    };

    const getChannelMessages = async () => {
      try {
        const response = await apiClient.get(
          `${GET_CHANNEL_MESSAGES}/${selectedChatData._id}`,
          { withCredentials: true }
        );
        if (response.data.messages) {
          setSelectedChatMessages(response.data.messages);
        }
      } catch (error) {
        console.error({ error });
      }
    };

    if (selectedChatData._id) {
      if (selectedChatType === "contact") getMessages();
      else if (selectedChatType === "channel") getChannelMessages();
    }
  }, [selectedChatData, selectedChatType, setSelectedChatMessages]);

  useEffect(() => {
    if (!socket) return;
    
    // Mock typing indicator - in a real app you would use socket events
    const mockTypingIndicator = () => {
      // Randomly show typing indicator sometimes
      if (Math.random() > 0.7) {
        setIsTyping(true);
        setTimeout(() => setIsTyping(false), 3000);
      }
    };
    
    const typingInterval = setInterval(mockTypingIndicator, 10000);
    
    return () => {
      clearInterval(typingInterval);
    };
  }, [socket]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [selectedChatMessages, isTyping]);

  const checkIfImage = (filePath) => {
    const imageRegex =
      /\.(jpg|jpeg|png|gif|bmp|tiff|tif|webp|svg|ico|heic|heif)$/i;
    return imageRegex.test(filePath);
  };

  const renderMessages = () => {
    let lastDate = null;
    return selectedChatMessages.map((message, index) => {
      const messageDate = moment(message.timestamp).format("YYYY-MM-DD");
      const showDate = messageDate !== lastDate;
      lastDate = messageDate;
      
      // Check if this is first message from this sender or a new day
      const isFirstMessageFromSender = index === 0 || 
        (selectedChatMessages[index-1].sender !== message.sender);
      
      return (
        <div key={index}>
          {showDate && (
            <motion.div 
              className="flex justify-center my-4"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <span className="px-3 py-1 bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-gray-300 text-xs rounded-full shadow-sm">
                {moment(message.timestamp).format("LL")}
              </span>
            </motion.div>
          )}
          {selectedChatType === "contact" && renderDMMessages(message, index)}
          {selectedChatType === "channel" && renderChannelMessages(message, index)}
        </div>
      );
    });
  };

  const downloadFile = async (url) => {
    setIsDownloading(true);
    setFileDownloadProgress(0);

    try {
      const response = await apiClient.get(`${HOST}/${url}`, {
        responseType: "blob",
        onDownloadProgress: (progressEvent) => {
          const { loaded, total } = progressEvent;
          if (total) {
            const percentCompleted = Math.round((loaded * 100) / total);
            setFileDownloadProgress(percentCompleted);
          }
        },
      });

      if (response.status === 200) {
        const urlBlob = window.URL.createObjectURL(response.data);
        const link = document.createElement("a");
        link.href = urlBlob;
        link.setAttribute("download", url.split("/").pop());
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(urlBlob);
      }
    } catch (error) {
      console.error("Error downloading file:", error);
    } finally {
      setIsDownloading(false);
      setFileDownloadProgress(0);
    }
  };

  const renderDMMessages = (message, index) => {
    const isCurrentUser = (message.sender?._id || message.sender) === userInfo.id;
    
    return (
      <motion.div
        className={`mb-3 ${isCurrentUser ? "text-right" : "text-left"}`}
        initial={{ opacity: 0, y: 20, x: isCurrentUser ? 20 : -20 }}
        animate={{ opacity: 1, y: 0, x: 0 }}
        transition={{ duration: 0.3, delay: index * 0.05 }}
      >
        {message.messageType === "text" && (
          <div
            className={`relative ${
              isCurrentUser
                ? "bg-indigo-100 dark:bg-indigo-900/40 text-indigo-800 dark:text-indigo-100 ml-auto"
                : "bg-white dark:bg-slate-700 text-gray-800 dark:text-gray-100 mr-auto"
            } p-3 px-4 rounded-2xl my-1 max-w-[70%] w-fit shadow-sm break-words`}
          >
            <p className="whitespace-pre-line break-words text-left">
              {message.content}
            </p>
          </div>
        )}

        {message.messageType === "file" && (
          <div
            className={`inline-block p-3 rounded-2xl my-1 max-w-[50%] break-words shadow-sm ${
              isCurrentUser
                ? "bg-indigo-100 dark:bg-indigo-900/40 text-indigo-800 dark:text-indigo-100"
                : "bg-white dark:bg-slate-700 text-gray-800 dark:text-gray-100"
            }`}
          >
            {checkIfImage(message.fileUrl) ? (
              <div
                className="cursor-pointer flex justify-center items-center"
                onClick={() => {
                  setShowImage(true);
                  setImageURL(message.fileUrl);
                }}
              >
                <img
                  src={`${HOST}/${message.fileUrl}`}
                  height={250}
                  width={250}
                  className="rounded-xl shadow-sm max-w-full"
                />
              </div>
            ) : (
              <div className="h-auto w-auto flex items-center justify-center gap-3 py-1 px-2">
                <span className="text-indigo-600 dark:text-indigo-300 text-2xl rounded-full p-2 bg-white/50 dark:bg-slate-600/50">
                  <MdFolderZip />
                </span>
                <span className="text-sm overflow-hidden text-ellipsis max-w-[120px]">
                  {message.fileUrl.split("/").pop()}
                </span>
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                  className="p-2 text-xl rounded-full bg-indigo-500 text-white shadow-sm hover:bg-indigo-600 transition-colors"
                  onClick={() => downloadFile(message.fileUrl)}
                >
                  <IoMdArrowRoundDown />
                </motion.button>
              </div>
            )}
          </div>
        )}
        <div className="text-xs text-gray-400 dark:text-gray-500 mt-1 mx-1">
          {moment(message.timestamp).format("LT")}
        </div>
      </motion.div>
    );
  };

  const renderChannelMessages = (message, index) => {
    const isCurrentUser = message.sender._id === userInfo.id;
    
    return (
      <motion.div
        className={`mt-4 ${isCurrentUser ? "text-right" : "text-left"}`}
        initial={{ opacity: 0, y: 20, x: isCurrentUser ? 20 : -20 }}
        animate={{ opacity: 1, y: 0, x: 0 }}
        transition={{ duration: 0.3, delay: index * 0.05 }}
      >
        {message.messageType === "text" && (
          <div
            className={`relative ${
              isCurrentUser
                ? "bg-indigo-100 dark:bg-indigo-900/40 text-indigo-800 dark:text-indigo-100 ml-auto"
                : "bg-white dark:bg-slate-700 text-gray-800 dark:text-gray-100 mr-auto"
            } p-3 px-4 rounded-2xl my-1 max-w-[70%] w-fit shadow-sm break-words`}
          >
            <p className="whitespace-pre-line break-words text-left">
              {message.content}
            </p>
          </div>
        )}

        {message.messageType === "file" && (
          <div
            className={`inline-block p-3 rounded-2xl my-1 max-w-[50%] break-words shadow-sm ${
              isCurrentUser
                ? "bg-indigo-100 dark:bg-indigo-900/40 text-indigo-800 dark:text-indigo-100"
                : "bg-white dark:bg-slate-700 text-gray-800 dark:text-gray-100"
            }`}
          >
            {checkIfImage(message.fileUrl) ? (
              <div
                className="cursor-pointer flex justify-center items-center"
                onClick={() => {
                  setShowImage(true);
                  setImageURL(message.fileUrl);
                }}
              >
                <img
                  src={`${HOST}/${message.fileUrl}`}
                  height={250}
                  width={250}
                  className="rounded-xl shadow-sm max-w-full"
                />
              </div>
            ) : (
              <div className="h-auto w-auto flex items-center justify-center gap-3 py-1 px-2">
                <span className="text-indigo-600 dark:text-indigo-300 text-2xl rounded-full p-2 bg-white/50 dark:bg-slate-600/50">
                  <MdFolderZip />
                </span>
                <span className="text-sm overflow-hidden text-ellipsis max-w-[120px]">
                  {message.fileUrl.split("/").pop()}
                </span>
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                  className="p-2 text-xl rounded-full bg-indigo-500 text-white shadow-sm hover:bg-indigo-600 transition-colors"
                  onClick={() => downloadFile(message.fileUrl)}
                >
                  <IoMdArrowRoundDown />
                </motion.button>
              </div>
            )}
          </div>
        )}
        {message.sender._id !== userInfo.id ? (
          <div className="mt-1 ml-1 flex items-center justify-start gap-2">
            <Avatar className="h-6 w-6 rounded-full overflow-hidden shadow-sm">
              {message.sender.image && (
                <AvatarImage
                  src={`${HOST}/${message.sender.image}`}
                  alt="profile"
                  className="object-cover w-full h-full"
                />
              )}
              <AvatarFallback
                className={`uppercase h-6 w-6 text-sm flex items-center justify-center rounded-full shadow-sm ${getColor(
                  message.sender.color
                )}`}
              >
                {message.sender.firstName
                  ? message.sender.firstName.split("").shift()
                  : message.sender.email.split("").shift()}
              </AvatarFallback>
            </Avatar>
            <span className="text-xs text-gray-600 dark:text-gray-300 font-medium">
              {`${message.sender.firstName} ${message.sender.lastName}`}
            </span>
            <span className="text-[10px] text-gray-400 dark:text-gray-500">
              {moment(message.timestamp).format("LT")}
            </span>
            
            {/* Online status indicator */}
            <div className="h-2 w-2 rounded-full bg-green-400 shadow-sm"></div>
          </div>
        ) : (
          <div className="text-xs text-gray-400 dark:text-gray-500 mt-1 mr-1">
            {moment(message.timestamp).format("LT")}
          </div>
        )}
      </motion.div>
    );
  };

  // Typing indicator animation
  const typingIndicator = () => (
    <motion.div 
      className="flex items-center gap-1 px-4 py-2 bg-white dark:bg-slate-700 rounded-full w-24 shadow-sm ml-2 mb-3"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 10 }}
    >
      <motion.div 
        className="w-2 h-2 bg-indigo-500 rounded-full"
        animate={{ y: [0, -5, 0] }}
        transition={{ repeat: Infinity, duration: 0.8, delay: 0 }}
      />
      <motion.div 
        className="w-2 h-2 bg-indigo-500 rounded-full"
        animate={{ y: [0, -5, 0] }}
        transition={{ repeat: Infinity, duration: 0.8, delay: 0.2 }}
      />
      <motion.div 
        className="w-2 h-2 bg-indigo-500 rounded-full"
        animate={{ y: [0, -5, 0] }}
        transition={{ repeat: Infinity, duration: 0.8, delay: 0.4 }}
      />
    </motion.div>
  );

  return (
    <motion.div 
      className="flex-1 overflow-y-auto overflow-x-hidden py-4 px-2 md:px-4 lg:px-6 bg-gray-50 dark:bg-slate-900 md:w-[65vw] lg:w-[70vw] xl:w-[80vw] w-full"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      <div className="flex flex-col space-y-1">
        {renderMessages()}
        <AnimatePresence>
          {isTyping && selectedChatType === "contact" && typingIndicator()}
        </AnimatePresence>
        <div ref={scrollRef} />
      </div>
      
      {showImage && (
        <motion.div
          className="fixed z-[1000] top-0 left-0 h-[100vh] w-[100vw] flex items-center justify-center backdrop-blur-lg flex-col bg-black/60"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => {
            setShowImage(false);
            setImageURL(null);
          }}
        >
          {/* Image Container (Prevents Closing When Clicking on Image) */}
          <motion.div 
            onClick={(e) => e.stopPropagation()}
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.3 }}
          >
            <img
              src={`${HOST}/${imageURL}`}
              className="h-[80vh] max-w-[80vw] object-contain rounded-xl shadow-2xl"
              alt="Preview"
            />
          </motion.div>

          {/* Buttons */}
          <div className="flex gap-4 absolute top-5 right-5">
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              className="bg-white/10 backdrop-blur-md p-3 text-3xl rounded-full text-white cursor-pointer transition-all hover:bg-white/20"
              onClick={(e) => {
                e.stopPropagation(); // Prevents popup from closing when clicking the button
                downloadFile(imageURL);
              }}
            >
              <IoMdArrowRoundDown />
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              className="bg-white/10 backdrop-blur-md p-3 text-3xl rounded-full text-white cursor-pointer transition-all hover:bg-white/20"
              onClick={(e) => {
                e.stopPropagation();
                setShowImage(false);
                setImageURL(null);
              }}
            >
              <IoCloseSharp />
            </motion.button>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
};

export default MessageContainer;
