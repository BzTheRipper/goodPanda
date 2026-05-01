import jwt from "jsonwebtoken";
import dotenv from 'dotenv';

dotenv.config();
export const generateToken = (userId, res) => {
    const token = jwt.sign({userId}, process.env.JWT_SECRET, {expiresIn:"7d"})

    const expiredTime = 7*24*60*60*1000 // mili seconds

    res.cookie("jwt", token, {
        maxAge: expiredTime,
        httpOnly: true, // prevent XSS attacks cross-site scripting attacks
        sameSite: "strict", // CSRF attacks cross-site request 
        secure: process.env.NODE_ENV != "development"
    })

    return token;
}