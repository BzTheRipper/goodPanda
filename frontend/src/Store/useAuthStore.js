import { create } from "zustand";
import { axiosInstance } from "../lib/axiosAPI.js"
import toast from "react-hot-toast"
import { io } from "socket.io-client";


const BASE_URL = `http://192.168.31.96:${import.meta.env.VITE_backendPort}`;

// The create function takes an object literal. 
// signup is a key in that object, and its value is a function. 
// Like signup all are the key in that object which values are boolean, array, function, string, intiger or others
// In JavaScript, when a function is a property of an object, we call it a method.
export const useAuthState = create((set, get) => ({

    // get for getting own files perameters current value
    // set for setting own files perameters current value

    authUser: null,
    isCheckingAuth: true,
    isSigningUp: false,
    isLoggingIn: false,
    socket: null,

    checkAuth: async () => {
        try {
            const res = await axiosInstance.get("/auth/check");
            set({ authUser: res.data });
            get().connectSocket();
            if (get().isCheckingAuth === false && get().authUser) return;
            //toast.success(`${res.data.fullname}, Auth Succeed`);
            //console.log("CheckAuth Response Data In useAuthStore checkAuth:", res.data);
        } catch (err) {
            console.log("Error in frontend/src/store/useAuthStore, checkAuth", err);
            //toast.error("Auth Error");
            set({ authUser: null });
        } finally {
            set({ isCheckingAuth: false });
        }

    },

    signup: async (usersSignUpFormData) => {
        set({ isSigningUp: true })
        try {
            const res = await axiosInstance.post("/auth/signup", usersSignUpFormData);
            set({ authUser: res.data });
            get().connectSocket();
            toast.success(res.data.message);
        } catch (err) {
            console.log("theBackendErrorMessageSignUp: ", err.response.data.message)
            toast.error(err.response.data.message);
        } finally {
            set({ isSigningUp: false })
        }
    },

    login: async (usersLoginFromData) => {
        set({ isLoggingIn: true })
        try {
            const res = await axiosInstance.post("/auth/login", usersLoginFromData);
            set({ authUser: res.data });
            toast.success(res.data.message);
            get().connectSocket();

        } catch (err) {
            console.log("theBackendErrorMessageLogIn: ", err.response.data.message)
            toast.error(err.response.data.message);
        } finally {
            set({ isLoggingIn: false });
        }
    },

    logout: async () => {
        try {
            const res = axiosInstance.post("/auth/logout");
            toast.success("Logged Out Successfully!");
            set({ authUser: null });
            get().disconnectSocket();
        } catch (err) {
            toast.error(err.response.data.message);
        }
    },

    connectSocket: () => {
        const { authUser, socket } = get();


        if (!authUser || socket) return;

        // Actual socket connection from frontend is happening here
        const newSocket = io(BASE_URL);
        newSocket.connect();

        set({ socket: newSocket });



    },

    disconnectSocket: () => {
        const { socket } = get();
        if (socket.connected) socket.disconnect();

    }

}))