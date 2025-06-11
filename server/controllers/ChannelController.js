import mongoose from "mongoose";
import Channel from "../models/ChannelModel.js";
import User from "../models/UserModel.js";

export const createChannel = async (request, response) => {
  try {
    const { name, members } = request.body;
    const userId = request.userId;

    const admin = await User.findById(userId);

    if (!admin) {
      return response.status(400).send("Admin user not found");
    }

    const validMembers = await User.find({ _id: { $in: members } });

    if (validMembers.length !== members.length) {
      return response.status(400).send("Some members are not valid users.");
    }

    const newChannel = new Channel({
      name,
      members,
      admin: userId,
    });

    await newChannel.save();
    return response.status(201).json({ channel: newChannel });
  } catch (error) {
    console.error("Error in getChannelMessages:", error);
    return response.status(500).send("Internal Server Error.");
  }
};

export const getUserChannels = async (request, response) => {
  try {
    const userId = new mongoose.Types.ObjectId(request.userId);
    const channels = await Channel.find({
      $or: [{ admin: userId }, { members: userId }], //we are getting all the channels where the current user is a admin or member
    }).sort({ updatedAt: -1 });

    return response.status(201).json({ channels });
  } catch (error) {
    console.error("Error in getChannelMessages:", error);
    return response.status(500).send("Internal Server Error.");
  }
};

export const getChannelMessages = async (request, response) => {
  try {
    const { channelId } = request.params;
    const userId = request.userId;
    
    // Get the current user's preferred language
    const currentUser = await User.findById(userId);
    const preferredLanguage = currentUser?.preferredLanguage || 'en';
    
    const channel = await Channel.findById(channelId).populate({
      path: "messages",
      populate: {
        path: "sender",
        select: "firstName lastName email _id image color preferredLanguage",
      },
    });
    
    if (!channel) {
      return response.status(404).send("Channel not found.");
    }

    // Process messages to include translations if available
    const processedMessages = channel.messages.map(message => {
      // Convert Mongoose document to plain object
      const messageObj = message.toObject ? message.toObject() : message;
      
      // Only process text messages
      if (message.messageType === 'text') {
        // IMPORTANT: Determine if current user is the sender of this message
        const isCurrentUserSender = message.sender._id.toString() === userId;
        
        if (isCurrentUserSender) {
          // Current user is the sender - always show original content
          console.log(`Channel: Message ${message._id} - User ${userId} is SENDER, showing original content`);
          if (message.originalContent) {
            messageObj.content = message.originalContent;
          }
        } else {
          // Current user is receiving this message - show translated version if available
          console.log(`Channel: Message ${message._id} - User ${userId} is RECEIVER, checking for translation`);
          
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
              console.log(`Channel: Converted Map to object with keys: ${Object.keys(translationObj).join(', ')}`);
            }
            
            // Now work with the plain object
            if (translationObj[preferredLanguage]) {
              // Use existing translation in preferred language
              console.log(`Channel: Found translation for message ${message._id} in language ${preferredLanguage}`);
              messageObj.content = translationObj[preferredLanguage];
              messageObj.isTranslated = true;
            } else if (Object.keys(translationObj).length > 0) {
              // If no translation in preferred language, but translations exist in other languages
              // Use the first available translation as a fallback
              const firstAvailableLanguage = Object.keys(translationObj)[0];
              console.log(`Channel: No translation in ${preferredLanguage}, using ${firstAvailableLanguage} instead`);
              messageObj.content = translationObj[firstAvailableLanguage];
              messageObj.isTranslated = true;
            } else {
              // No translations available
              console.log(`Channel: No translations available for message ${message._id}`);
              if (message.originalContent) {
                messageObj.content = message.originalContent;
              }
              messageObj.isTranslated = false;
            }
          } else {
            // If no translation exists, use original content as fallback
            console.log(`Channel: No translation found for message ${message._id} in language ${preferredLanguage}`);
            
            // If we have originalContent, use that as fallback
            if (message.originalContent) {
              messageObj.content = message.originalContent;
            }
            
            // Mark as not translated so the UI can display it appropriately
            messageObj.isTranslated = false;
          }
        }
      }
      
      // Log the message object for debugging
      console.log(`Channel: Processed message ${message._id}:`, {
        sender: message.sender._id.toString(),
        currentUser: userId,
        isCurrentUserSender: message.sender._id.toString() === userId,
        originalContent: message.originalContent,
        translatedContent: message.translatedContent ? JSON.stringify(message.translatedContent) : 'none',
        finalContent: messageObj.content,
        preferredLanguage: preferredLanguage
      });
      
      return messageObj;
    });
    
    return response.status(200).json({ messages: processedMessages });
  } catch (error) {
    console.error("Error in getChannelMessages:", error);
    return response.status(500).send("Internal Server Error.");
  }
};
