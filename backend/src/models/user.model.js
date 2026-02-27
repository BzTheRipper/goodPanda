import mongoose, { mongo } from "mongoose";

const userSchema = new mongoose.Schema(
    {
        email: {
            type: String,
            required: true,
            unique: true,
        },
        fullname: {
            type: String,
            required: true,
        },
        password: {
            type: String,
            required: true,
            minlength: 8,
        },
        profilepic: {
            type: String,
            default: "",
        },
        usertype: {
            type: String,
            required: true,
            
        },
    },
    {timestamps: true}
);

// Create user schema into mongodb atlas
const User = mongoose.model("User", userSchema);

export default User;