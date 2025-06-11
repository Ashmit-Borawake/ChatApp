import { Server as SocketIoServer } from "socket.io";
import Message from "./models/MessagesModel.js";
import Channel from "./models/ChannelModel.js";
import User from "./models/UserModel.js";
import {
  translateText,
  detectLanguage,
  shouldForceTranslate,
} from "./services/translationService.js";

const setupSocket = (server) => {
  const io = new SocketIoServer(server, {
    cors: {
      origin: process.env.ORIGIN,
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

  const userSocketMap = new Map();

  const disconnect = (socket) => {
    console.log(`Client Disconnected: ${socket.id}`);
    for (const [userId, socketId] of userSocketMap.entries()) {
      if (socketId === socket.id) {
        userSocketMap.delete(userId);
        // console.log(`User ${userId} removed from userSocketMap`);
        break;
      }
    }
  };

  const sendMessage = async (message) => {
    try {
      console.log(
        `Processing message: ${JSON.stringify(message, (key, value) => {
          // Limit long content strings to prevent log flooding
          if (
            key === "content" &&
            typeof value === "string" &&
            value.length > 50
          ) {
            return value.substring(0, 50) + "...";
          }
          return value;
        })}`
      );

      const senderSocketId = userSocketMap.get(message.sender);
      const recipientSocketId = userSocketMap.get(message.recipient);

      // Get sender and recipient user info to check their preferred languages
      const senderUser = await User.findById(message.sender);
      const recipientUser = await User.findById(message.recipient);

      // Store original content and language for all text messages
      if (message.messageType === "text") {
        // Always store the original content to avoid losing it
        message.originalContent = message.content;

        // Initialize translatedContent as an empty object if it doesn't exist
        if (!message.translatedContent) {
          message.translatedContent = {};
        }
      }

      // Create the message in the database immediately
      const createdMessage = await Message.create(message);

      // Fetch the complete message data with populated sender and recipient
      let messageData = await Message.findById(createdMessage._id)
        .populate(
          "sender",
          "id email firstName lastName image color preferredLanguage"
        )
        .populate(
          "recipient",
          "id email firstName lastName image color preferredLanguage"
        );

      // Send original message to the sender immediately
      if (senderSocketId) {
        io.to(senderSocketId).emit("receiveMessage", messageData);
      }

      // For the recipient, we'll only send the translated message
      // We don't send the original message to avoid flickering/overwriting in the UI
      // The translation will be processed and sent asynchronously
      // We'll handle this in the translation process below

      // For non-text messages, send to recipient immediately
      if (message.messageType !== "text" && recipientSocketId) {
        io.to(recipientSocketId).emit("receiveMessage", messageData);
      }

      // Process translation immediately for text messages
      if (message.messageType === "text") {
        setTimeout(() => {
          (async () => {
            try {
              console.log(
                `Starting async translation for message: ${createdMessage._id}`
              );

              if (!senderUser || !recipientUser) {
                console.log("Skipping translation due to missing user data");
                return;
              }

              // Step 1: Detect language
              let detectedLanguage;
              try {
                detectedLanguage = await detectLanguage(
                  message.content,
                  senderUser?.preferredLanguage || "en"
                );
                console.log(
                  `Detected language: ${detectedLanguage} for message: ${createdMessage._id}`
                );

                await Message.findByIdAndUpdate(createdMessage._id, {
                  languageFrom: detectedLanguage,
                  originalContent: message.content,
                });
              } catch (langError) {
                console.error("Language detection error:", langError);
                detectedLanguage = senderUser?.preferredLanguage || "en";
              }

              // Step 2: Hinglish override check
              const looksLikeHinglish =
                /^(?=.*\b(?:main|tum|kya|kese|nahi|hai|ho|ka|ke|ki)\b)[a-zA-Z\s.,!?']{4,}$/i.test(
                  message.content
                );
              const containsDevanagari = /[\u0900-\u097F]/.test(
                message.content
              );

              if (
                detectedLanguage === "en" &&
                senderUser?.preferredLanguage === "hi" &&
                looksLikeHinglish
              ) {
                console.log(
                  "Detected as English, but assuming Hinglish (Hindi in Roman script)"
                );
                detectedLanguage = "hi";
              }

              // Step 3: Decide if translation is needed
              let shouldTranslate = false;

              if (recipientUser?.preferredLanguage) {
                if (recipientUser.preferredLanguage !== detectedLanguage) {
                  shouldTranslate = true;
                } else if (
                  recipientUser.preferredLanguage === "hi" &&
                  detectedLanguage === "hi"
                ) {
                  if (!containsDevanagari || looksLikeHinglish) {
                    // Translate Hinglish or non-Devanagari Hindi to proper Hindi
                    shouldTranslate = true;
                    console.log("Forcing translation: Hinglish to Hindi");
                  }
                }
              }

              let finalText = message.content;

              if (shouldTranslate) {
                try {
                  console.log(
                    `Translating from ${detectedLanguage} to ${recipientUser.preferredLanguage}`
                  );

                  const forceTranslate = shouldForceTranslate(
                    detectedLanguage,
                    recipientUser.preferredLanguage,
                    message.content
                  );

                  const translatedText = await translateText(
                    message.content,
                    detectedLanguage,
                    recipientUser.preferredLanguage,
                    forceTranslate
                  );

                  console.log("Translation successful:", translatedText);

                  await Message.findByIdAndUpdate(createdMessage._id, {
                    $set: {
                      [`translatedContent.${recipientUser.preferredLanguage}`]:
                        translatedText,
                      originalContent: message.content,
                      languageFrom: detectedLanguage,
                    },
                  });

                  finalText = translatedText;
                } catch (translationError) {
                  console.error("Translation error:", translationError);
                  finalText = `${message.content} [Translation failed]`;
                }
              }

              // Step 4: Emit the final message (translated or original)
              if (recipientSocketId) {
                try {
                  const translatedMessageData = {
                    _id: messageData._id.toString(),
                    sender: {
                      _id: messageData.sender._id.toString(),
                      firstName: messageData.sender.firstName || "",
                      lastName: messageData.sender.lastName || "",
                      image: messageData.sender.image || null,
                      color: messageData.sender.color || "blue",
                    },
                    recipient: {
                      _id: messageData.recipient._id.toString(),
                      firstName: messageData.recipient.firstName || "",
                      lastName: messageData.recipient.lastName || "",
                    },
                    content: finalText,
                    createdAt: messageData.createdAt,
                    messageType: messageData.messageType,
                    fileUrl: messageData.fileUrl || null,
                    isTranslated: shouldTranslate,
                  };

                  io.to(recipientSocketId).emit(
                    "receiveMessage",
                    translatedMessageData
                  );
                  console.log(
                    `Message sent to recipient: ${recipientSocketId}`
                  );
                } catch (socketError) {
                  console.error(
                    "Error sending message to recipient:",
                    socketError
                  );
                }
              }
            } catch (error) {
              console.error("Async translation error:", error);
            }
          })();
        }, 100);
      }
    } catch (error) {
      console.error("Error sending message:", error);
    }
  };

  const sendChannelMessage = async (message) => {
    try {
      const { channelId, sender, content, messageType, fileUrl } = message;

      // Get sender user info
      const senderUser = await User.findById(sender);

      // Initialize message object
      const messageObj = {
        sender,
        recipient: null,
        content,
        messageType,
        timestamp: new Date(),
        fileUrl,
      };

      // Store original content for all text messages
      if (messageType === "text") {
        messageObj.originalContent = content;
        messageObj.translatedContent = {};
      }

      // Create the message in the database immediately
      const createdMessage = await Message.create(messageObj);

      // Fetch the complete message data with populated sender
      const messageData = await Message.findById(createdMessage._id)
        .populate(
          "sender",
          "id email firstName lastName image color preferredLanguage"
        )
        .exec();

      // Update the channel with the new message
      await Channel.findByIdAndUpdate(channelId, {
        $push: { messages: createdMessage._id },
      });

      // Get the channel with all members
      const channel = await Channel.findById(channelId).populate("members");
      const admin = await User.findById(channel.admin);

      const baseData = { ...messageData._doc, channelId: channel._id };

      // Only send original message to the sender immediately
      if (channel && channel.members) {
        const senderSocketId = userSocketMap.get(sender);
        if (senderSocketId) {
          io.to(senderSocketId).emit(`receive-channel-message`, baseData);
        }

        // For non-text messages, send to all members immediately
        if (messageType !== "text") {
          channel.members.forEach((member) => {
            const memberSocketId = userSocketMap.get(member._id.toString());
            if (memberSocketId && member._id.toString() !== sender) {
              io.to(memberSocketId).emit(`receive-channel-message`, baseData);
            }
          });

          const adminSocketId = userSocketMap.get(admin._id.toString());
          if (adminSocketId && admin._id.toString() !== sender) {
            io.to(adminSocketId).emit(`receive-channel-message`, baseData);
          }
          return;
        }

        // Process translations for text messages
        setTimeout(async () => {
          try {
            if (!senderUser) return;

            // Detect language
            let detectedLanguage = await detectLanguage(
              content,
              senderUser?.preferredLanguage || "en"
            );

            // Hinglish detection with more comprehensive checks
            const looksLikeHinglish =
              /\b(?:main|tum|kya|kese|nahi|hai|ho|ka|ke|ki|aap|yeh|woh|kuch|acha)\b/i.test(
                content
              );
            const containsDevanagari = /[\u0900-\u097F]/.test(content);
            const containsLatin = /[a-zA-Z]/.test(content);

            // Detect Hinglish - Hindi written in Latin script
            if (
              (detectedLanguage === "en" &&
                senderUser?.preferredLanguage === "hi" &&
                looksLikeHinglish) ||
              (detectedLanguage === "hi" &&
                !containsDevanagari &&
                containsLatin)
            ) {
              console.log(
                "Detected Hinglish (Hindi in Latin script), setting language to Hindi"
              );
              detectedLanguage = "hi";
            }

            await Message.findByIdAndUpdate(createdMessage._id, {
              languageFrom: detectedLanguage,
            });

            // Collect all unique target languages (including admin)
            const targetLanguages = new Set();
            const membersToTranslate = [];

            channel.members.forEach((member) => {
              if (member._id.toString() !== sender) {
                targetLanguages.add(member.preferredLanguage);
                membersToTranslate.push(member);
              }
            });

            if (admin._id.toString() !== sender) {
              targetLanguages.add(admin.preferredLanguage);
            }

            // Process translations
            const translations = {};
            for (const lang of targetLanguages) {
              // Check if translation needed or we need to force translate (e.g., Hinglish → Hindi)
              const forceTranslate = shouldForceTranslate(
                detectedLanguage,
                lang,
                content
              );
              const needsTranslation =
                lang !== detectedLanguage || forceTranslate;

              if (needsTranslation) {
                try {
                  const translatedText = await translateText(
                    content,
                    detectedLanguage,
                    lang,
                    forceTranslate
                  );

                  translations[lang] = translatedText;
                  await Message.findByIdAndUpdate(createdMessage._id, {
                    $set: {
                      [`translatedContent.${lang}`]: translatedText,
                      originalContent: content,
                      languageFrom: detectedLanguage,
                    },
                  });
                } catch (error) {
                  console.error(`Translation to ${lang} failed:`, error);
                  translations[lang] = content;
                }
              } else {
                translations[lang] = content;
              }
            }

            // Send translated messages
            membersToTranslate.forEach((member) => {
              const socketId = userSocketMap.get(member._id.toString());
              if (socketId) {
                const translatedData = {
                  ...baseData,
                  content: translations[member.preferredLanguage] || content,
                  isTranslated:
                    translations[member.preferredLanguage] !== content,
                };
                io.to(socketId).emit(`receive-channel-message`, translatedData);
              }
            });

            // Handle admin
            if (admin._id.toString() !== sender) {
              const adminSocketId = userSocketMap.get(admin._id.toString());
              if (adminSocketId) {
                const adminTranslatedData = {
                  ...baseData,
                  content: translations[admin.preferredLanguage] || content,
                  isTranslated:
                    translations[admin.preferredLanguage] !== content,
                };
                io.to(adminSocketId).emit(
                  `receive-channel-message`,
                  adminTranslatedData
                );
              }
            }
          } catch (error) {
            console.error("Channel translation error:", error);
          }
        }, 100);
      }
    } catch (error) {
      console.error("Error sending channel message:", error);
    }
  };

  io.on("connection", (socket) => {
    try {
      const userId = socket.handshake.query.userId?.toString(); // Ensure userId is a string
      socket.userId = userId; // Store userId on socket object for easier access

      if (userId) {
        // Remove previous instance if user reconnects
        if (userSocketMap.has(userId)) {
          console.log(`User ${userId} reconnected. Removing old socket.`);
          userSocketMap.delete(userId);
        }

        userSocketMap.set(userId, socket.id);
        console.log(`User Connected: ${userId} with Socket ID: ${socket.id}`);
        console.log(`Active connections: ${userSocketMap.size}`);
      } else {
        console.log("User ID not provided during connection.");
      }

      // Wrap event handlers in try-catch blocks to prevent crashes
      socket.on("sendMessage", (message) => {
        try {
          sendMessage(message);
        } catch (error) {
          console.error(`Error in sendMessage handler: ${error.message}`);
          console.error(error.stack);
        }
      });

      socket.on("send-channel-message", (message) => {
        try {
          sendChannelMessage(message);
        } catch (error) {
          console.error(
            `Error in send-channel-message handler: ${error.message}`
          );
          console.error(error.stack);
        }
      });

      socket.on("disconnect", (reason) => {
        try {
          console.log(`Client Disconnected: ${socket.id}, Reason: ${reason}`);
          disconnect(socket);
        } catch (error) {
          console.error(`Error in disconnect handler: ${error.message}`);
          console.error(error.stack);
        }
      });

      // Handle errors on the socket
      socket.on("error", (error) => {
        console.error(`Socket error for ${socket.id}: ${error.message}`);
        console.error(error.stack);
      });
    } catch (error) {
      console.error(`Error during socket connection setup: ${error.message}`);
      console.error(error.stack);
    }
  });
};

export default setupSocket;
