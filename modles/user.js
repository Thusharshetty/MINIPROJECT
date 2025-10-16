const mongoose = require('mongoose');

// Define the schema for a User
const userSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        unique: true, // Ensures no two users can have the same username
        trim: true    // Removes whitespace from both ends of a string
    },
    password: {
        type: String,
        required: true
    },
    // Optional: You might want to track when the user was created
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Create and export the User Model
const User = mongoose.model('User', userSchema);

module.exports = User;