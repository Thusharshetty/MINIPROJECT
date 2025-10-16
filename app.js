const express = require('express');
const path = require('path');
const app = express();
const PORT =3000;
const mongoose = require('mongoose');
const User = require('./modles/user'); 
app.use(express.urlencoded({extended:true}));
app.use(express.json());
const bcrypt = require('bcrypt');
main().then(()=>{console.log("connected to db")}).catch(err => console.log(err));

async function main() {
  await mongoose.connect('mongodb://127.0.0.1:27017/miniproject');
}

app.get('/',(req,res)=>{
    res.sendFile(path.join(__dirname,'index.html'));
});

app.get('/signup',(req,res)=>{
    res.sendFile(path.join(__dirname,'signin.html'));
});
app.get('/login',(req,res)=>{
    res.sendFile(path.join(__dirname,'login.html'));
});

app.post('/signup', async (req, res) => {
    // 1. TRIM and CLEAN data immediately
    const username = req.body.username ? req.body.username.trim().toLowerCase() : '';
    const password = req.body.password ? req.body.password.trim() : '';
    const confirm_password = req.body.confirm_password ? req.body.confirm_password.trim() : '';
    
    // Check for required fields
    if (!username || !password || !confirm_password) {
        return res.status(400).send('Error: All fields are required for signup.');
    }
    
    // Server-side check for confirm password match
    if (password !== confirm_password) {
        return res.status(400).send('Error: Passwords do not match. Please go back and try again.');
    }
    
    try {
        // Find existing user (using the trimmed, lowercased username)
        const existingUser = await User.findOne({ username });
        if (existingUser) {
            return res.status(409).send('Error: Username already exists. Try logging in or use a different name.');
        }

        // Create new user (Storing the username in lowercase to avoid future case-sensitivity issues)
        const newUser = new User({ 
            username: username, 
            password: password
        });
        
        await newUser.save();
        
        // Success: Redirect the user to the login page
        res.status(201).redirect('/login'); 
        
    } catch (error) {
        console.error("Signup error:", error);
        res.status(500).send('An unexpected error occurred during signup: ' + error.message);
    }
});
app.post('/login', async (req, res) => {
    // 1. TRIM and ENFORCE LOWERCASE on the submitted username
    const username = req.body.username ? req.body.username.trim().toLowerCase() : '';
    const password = req.body.password ? req.body.password.trim() : '';

    if (!username || !password) {
        return res.status(400).send('Login Failed: Both username and password are required.');
    }

    try {
        // 2. Find the user using the trimmed, lowercased username (matching how we stored it)
        const user = await User.findOne({ username });

        if (!user) {
            return res.status(401).send('Login Failed: Invalid username or password.');
        }

        // 3. Compare the submitted password with the stored password
        const isMatch = (password === user.password); // Simple comparison

        if (!isMatch) {
            return res.status(401).send('Login Failed: Invalid username or password.');
        }

        // Success: User is authenticated. Redirect to the main app page.
        res.redirect('/main_app_page'); 

    } catch (error) {
        console.error("Login error:", error);
        res.status(500).send('An unexpected error occurred during login.');
    }
});

app.get('/main_app_page', (req, res) => {
    // Assuming you named your main app page 'main_app_page.html'
    res.sendFile(path.join(__dirname, 'mainpage.html'));
});

app.listen(PORT,()=>{
    console.log(`server is running on port ${PORT}`);
});