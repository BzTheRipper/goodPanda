import { generateToken } from "../lib/utils.js";
import User from "../models/user.model.js";
import bcrypt from "bcryptjs";

export const signup = async (req, res) => {
    // Get users signUp data from frontend
    const { fullname, email, password, usertype } = req.body;

    try {
        if (!fullname || !email || !password || !usertype) {
            res.status(400).json({ message: "All fields are required" });
        }
        // Checking if the password length is greater than 8 characters
        if (password.length < 8) {
            return res.status(400).json({ message: "Password must be at least 8 charecters long" });
        }

        // Checking if the email exist
        const user = await User.findOne({ email });
        if (user) return res.status(400).json({ message: "Email already exists" });

        // Hashing password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const newUser = new User({
            fullname: fullname,
            email: email,
            password: hashedPassword,
            usertype: usertype
        })

        if (newUser) {
            // Generate Token
            generateToken(newUser._id, res)
            await newUser.save();

            res.status(201).json({
                _id: newUser._id,
                fullname: newUser.fullName,
                email: newUser.email,
                profilepic: newUser.profilepic,
                usertype: newUser.usertype,
                message: `Owh hellow ${fullname}, your account has been created successfully`
            })
        }
        else {
            res.status(400).json({ message: "Invalid user data" });
        }

    } catch (err) {
        console.log("Error in signup at auth.controller.js", err.message);
        res.status(500).json({ message: "Internal Server Error" });
    }
}

export const login = async (req, res) => {
    // First get the login info from user frontend req.body
    const { email, password } = req.body;

    try {
        // Checking if the email exists
        const user = await User.findOne({ email });
        if (!user) return res.status(400).json({ message: "Invalid credentials" });

        // Checking if the password is correct
        const isPasswordCorrect = await bcrypt.compare(password, user.password);
        if (!isPasswordCorrect) return res.status(400).json({ message: "Invalid credentials" })

        generateToken(user._id, res);

        res.status(200).json({
            _id: user._id,
            fullname: user.fullname,
            email: user.email,
            profilepic: user.profilepic,
            usertype: user.usertype,
            message: `Owh hellow ${user.fullname}, Weelcome, Loggedin successfully`,
        });


    } catch (err) {
        console.log("Error in login in backend auth.controller.js", err.message);
        res.status(500).json({ message: "Internal Server Error" });
    }
};

export const logout = (req, res) => {
    try {
        res.cookie("jwt", "", { maxAge: 0 });
        res.status(200).json({ message: "Logged out successfully" });
    } catch (err) {
        console.log("Error in backend logout auth.controller.js", err.message);
        res.status(500).json({ message: "Internal Server Error" });
    }

}

export const checkAuth = (req, res) => {
    try {
        res.status(200).json(req.user);
    } catch (err) {
        console.log("Error in checkAuth controller", err.message);
        res.status(500).json({ message: "Internal Server Error" });
    }
};