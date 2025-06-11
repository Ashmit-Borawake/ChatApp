import { useAppStore } from "@/store";
import { HOST } from "@/utils/constants";
import { createContext, useContext, useEffect, useRef } from "react";
import { io } from "socket.io-client";

const SocketContext = createContext(null);

export const useSocket = () => {
  return useContext(SocketContext);
};

export const SocketProvider = ({ children }) => {
  const socket = useRef();
  const { userInfo } = useAppStore();

  useEffect(() => {
    if (userInfo) {
      socket.current = io(HOST, {
        withCredentials: true,
        query: { userId: userInfo.id },
      });

      socket.current.on("connect", () => {
        console.log("Connected to socket server");
      });

      // Properly defined event handlers that access store when events fire
      socket.current.on("receiveMessage", (message) => {
        // Get fresh state from the store when the event fires
        const {
          selectedChatData,
          selectedChatType,
          addMessage,
          addContactsInDMContacts,
        } = useAppStore.getState();

        if (
          selectedChatType !== undefined &&
          (selectedChatData._id === message.sender._id ||
            selectedChatData._id === message.recipient._id)
        ) {
          console.log("message rcv", message);
          addMessage(message);
        }
        addContactsInDMContacts(message);
      });

      socket.current.on("receive-channel-message", (message) => {
        // Get fresh state from the store when the event fires
        const {
          selectedChatData,
          selectedChatType,
          addMessage,
          addChannelInChannelList,
        } = useAppStore.getState();

        if (
          selectedChatType !== undefined &&
          selectedChatData._id === message.channelId
        ) {
          addMessage(message);
        }
        addChannelInChannelList(message);
      });

      // Add listeners for the translation events
      socket.current.on("messageTranslated", (translatedMessage) => {
        try {
          console.log(
            "Received translated message in socket context:",
            translatedMessage
          );
          // Get fresh state from the store when the event fires
          const { userInfo, selectedChatMessages, setSelectedChatMessages } =
            useAppStore.getState();

          // Only update messages for the recipient, not the sender
          if (
            translatedMessage.sender &&
            translatedMessage.sender._id === userInfo.id
          ) {
            console.log(
              "Ignoring translation of own message in socket context"
            );
            return;
          }

          // Update the message in the chat with the translation
          if (translatedMessage && translatedMessage._id) {
            console.log("Updating message with translation in socket context");

            // Safety check for selectedChatMessages
            if (!Array.isArray(selectedChatMessages)) {
              console.error(
                "selectedChatMessages is not an array:",
                selectedChatMessages
              );
              return;
            }

            const updatedMessages = selectedChatMessages.map((message) => {
              if (message && message._id === translatedMessage._id) {
                console.log(
                  "Found message to update with translation in socket context",
                  message._id
                );
                return {
                  ...message,
                  content: translatedMessage.content || message.content,
                  // No isTranslated flag to avoid showing translation indicators
                };
              }
              return message;
            });

            setSelectedChatMessages(updatedMessages);
          }
        } catch (error) {
          console.error(
            "Error handling translated message in socket context:",
            error
          );
        }
      });

      socket.current.on("channel-message-translated", (translatedMessage) => {
        try {
          console.log(
            "Received translated channel message in socket context:",
            translatedMessage
          );
          // Get fresh state from the store when the event fires
          const { userInfo, selectedChatMessages, setSelectedChatMessages } =
            useAppStore.getState();

          // Only update messages for the recipient, not the sender
          if (
            translatedMessage.sender &&
            translatedMessage.sender._id === userInfo.id
          ) {
            console.log(
              "Ignoring translation of own channel message in socket context"
            );
            return;
          } 

          // Update the message in the chat with the translation
          if (translatedMessage && translatedMessage._id) {
            console.log(
              "Updating channel message with translation in socket context"
            );

            // Safety check for selectedChatMessages
            if (!Array.isArray(selectedChatMessages)) {
              console.error(
                "selectedChatMessages is not an array:",
                selectedChatMessages
              );
              return;
            }

            const updatedMessages = selectedChatMessages.map((message) => {
              if (message && message._id === translatedMessage._id) {
                console.log(
                  "Found channel message to update with translation in socket context",
                  message._id
                );
                return {
                  ...message,
                  content: translatedMessage.content || message.content,
                  // No isTranslated flag to avoid showing translation indicators
                };
              }
              return message;
            });

            setSelectedChatMessages(updatedMessages);
          }
        } catch (error) {
          console.error(
            "Error handling translated channel message in socket context:",
            error
          );
        }
      });

      return () => {
        socket.current.disconnect();
      };
    }
  }, [userInfo]);

  return (
    <SocketContext.Provider value={socket.current}>
      {children}
    </SocketContext.Provider>
  );
};
