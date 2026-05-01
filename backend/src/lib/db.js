import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();
const mongoo_uri = process.env.MONGODB_URI;

export const connectDB = async () => {
    try{
        const connection = await mongoose.connect(mongoo_uri);
        console.log(`MongoDB Connected: ${connection.connection.host}`)

    }catch(error){
        console.log("MongoDB Connection Error");
    }

}