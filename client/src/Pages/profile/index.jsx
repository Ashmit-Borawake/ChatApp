import React, { useEffect, useRef } from "react";
import { useAppStore } from "@/store";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { IoArrowBack } from "react-icons/io5";
import { Avatar, AvatarImage } from "@/components/ui/avatar";
import { colors, getColor } from "@/lib/utils";
import { FaTrash, FaPlus } from "react-icons/fa";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { apiClient } from "@/lib/api-client";
import {
  ADD_PROFILE_IMAGE_ROUTE,
  HOST,
  REMOVE_PROFILE_IMAGE_ROUTE,
  UPDATE_PROFILE_ROUTE,
} from "@/utils/constants";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { languages } from "@/utils/languages";

function Profile() {
  const navigate = useNavigate();
  const { userInfo, setUserInfo } = useAppStore();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [image, setImage] = useState(null);
  const [hovered, setHovered] = useState(false);
  const [selectedColor, setSelectedColor] = useState(0);
  const [preferredLanguage, setPreferredLanguage] = useState("en");
  const fileInputRef = useRef(null);

  useEffect(() => {
    ///for setting the data even if the page is refreshed

    if (userInfo.profileSetup) {
      setFirstName(userInfo.firstName);
      setLastName(userInfo.lastName);
      setSelectedColor(userInfo.color);
      // Set preferred language if it exists
      if (userInfo.preferredLanguage) {
        setPreferredLanguage(userInfo.preferredLanguage);
      }
      // Ensure selectedColor is set as an index if needed
      // if (userInfo.color) {
      //   const index = colors.findIndex((c) => c === userInfo.color);
      //   if (index !== -1) {
      //     setSelectedColor(index);
      //   }
      // }
    }
    if (userInfo.image) {
      // setImage(`http://localhost:3004/${userInfo.image}`);
      setImage(`${HOST}/${userInfo.image}`);
    }
  }, [userInfo]);

  const validateProfile = () => {
    if (!firstName) {
      toast.error("First Name is required.");
      return false;
    }
    if (!lastName) {
      toast.error("Last Name is required.");
      return false;
    }
    if (!preferredLanguage) {
      toast.error("Preferred language is required.");
      return false;
    }
    return true;
  };

  const saveChanges = async () => {
    if (validateProfile()) {
      try {
        const response = await apiClient.post(
          UPDATE_PROFILE_ROUTE,
          {
            firstName,
            lastName,
            color: selectedColor,
            preferredLanguage,
          },
          { withCredentials: true }
        );
        if (response.status === 200 && response.data) {
          setUserInfo({ ...response.data });
          toast.success("Profile updated successfully!");
          navigate("/chat");
        }
      } catch (error) {
        console.log(error);
      }
    }
  };

  //For the Arror Back
  const handleNavigate = () => {
    if (userInfo.profileSetup) {
      navigate("/chat");
    } else {
      toast.error("Please setup your profile");
      navigate("/profile");
    }
  };

  const handleFileInputClick = () => {
    fileInputRef.current.click();
  };

  const handleImageChange = async (e) => {
    const file = e.target.files[0];
    console.log({ file });
    if (file) {
      const formData = new FormData();
      formData.append("profile-image", file);
      try {
        const response = await apiClient.post(
          ADD_PROFILE_IMAGE_ROUTE,
          formData,
          { withCredentials: true }
        );
        if (response.status === 200 && response.data.image) {
          setUserInfo({ ...userInfo, image: response.data.image });
          toast.success("Profile image updated successfully!");
        }
        const reader = new FileReader();
        reader.onloadend = () => {
          setImage(reader.result);
        };
        reader.readAsDataURL(file);
      } catch (error) {
        console.log(error);
      }
    }
  };

  const handleDeleteImage = async () => {
    try {
      // console.log("Calling DELETE:", REMOVE_PROFILE_IMAGE_ROUTE);
      const response = await apiClient.delete(REMOVE_PROFILE_IMAGE_ROUTE, {
        withCredentials: true,
      });
      // console.log("Response:", response);
      if (response.status === 200) {
        setUserInfo({ ...userInfo, image: null });
        toast.success("Profile image deleted successfully!");
        setImage(null);
      }
    } catch (error) {
      console.error(
        "Error deleting image:",
        error.response?.data || error.message
      );
      toast.error(error.response?.data || "Failed to delete profile image.");
    }
  };

  return (
    <div className="bg-[#1b1c24] h-[100vh] flex items-center justify-center flex-col gap-10">
      <div className="flex flex-col gap-10 w-[80vw] md:w-max">
        <div onClick={handleNavigate}>
          <IoArrowBack className="text-4xl text-white/90 cursor-pointer" />
        </div>
        <div className="grid grid-cols-2">
          <div
            className="h-full w-32 md:w-48 md:h-48 relative flex justify-center items-center"
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => {
              setHovered(false);
            }}
          >
            <Avatar className="h-32 w-32 md:h-48 md:w-48 rounded-full overflow-hidden">
              {image ? (
                <AvatarImage
                  src={image}
                  alt="profile"
                  className="object-cover w-full h-full bg-black"
                />
              ) : (
                <div
                  className={`uppercase h-32 w-32 md:w-48 md:h-48 text-5xl border-[1px] flex items-center justify-center rounded-full ${getColor(
                    selectedColor
                  )}`}
                >
                  {firstName
                    ? firstName.split("").shift()
                    : userInfo.email.split("").shift()}
                </div>
              )}
            </Avatar>
            {hovered && (
              <div
                className=" absolute inset-0 bg-black/50 flex items-center justify-center rounded-full cursor-pointer"
                onClick={image ? handleDeleteImage : handleFileInputClick}
              >
                {image ? (
                  <FaTrash className="text-white text-3xl cursor-pointer" />
                ) : (
                  <FaPlus className="text-white text-3xl cursor-pointer" />
                )}
              </div>
            )}
            <input
              type="file"
              className="hidden"
              ref={fileInputRef}
              onChange={handleImageChange}
              name="profile-image"
              accept=".png, .svg, .jpeg, .jpg, .webp, "
            />
          </div>
          <div className="flex min-w-32 md:min-wd-64 flex-col gap-5 text-white items-center justify-center">
            <div className="w-full">
              <Input
                placeholder="Email"
                type="email"
                disabled
                value={userInfo.email}
                className="rounded-lg p-6 bg-[#2c2e3b] border-none"
              />
            </div>
            <div className="w-full">
              <Input
                placeholder="First Name"
                type="text"
                onChange={(e) => {
                  setFirstName(e.target.value);
                }}
                value={firstName}
                className="rounded-lg p-6 bg-[#2c2e3b] border-none"
              />
            </div>
            <div className="w-full">
              <Input
                placeholder="Last Name"
                type="text"
                onChange={(e) => {
                  setLastName(e.target.value);
                }}
                value={lastName}
                className="rounded-lg p-6 bg-[#2c2e3b] border-none"
              />
            </div>
            <div className="w-full flex gap-5">
              {colors.map((color, index) => {
                return (
                  <div
                    key={index}
                    className={`w-8 h-8 transition-all duration-300 rounded-full cursor-pointer ${color}
                    ${
                      selectedColor === index &&
                      "ring-2 ring-offset-2 ring-offset-background ring-white/10"
                    }`}
                    onClick={() => {
                      setSelectedColor(index);
                    }}
                  ></div>
                );
              })}
            </div>
            <div className="w-full mt-4">
              <label className="block text-sm font-medium text-white mb-2">
                Preferred Language
              </label>
              <Select
                value={preferredLanguage}
                onValueChange={setPreferredLanguage}
              >
                <SelectTrigger className="rounded-lg p-6 bg-[#2c2e3b] border-none text-white">
                  <SelectValue placeholder="Select your preferred language" />
                </SelectTrigger>
                <SelectContent className="bg-[#2c2e3b] text-white border-none">
                  {languages.map((language) => (
                    <SelectItem key={language.value} value={language.value}>
                      {language.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-400 mt-1">
                Messages will be translated to this language
              </p>
            </div>
          </div>
        </div>
        <div className="w-full">
          <Button
            onClick={saveChanges}
            className="w-full h-16 bg-purple-700 hover:bg-purple-900 transition-all duration-300 "
          >
            Save Changes
          </Button>
        </div>
      </div>
    </div>
  );
}

export default Profile;
