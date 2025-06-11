import Victory from "@/assets/victory.svg";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { apiClient } from "@/lib/api-client";
import { LOGIN_ROUTE, SIGNUP_ROUTE } from "@/utils/constants";
import { useNavigate } from "react-router-dom";
import { useAppStore } from "@/store";
import Lottie from "lottie-react";
import loginAnimation from "../../assets/lottie/login-animation.json";
import { motion } from "framer-motion";
import { FiMoon, FiSun } from "react-icons/fi";

function Auth() {
  // State variables for handling input fields
  const navigate = useNavigate();
  const { setUserInfo, isDarkMode, toggleDarkMode, setIsDarkMode } = useAppStore();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  
  // Check localStorage for dark mode preference on mount
  useEffect(() => {
    // Get dark mode setting from localStorage if available
    const storedDarkMode = localStorage.getItem('darkMode');
    if (storedDarkMode !== null) {
      setIsDarkMode(storedDarkMode === 'true');
    }
  }, [setIsDarkMode]);

  // Apply dark mode class to body
  useEffect(() => {
    if (isDarkMode) {
      document.body.classList.add('dark');
      localStorage.setItem('darkMode', 'true');
    } else {
      document.body.classList.remove('dark');
      localStorage.setItem('darkMode', 'false');
    }
  }, [isDarkMode]);

  const validateLogin = () => {
    if (!email.trim().length) {
      toast.error("Email is required.");
      return false;
    }
    if (!password.trim().length) {
      toast.error("Password is required.");
      return false;
    }
    return true;
  };

  const validateSignup = () => {
    if (!email.trim().length) {
      toast.error("Email is required.");
      return false;
    }
    if (!password.trim().length) {
      toast.error("Password is required.");
      return false;
    }
    if (!confirmPassword.trim().length) {
      toast.error("Confirm Password is required.");
      return false;
    }
    if (password !== confirmPassword) {
      toast.error("Password and Confirm Password should be the same.");
      return false;
    }
    return true;
  };

  const handleLogin = async () => {
    if (!validateLogin()) return;
    
    try {
      setIsLoading(true);
      const response = await apiClient.post(
        LOGIN_ROUTE,
        { email, password },
        { withCredentials: true }
      );

      if (response.data.user.id) {
        setUserInfo(response.data.user);
        if (response.data.user.profileSetup) {
          navigate("/chat");
        } else {
          navigate("/profile");
        }
      }
    } catch (error) {
      if (error.response) {
        if (error.response.status === 404) {
          toast.error("Email not found. Please sign up first.");
        } else if (error.response.status === 401) {
          toast.error("Incorrect password. Please try again.");
        } else {
          toast.error(error.response.data.message || "Login failed!");
        }
      } else {
        toast.error("No response from the server.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignup = async () => {
    if (!validateSignup()) return;

    try {
      setIsLoading(true);
      const response = await apiClient.post(
        SIGNUP_ROUTE,
        { email, password },
        { withCredentials: true }
      );

      if (response.status === 201) {
        setUserInfo(response.data.user);
        toast.success("Signup successful!");
        navigate("/profile");
      }
    } catch (error) {
      if (error.response) {
        // Server responded with an error
        const errorMessage = error.response.data.message || "Signup failed!";
        toast.error(errorMessage);
      } else if (error.request) {
        // Request was made but no response was received
        toast.error("No response from the server. Please try again.");
      } else {
        // Something else happened
        toast.error("An unexpected error occurred.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Animation variants for fade-in effects
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { 
      opacity: 1,
      transition: { 
        duration: 0.6,
        when: "beforeChildren",
        staggerChildren: 0.2
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { 
      opacity: 1, 
      y: 0,
      transition: { duration: 0.4 }
    }
  };

  return (
    <motion.div 
      className="min-h-screen w-full flex flex-col bg-gray-50 dark:bg-slate-900"
      initial="hidden"
      animate="visible"
      variants={containerVariants}
    >
      {/* Dark mode toggle */}
      <motion.div 
        className="absolute top-4 right-4 z-10"
        variants={itemVariants}
      >
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          className="p-2 rounded-full bg-white dark:bg-slate-800 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 shadow-md transition-colors"
          onClick={toggleDarkMode}
          aria-label={isDarkMode ? "Switch to light mode" : "Switch to dark mode"}
        >
          {isDarkMode ? <FiSun className="text-xl" /> : <FiMoon className="text-xl" />}
        </motion.button>
      </motion.div>

      {/* Content container */}
      <div className="flex-1 flex flex-col md:flex-row items-center justify-center p-4 md:p-8">
        {/* Animation section - Shows at top on mobile, left on desktop */}
        <motion.div 
          className="w-full md:w-1/2 flex justify-center items-center mb-8 md:mb-0"
          variants={itemVariants}
        >
          <div className="w-full max-w-md">
            <Lottie 
              animationData={loginAnimation} 
              loop={true} 
              className="w-full"
              style={{ 
                maxHeight: '70vh',
                filter: isDarkMode ? 'brightness(0.9)' : 'none'
              }}
              aria-label="Chat login animation" 
              renderSettings={{
                preserveAspectRatio: 'xMidYMid slice'
              }}
            />
          </div>
        </motion.div>

        {/* Form section */}
        <motion.div 
          className="w-full md:w-1/2 max-w-md"
          variants={itemVariants}
        >
          <div className="bg-white dark:bg-slate-800 shadow-xl rounded-2xl p-6 md:p-8">
            {/* Welcome message with emoji */}
            <motion.div 
              className="flex items-center justify-center flex-col mb-6"
              variants={itemVariants}
            >
              <div className="flex items-center justify-center mb-2">
                <h1 className="text-3xl md:text-4xl font-bold text-gray-800 dark:text-gray-100">Welcome</h1>

              </div>
              {/* Subtitle */}
              <p className="font-medium text-center text-gray-600 dark:text-gray-300">
                Fill in the details to get started with the best chat app!
              </p>
            </motion.div>

            {/* Tabs Section - Login & Signup */}
            <motion.div className="w-full" variants={itemVariants}>
              <Tabs defaultValue="login" className="w-full">
                {/* Tabs Navigation - Login & Signup */}
                <TabsList className="bg-transparent rounded-lg w-full mb-4">
                  <TabsTrigger
                    value="login"
                    className="data-[state=active]:bg-indigo-50 dark:data-[state=active]:bg-indigo-900/30 
                      data-[state=active]:text-indigo-600 dark:data-[state=active]:text-indigo-400 rounded-lg w-full"
                  >
                    Login
                  </TabsTrigger>

                  <TabsTrigger
                    value="signup"
                    className="data-[state=active]:bg-indigo-50 dark:data-[state=active]:bg-indigo-900/30 
                      data-[state=active]:text-indigo-600 dark:data-[state=active]:text-indigo-400 rounded-lg w-full"
                  >
                    Signup
                  </TabsTrigger>
                </TabsList>

                {/* Login Form */}
                <TabsContent value="login" className="flex flex-col gap-4 mt-2">
                  <Input
                    placeholder="Email"
                    type="email"
                    className="bg-gray-100 dark:bg-slate-700 rounded-lg p-5 focus:ring-indigo-500 dark:focus:ring-indigo-400"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                  <Input
                    placeholder="Password"
                    type="password"
                    className="bg-gray-100 dark:bg-slate-700 rounded-lg p-5 focus:ring-indigo-500 dark:focus:ring-indigo-400"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <Button
                    className="rounded-lg p-5 bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 transition-colors mt-2"
                    onClick={handleLogin}
                    aria-label="Login"
                    disabled={isLoading}
                  >
                    {isLoading ? "Logging in..." : "Login"}
                  </Button>
                </TabsContent>

                {/* Signup Form */}
                <TabsContent value="signup" className="flex flex-col gap-4 mt-2">
                  <Input
                    placeholder="Email"
                    type="email"
                    className="bg-gray-100 dark:bg-slate-700 rounded-lg p-5 focus:ring-indigo-500 dark:focus:ring-indigo-400"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                  <Input
                    placeholder="Password"
                    type="password"
                    className="bg-gray-100 dark:bg-slate-700 rounded-lg p-5 focus:ring-indigo-500 dark:focus:ring-indigo-400"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <Input
                    placeholder="Confirm Password"
                    type="password"
                    className="bg-gray-100 dark:bg-slate-700 rounded-lg p-5 focus:ring-indigo-500 dark:focus:ring-indigo-400"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                  <Button
                    className="rounded-lg p-5 bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 transition-colors mt-2"
                    onClick={handleSignup}
                    aria-label="Signup"
                    disabled={isLoading}
                  >
                    {isLoading ? "Signing up..." : "Signup"}
                  </Button>
                </TabsContent>
              </Tabs>
            </motion.div>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}

export default Auth;
