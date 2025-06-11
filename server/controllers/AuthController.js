import jwt from "jsonwebtoken";
import User from "../models/UserModel.js";
// import { compare } from "bcrypt";
import { compare } from "bcryptjs";
import { renameSync, unlinkSync } from "fs";
const maxAge = 3 * 24 * 60 * 60 * 1000; //valid for 3days
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
// import { userInfo } from "os";

const createToken = (email, userId) => {
  return jwt.sign({ email, userId }, process.env.JWT_KEY, {
    expiresIn: maxAge,
  });
};

export const signup = async (request, response, next) => {
  try {
    const { email, password } = request.body;
    if (!email || !password) {
      return response.status(400).send("Email and Password are required.");
    }
    const user = await User.create({ email, password });
    response.cookie("jwt", createToken(email, user.id), {
      maxAge,
      secure: true,
      sameSite: "None",
    });
    return response.status(201).json({
      user: {
        id: user.id,
        email: user.email,
        profileSetup: user.profileSetup,
      },
    });
  } catch (error) {
    console.log(error);
    return response.status(500).send("Internal Server Error.");
  }
};

export const login = async (request, response) => {
  try {
    const { email, password } = request.body;

    if (!email || !password) {
      return response.status(400).send("Email and Password are required.");
    }

    // Check if user exists
    const user = await User.findOne({ email });
    if (!user) {
      return response.status(404).send("Invalid Email. Please sign up first.");
    }

    // Validate password
    const auth = await compare(password, user.password);
    if (!auth) {
      return response.status(400).send("Invalid Password.");
    }

    // Generate JWT and set as a cookie
    response.cookie("jwt", createToken(email, user.id), {
      maxAge,
      secure: true,
      sameSite: "None",
    });

    return response.status(200).json({
      user: {
        id: user.id,
        email: user.email,
        profileSetup: user.profileSetup,
        firstName: user.firstName,
        lastName: user.lastName,
        image: user.image,
        color: user.color,
        preferredLanguage: user.preferredLanguage,
      },
    });
  } catch (error) {
    console.error("Login Error:", error);
    return response.status(500).send("Internal Server Error.");
  }
};

export const getUserInfo = async (request, response, next) => {
  try {
    const userData = await User.findById(request.userId);
    if (!userData) {
      return response.status(404).send("User with the given mail not found");
    }
    return response.status(200).json({
      id: userData.id,
      email: userData.email,
      profileSetup: userData.profileSetup,
      firstName: userData.firstName,
      lastName: userData.lastName,
      image: userData.image,
      color: userData.color,
      preferredLanguage: userData.preferredLanguage,
    });
  } catch (error) {
    console.error("Error during login:", error);
    return response.status(500).send("Internal Server Error.");
  }
};

export const updateProfile = async (request, response) => {
  try {
    const { userId } = request;
    const { lastName, firstName, color, preferredLanguage } = request.body;
    if (!lastName || !firstName) {
      return response
        .status(400)
        .send("lastName, firstName, and color are required.");
    }

    const userData = await User.findByIdAndUpdate(
      userId,
      {
        firstName,
        lastName,
        color,
        preferredLanguage,
        profileSetup: true,
      },
      { new: true, runValidators: true }
    ); //new tells mongodb to send new data to frontend

    return response.status(200).json({
      id: userData.id,
      email: userData.email,
      profileSetup: userData.profileSetup,
      firstName: userData.firstName,
      lastName: userData.lastName,
      image: userData.image,
      color: userData.color,
      preferredLanguage: userData.preferredLanguage,
    });
  } catch (error) {
    console.error("Error during login:", error);
    return response.status(500).send("Internal Server Error.");
  }
};

export const addProfileImage = async (request, response) => {
  try {
    if (!request.file) {
      return response.status(400).send("Image is required.");
    }
    const date = Date.now();
    let fileName =
      "uploads/profiles/" + date + path.extname(request.file.originalname);
    renameSync(request.file.path, fileName);
    // const imageUrl = `http://localhost:3004/${fileName}`; // Hardcoded URL
    // console.log("Image URL:", imageUrl);
    const updatedUser = await User.findByIdAndUpdate(
      request.userId,
      { image: fileName },
      { new: true, runValidators: true }
    );

    return response.status(200).json({
      image: updatedUser.image,
    });
  } catch (error) {
    console.error("Error adding profile image:", error);
    return response.status(500).send("Internal Server Error.");
  }
};

export const removeProfileImage = async (request, response) => {
  try {
    const user = await User.findById(request.userId);
    if (!user) {
      return response.status(404).send("User not found");
    }

    if (user.image) {
      const filePath = path.join(process.cwd(), user.image);
      if (fs.existsSync(filePath)) {
        unlinkSync(filePath);
      } else {
        console.warn("File not found:", filePath);
      }
    }

    // Update the database to remove the image reference
    user.image = null;
    await user.save();

    return response.status(200).send("Image removed successfully");
  } catch (error) {
    console.error("Error in removeProfileImage:", error);
    return response.status(500).send("Internal Server Error.");
  }
};

export const logout = async (request, response) => {
  try {
    response.cookie("jwt", "", { maxAge: 1, secure: true, sameSite: "None" });

    return response.status(200).send("Logout Successfull.");
  } catch (error) {
    console.error("Error in removeProfileImage:", error);
    return response.status(500).send("Internal Server Error.");
  }
};
