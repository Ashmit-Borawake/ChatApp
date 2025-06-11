import Message from "../models/MessagesModel.js";
import User from "../models/UserModel.js";
import { mkdirSync, renameSync } from "fs";
import { translateText } from "../services/translationService.js";

export const getMessages = async (request, response) => {
  try {
    const user1 = request.userId;
    const user2 = request.body.id;

    if (!user1 || !user2) {
      return response.status(400).send("Both User ID's are required.");
    }

    // Get the current user's preferred language
    const currentUser = await User.findById(user1);
    const preferredLanguage = currentUser?.preferredLanguage || 'en';

    // Fetch messages between the two users
    let messages = await Message.find({
      $or: [
        { sender: user1, recipient: user2 },
        { sender: user2, recipient: user1 },
      ],
    })
    .populate("sender", "id email firstName lastName image color preferredLanguage")
    .populate("recipient", "id email firstName lastName image color preferredLanguage")
    .sort({ timestamp: 1 });

    // Process messages to include translations
    const processedMessages = messages.map((message) => {
      // Convert Mongoose document to plain object
      const messageObj = message.toObject();
      
      // Only process text messages
      if (message.messageType === 'text') {
        // IMPORTANT: Determine if current user is the receiver of this message
        // If user1 is not the sender, then they are the receiver
        const isCurrentUserReceiver = message.sender._id.toString() !== user1;
        
        if (isCurrentUserReceiver) {
          // Current user is receiving this message - show translated version if available
          console.log(`Message ${message._id} - User ${user1} is RECEIVER, checking for translation`);
          
          // Always check for translations for received messages
          // Handle the case where translatedContent is a Map object (from Mongoose)
          if (message.translatedContent) {
            // Convert Map to plain object if needed
            let translationObj = message.translatedContent;
            
            // Check if it's a Map object with get method
            if (typeof message.translatedContent.get === 'function') {
              // Create a plain object from the Map entries
              translationObj = {};
              message.translatedContent.forEach((value, key) => {
                translationObj[key] = value;
              });
              console.log(`Converted Map to object with keys: ${Object.keys(translationObj).join(', ')}`);
            }
            
            // Now work with the plain object
            if (translationObj[preferredLanguage]) {
              // Use existing translation in preferred language
              console.log(`Found translation for message ${message._id} in language ${preferredLanguage}`);
              messageObj.content = translationObj[preferredLanguage];
              messageObj.isTranslated = true;
            } else if (Object.keys(translationObj).length > 0) {
              // If no translation in preferred language, but translations exist in other languages
              // Use the first available translation as a fallback
              const firstAvailableLanguage = Object.keys(translationObj)[0];
              console.log(`No translation in ${preferredLanguage}, using ${firstAvailableLanguage} instead`);
              messageObj.content = translationObj[firstAvailableLanguage];
              messageObj.isTranslated = true;
            } else {
              // No translations available
              console.log(`No translations available for message ${message._id}`);
              if (message.originalContent) {
                messageObj.content = message.originalContent;
              }
              messageObj.isTranslated = false;
            }
          } else {
            // If no translation exists, use original content as fallback
            console.log(`No translation found for message ${message._id} in language ${preferredLanguage}`);
            
            // If we have originalContent, use that as fallback
            if (message.originalContent) {
              messageObj.content = message.originalContent;
            }
            
            // Mark as not translated so the UI can display it appropriately
            messageObj.isTranslated = false;
          }
        } else {
          // Current user is the sender - always show original content
          console.log(`Message ${message._id} - User ${user1} is SENDER, showing original content`);
          if (message.originalContent) {
            messageObj.content = message.originalContent;
          }
        }
      }
      
      // Log the message object for debugging
      console.log(`Processed message ${message._id}:`, {
        sender: message.sender._id.toString(),
        currentUser: user1,
        isReceiver: message.sender._id.toString() !== user1,
        originalContent: message.originalContent,
        translatedContent: message.translatedContent ? JSON.stringify(message.translatedContent) : 'none',
        finalContent: messageObj.content,
        preferredLanguage: preferredLanguage
      });
      
      return messageObj;
    });

    return response.status(200).json({ messages: processedMessages });
  } catch (error) {
    console.error("Error in getMessages:", error);
    return response.status(500).send("Internal Server Error.");
  }
};

export const uploadFile = async (request, response) => {
  try {
    if (!request.file) {
      return response.status(400).send("File is Required");
    }
    const date = Date.now();
    let fileDir = `uploads/files/${date}`;
    let fileName = `${fileDir}/${request.file.originalname}`;

    mkdirSync(fileDir, { recursive: true });
    renameSync(request.file.path, fileName);

    return response.status(200).json({ filePath: fileName });
  } catch (error) {
    console.error("Error in getMessages:", error);
    return response.status(500).send("Internal Server Error.");
  }
};
